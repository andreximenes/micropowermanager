<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Enums\ManufacturerMappingStatus;
use App\Models\Appliance;
use App\Models\Device;
use App\Models\Manufacturer;
use App\Models\MpmPlugin;
use App\Models\Plugins;
use App\Models\SolarHomeSystem;
use App\Plugins\SparkShs\Exceptions\SparkShsApiResponseException;
use App\Plugins\SparkShs\Exceptions\SparkShsUnsafeAuthRequestException;
use App\Plugins\SparkShs\Http\Clients\SparkShsApiClient;
use App\Plugins\SparkShs\Jobs\SyncSparkShsKits;
use App\Plugins\SparkShs\Models\SparkShsKitTypeMapping;
use App\Plugins\SparkShs\Models\SparkShsSyncSetting;
use App\Plugins\SparkShs\Services\ManufacturerService;
use App\Plugins\SparkShs\Services\SparkShsCredentialService;
use App\Plugins\SparkShs\Services\SparkShsKitSyncService;
use App\Plugins\SparkShs\Services\SparkShsSyncSettingService;
use Database\Factories\ApplianceFactory;
use Database\Factories\ApplianceTypeFactory;
use Database\Factories\ManufacturerFactory;
use Database\Factories\SolarHomeSystemFactory;
use GuzzleHttp\Psr7\Response as GuzzleResponse;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Queue;
use Tests\CreateEnvironments;
use Tests\TestCase;

class SparkShsKitSyncTest extends TestCase {
    use CreateEnvironments;

    private Manufacturer $sparkManufacturer;

    protected function setUp(): void {
        parent::setUp();

        $this->createTestData();
        resolve(ManufacturerService::class)->register();
        $this->sparkManufacturer = Manufacturer::query()->where('api_name', 'SparkShsApi')->firstOrFail();
    }

    public function testItFollowsTheCursorAndStocksMatchedKitsAsUnassignedSparkShs(): void {
        $steady = $this->assignApplianceToDefaultRule('spark_steady');
        $this->mockKitPages([
            [null, [$this->kit('6000000001', 'spark_steady')], '6000000001'],
            ['6000000001', [$this->kit('6000000002', 'SPARK_STEADY')], null],
        ]);

        $result = resolve(SparkShsKitSyncService::class)->sync();

        $this->assertSame(2, $result['created']);
        foreach (['6000000001', '6000000002'] as $serial) {
            $device = Device::query()->where('device_serial', $serial)->firstOrFail();
            $this->assertNull($device->person_id);
            $this->assertSame(ManufacturerMappingStatus::Mapped, $device->manufacturer_mapping_status);
            $this->assertInstanceOf(SolarHomeSystem::class, $device->device);
            $this->assertSame($this->sparkManufacturer->id, $device->device->manufacturer_id);
            $this->assertSame($steady->id, $device->device->appliance_id);
        }
    }

    public function testItSkipsExistingConflictingAndUnmatchedKits(): void {
        $appliance = $this->assignApplianceToDefaultRule('spark_strong');
        $this->createDevice('6000000010', $this->sparkManufacturer, $appliance);
        $this->createDevice('6000000011', ManufacturerFactory::new()->isShsManufacturer()->create(), $appliance);
        $this->mockKitPages([
            [null, [
                $this->kit('6000000010', 'spark_strong'),
                $this->kit('6000000011', 'spark_strong'),
                $this->kit('6000000012', 'spark_supreme'),
                $this->kit('6000000013', null),
                $this->kit('6000000014', 'other_vendor_kit'),
            ], null],
        ]);

        $result = resolve(SparkShsKitSyncService::class)->sync();

        $this->assertSame(
            ['created' => 0, 'existing' => 1, 'unmatched_kit_types' => ['spark_supreme' => 1, '(none)' => 1, 'other_vendor_kit' => 1], 'conflicts' => ['6000000011']],
            $result
        );
        $this->assertFalse(Device::query()->whereIn('device_serial', ['6000000012', '6000000013', '6000000014'])->exists());
    }

    public function testAVariationRuleWinsOverTheGenericRuleRegardlessOfCreationOrder(): void {
        $steady = $this->assignApplianceToDefaultRule('spark_steady');
        $steadyFan = $this->createAppliance();
        SparkShsKitTypeMapping::query()->create(['pattern' => 'spark_steady_fan', 'appliance_id' => $steadyFan->id]);
        $this->mockKitPages([
            [null, [$this->kit('6000000020', 'spark_steady_fan'), $this->kit('6000000021', 'spark_steady_tv')], null],
        ]);

        resolve(SparkShsKitSyncService::class)->sync();

        $this->assertSame($steadyFan->id, Device::query()->where('device_serial', '6000000020')->firstOrFail()->device->appliance_id);
        $this->assertSame($steady->id, Device::query()->where('device_serial', '6000000021')->firstOrFail()->device->appliance_id);
    }

    public function testTheStandardSparkKitRulesComeWithoutAppliance(): void {
        $this->assertEqualsCanonicalizing(
            ['spark_start', 'spark_steady', 'spark_strong', 'spark_supreme'],
            SparkShsKitTypeMapping::query()->whereNull('appliance_id')->pluck('pattern')->all()
        );
    }

    public function testJobRecordsTheFailureWhenTheListingFails(): void {
        $client = \Mockery::mock(SparkShsApiClient::class);
        $client->shouldReceive('get')->andReturn(new Response(new GuzzleResponse(403, [], '{"error":"Authorization error"}')));
        $this->app->instance(SparkShsApiClient::class, $client);

        try {
            new SyncSparkShsKits(1)->executeJob();
            $this->fail('The job must rethrow the API failure.');
        } catch (SparkShsApiResponseException) {
        }

        $setting = SparkShsSyncSetting::query()->firstOrFail();
        $this->assertSame(SparkShsSyncSetting::STATUS_FAILED, $setting->last_sync_status);
        $this->assertStringContainsString('403', $setting->last_sync_result['error']);
    }

    public function testAListingWithoutTheDataEnvelopeFailsInsteadOfReportingNoKits(): void {
        $client = \Mockery::mock(SparkShsApiClient::class);
        $client->shouldReceive('get')->andReturn(new Response(new GuzzleResponse(200, [], (string) json_encode([$this->kit('6000000030', 'spark_start')]))));
        $this->app->instance(SparkShsApiClient::class, $client);

        $this->expectException(SparkShsApiResponseException::class);
        $this->expectExceptionMessage('unexpected response');

        resolve(SparkShsKitSyncService::class)->sync();
    }

    public function testJobRecordsTheResult(): void {
        $this->actingAs($this->user)->putJson('/api/spark-shs/sync/settings', ['is_enabled' => true, 'interval_hours' => 6])
            ->assertOk();
        $this->mockKitPages([[null, [], null]]);

        new SyncSparkShsKits(1)->executeJob();

        $setting = SparkShsSyncSetting::query()->firstOrFail();
        $this->assertSame(SparkShsSyncSetting::STATUS_SUCCESS, $setting->last_sync_status);
        $this->assertSame(0, $setting->last_sync_result['created']);
        $this->assertNotNull($setting->last_sync_at);
    }

    public function testSettingsAndMappingsAreValidated(): void {
        $this->actingAs($this->user)->putJson('/api/spark-shs/sync/settings', ['is_enabled' => true, 'interval_hours' => 0])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['interval_hours']);

        $this->actingAs($this->user)->postJson('/api/spark-shs/sync/kit-type-mappings', [
            'pattern' => 'spark (steady',
            'appliance_id' => $this->createAppliance()->id,
        ])->assertStatus(422)->assertJsonValidationErrors(['pattern']);
    }

    public function testMappingsCanBeCreatedAssignedListedAndDeleted(): void {
        $appliance = $this->createAppliance();

        $id = $this->actingAs($this->user)->postJson('/api/spark-shs/sync/kit-type-mappings', [
            'pattern' => 'spark_steady_fan_with_tv',
        ])->assertCreated()->json('data.id');

        $this->actingAs($this->user)->putJson("/api/spark-shs/sync/kit-type-mappings/{$id}", ['appliance_id' => $appliance->id])
            ->assertOk()
            ->assertJsonPath('data.appliance.id', $appliance->id);

        $this->actingAs($this->user)->getJson('/api/spark-shs/sync/kit-type-mappings')
            ->assertOk()
            ->assertJsonPath('data.0.id', $id);

        $this->actingAs($this->user)->deleteJson("/api/spark-shs/sync/kit-type-mappings/{$id}")->assertNoContent();
        $this->assertFalse(SparkShsKitTypeMapping::query()->whereKey($id)->exists());
    }

    public function testSyncNowQueuesTheJobOnlyWhenSyncIsEnabled(): void {
        Queue::fake();

        $this->actingAs($this->user)->postJson('/api/spark-shs/sync')->assertStatus(422);
        Queue::assertNotPushed(SyncSparkShsKits::class);

        resolve(SparkShsSyncSettingService::class)->update(true, 24);
        $this->actingAs($this->user)->postJson('/api/spark-shs/sync')->assertStatus(202);
        Queue::assertPushed(SyncSparkShsKits::class);
    }

    public function testCommandDispatchesOnlyWhenTheSyncIsDue(): void {
        Queue::fake();
        Plugins::query()->create(['mpm_plugin_id' => MpmPlugin::SPARK_SHS, 'status' => Plugins::ACTIVE]);
        $credentialService = resolve(SparkShsCredentialService::class);
        $credentialService->getCredentials();
        $credentialService->updateCredentials(['client_id' => 'client', 'client_secret' => 'secret']);

        $syncSettingService = resolve(SparkShsSyncSettingService::class);

        $this->artisan('spark-shs:sync-kits', ['--company-id' => 1])->assertSuccessful()->run();
        Queue::assertNotPushed(SyncSparkShsKits::class);

        $syncSettingService->update(true, 6);
        $this->artisan('spark-shs:sync-kits', ['--company-id' => 1])->assertSuccessful()->run();
        Queue::assertPushed(SyncSparkShsKits::class, 1);

        $syncSettingService->recordResult(SparkShsSyncSetting::STATUS_SUCCESS, []);
        $this->artisan('spark-shs:sync-kits', ['--company-id' => 1])->assertSuccessful()->run();
        Queue::assertPushed(SyncSparkShsKits::class, 1);
    }

    public function testCredentialUpdatePersistsUrlsAndAudienceAndDropsTheCachedToken(): void {
        $credentialService = resolve(SparkShsCredentialService::class);
        $credentialService->getCredentials();
        $credentialService->updateCredentials(['access_token' => 'old-token', 'access_token_expires_at' => Carbon::now()->addDay()]);

        $this->actingAs($this->user)->putJson('/api/spark-shs/credentials', [
            'client_id' => 'client',
            'client_secret' => 'secret',
            'auth_url' => 'https://auth.ruralspark.com/oauth/token',
            'api_url' => 'https://platform-staging.ruralspark.com/api/v1',
            'audience' => 'development',
        ])->assertOk();

        $credentials = $credentialService->getCredentials();
        $this->assertSame('https://platform-staging.ruralspark.com/api/v1', $credentials->api_url);
        $this->assertSame('https://platform-staging.ruralspark.com/api', $credentials->audienceUrl());
        $this->assertNull($credentials->access_token);
    }

    public function testLocalApiUrlsAreRefusedUnlessExplicitlyAllowed(): void {
        config(['spark-shs.allow_local_api_urls' => false]);
        foreach (['http://platform.ruralspark.com/api/v1', 'https://127.0.0.1/api/v1', 'https://localhost/api/v1'] as $url) {
            try {
                SparkShsApiClient::assertSafeUrl($url);
                $this->fail("{$url} must be refused.");
            } catch (SparkShsUnsafeAuthRequestException) {
            }
        }

        config(['spark-shs.allow_local_api_urls' => true]);
        SparkShsApiClient::assertSafeUrl('http://host.docker.internal:3000/api/v1');
        $this->expectException(SparkShsUnsafeAuthRequestException::class);
        SparkShsApiClient::assertSafeUrl('ftp://host.docker.internal/api/v1');
    }

    public function testCredentialUpdateRejectsUnknownAudience(): void {
        $this->actingAs($this->user)->putJson('/api/spark-shs/credentials', [
            'client_id' => 'client',
            'client_secret' => 'secret',
            'auth_url' => 'https://auth.ruralspark.com/oauth/token',
            'api_url' => 'https://platform.ruralspark.com/api/v1',
            'audience' => 'local',
        ])->assertStatus(422)->assertJsonValidationErrors(['audience']);
    }

    /**
     * @param list<array{0: string|null, 1: list<array<string, mixed>>, 2: string|null}> $pages after, kits, next_cursor
     */
    private function mockKitPages(array $pages): void {
        $client = \Mockery::mock(SparkShsApiClient::class);
        foreach ($pages as [$after, $kits, $nextCursor]) {
            $query = ['limit' => config('spark-shs.kits_page_size')] + ($after === null ? [] : ['after' => $after]);
            $client->shouldReceive('get')
                ->once()
                ->with('products/kits-detailed', $query)
                ->andReturn(new Response(new GuzzleResponse(200, [], (string) json_encode(['data' => $kits, 'next_cursor' => $nextCursor]))));
        }
        $this->app->instance(SparkShsApiClient::class, $client);
    }

    /**
     * @return array<string, mixed>
     */
    private function kit(string $serial, ?string $kitType): array {
        return ['serial' => $serial, 'kit_type' => $kitType, 'components' => ['screens' => [], 'batteries' => []]];
    }

    private function createDevice(string $serial, Manufacturer $manufacturer, Appliance $appliance): void {
        $solarHomeSystem = SolarHomeSystemFactory::new()->create([
            'serial_number' => $serial,
            'manufacturer_id' => $manufacturer->id,
            'appliance_id' => $appliance->id,
        ]);
        Device::factory()->for($solarHomeSystem, 'device')->createOne(['device_serial' => $serial]);
    }

    private function assignApplianceToDefaultRule(string $pattern): Appliance {
        $appliance = $this->createAppliance();
        SparkShsKitTypeMapping::query()->where('pattern', $pattern)->update(['appliance_id' => $appliance->id]);

        return $appliance;
    }

    private function createAppliance(): Appliance {
        return ApplianceFactory::new()->create([
            'appliance_type_id' => ApplianceTypeFactory::new()->create()->id,
        ]);
    }
}
