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
use App\Plugins\SparkShs\Models\SparkShsKitComponent;
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
use Database\Factories\UserFactory;
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

        resolve(SparkShsSyncSettingService::class)->update(true, 24, null);
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

        $syncSettingService->update(true, 6, null);
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

    public function testKitsWithoutATypeGetTheUntypedKitProductButUnknownTypesStillNeedARule(): void {
        $untyped = $this->createAppliance();
        resolve(SparkShsSyncSettingService::class)->update(true, 24, $untyped->id);
        $this->mockKitPages([[null, [
            $this->kit('6000000100', null),
            $this->kit('6000000101', ''),
            $this->kit('6000000102', 'other_vendor_kit'),
        ], null]]);

        $result = resolve(SparkShsKitSyncService::class)->sync();

        $this->assertSame(2, $result['created']);
        $this->assertSame(['other_vendor_kit' => 1], $result['unmatched_kit_types']);
        foreach (['6000000100', '6000000101'] as $serial) {
            $this->assertSame($untyped->id, Device::query()->where('device_serial', $serial)->firstOrFail()->device->appliance_id);
        }
    }

    public function testTheUntypedKitProductIsSavedValidatedAndClearedWhenTheProductIsDeleted(): void {
        $appliance = $this->createAppliance();

        $this->actingAs($this->user)->putJson('/api/spark-shs/sync/settings', ['is_enabled' => true, 'interval_hours' => 24, 'untyped_kit_appliance_id' => 999999])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['untyped_kit_appliance_id']);
        $this->actingAs($this->user)->putJson('/api/spark-shs/sync/settings', ['is_enabled' => true, 'interval_hours' => 24, 'untyped_kit_appliance_id' => $appliance->id])
            ->assertOk()
            ->assertJsonPath('data.untyped_kit_appliance_id', $appliance->id);

        $appliance->delete();

        $this->assertNull(SparkShsSyncSetting::query()->firstOrFail()->untyped_kit_appliance_id);
    }

    public function testANewKitIsStockedWithItsComponentsSkippingMalformedEntries(): void {
        $this->assignApplianceToDefaultRule('spark_steady');
        $this->mockKitPages([[null, [$this->kitWithDevices('6000000040', [
            ['serial' => '7000000001', 'type' => 'screen'],
            ['serial' => '7000000002', 'type' => 'battery'],
            ['serial' => '7000000003'],
            ['type' => 'battery'],
            'not-a-device',
        ])], null]]);

        resolve(SparkShsKitSyncService::class)->sync();

        $this->assertSame(['7000000001' => 'screen', '7000000002' => 'battery'], $this->componentsOf('6000000040'));
    }

    public function testAnExistingSparkKitHasItsComponentsRefreshedAndAMovedBatteryIsReassigned(): void {
        $appliance = $this->assignApplianceToDefaultRule('spark_steady');
        $first = $this->createDevice('6000000050', $this->sparkManufacturer, $appliance);
        $second = $this->createDevice('6000000051', $this->sparkManufacturer, $appliance);
        SparkShsKitComponent::query()->create(['solar_home_system_id' => $first->id, 'serial' => '7000000010', 'type' => 'screen']);
        SparkShsKitComponent::query()->create(['solar_home_system_id' => $first->id, 'serial' => '7000000011', 'type' => 'battery']);
        SparkShsKitComponent::query()->create(['solar_home_system_id' => $second->id, 'serial' => '7000000012', 'type' => 'battery']);
        $this->mockKitPages([[null, [
            $this->kitWithDevices('6000000050', [
                ['serial' => '7000000010', 'type' => 'screen'],
                ['serial' => '7000000012', 'type' => 'battery'],
            ]),
            $this->kitWithDevices('6000000051', []),
        ], null]]);

        $result = resolve(SparkShsKitSyncService::class)->sync();

        $this->assertSame(2, $result['existing']);
        $this->assertSame(['7000000010' => 'screen', '7000000012' => 'battery'], $this->componentsOf('6000000050'));
        $this->assertSame([], $this->componentsOf('6000000051'));
    }

    public function testAKitWithoutTheDevicesKeyKeepsItsComponents(): void {
        $appliance = $this->assignApplianceToDefaultRule('spark_steady');
        $solarHomeSystem = $this->createDevice('6000000060', $this->sparkManufacturer, $appliance);
        SparkShsKitComponent::query()->create(['solar_home_system_id' => $solarHomeSystem->id, 'serial' => '7000000020', 'type' => 'battery']);
        $this->mockKitPages([[null, [['serial' => '6000000060', 'kit_type' => 'spark_steady']], null]]);

        resolve(SparkShsKitSyncService::class)->sync();

        $this->assertSame(['7000000020' => 'battery'], $this->componentsOf('6000000060'));
    }

    public function testConflictingAndUnmatchedKitsGetNoComponentsAndTheOtherBrandsDeviceIsUntouched(): void {
        $appliance = $this->createAppliance();
        $otherManufacturer = ManufacturerFactory::new()->isShsManufacturer()->create();
        $otherSolarHomeSystem = $this->createDevice('6000000070', $otherManufacturer, $appliance);
        $otherBefore = $otherSolarHomeSystem->fresh()?->toArray();
        $this->mockKitPages([[null, [
            $this->kitWithDevices('6000000070', [['serial' => '7000000030', 'type' => 'battery']]),
            ['devices' => [['serial' => '7000000031', 'type' => 'battery']]] + $this->kit('6000000071', 'other_vendor_kit'),
        ], null]]);

        $result = resolve(SparkShsKitSyncService::class)->sync();

        $this->assertSame(['6000000070'], $result['conflicts']);
        $this->assertSame(0, SparkShsKitComponent::query()->count());
        $this->assertSame($otherBefore, $otherSolarHomeSystem->fresh()?->toArray());
        $this->assertSame($otherManufacturer->id, Device::query()->where('device_serial', '6000000070')->firstOrFail()->device->manufacturer_id);
    }

    public function testComponentsAreListedWithTheAppliancesPermissionOnly(): void {
        $appliance = $this->createAppliance();
        $sparkSolarHomeSystem = $this->createDevice('6000000080', $this->sparkManufacturer, $appliance);
        $otherSolarHomeSystem = $this->createDevice('6000000081', ManufacturerFactory::new()->isShsManufacturer()->create(), $appliance);
        SparkShsKitComponent::query()->create(['solar_home_system_id' => $sparkSolarHomeSystem->id, 'serial' => '7000000041', 'type' => 'screen']);
        SparkShsKitComponent::query()->create(['solar_home_system_id' => $sparkSolarHomeSystem->id, 'serial' => '7000000040', 'type' => 'battery']);
        $applianceUser = UserFactory::new()->create();
        $this->assignPermission($applianceUser, 'appliances');
        $customerUser = UserFactory::new()->create();
        $this->assignPermission($customerUser, 'customers');

        $this->actingAs($applianceUser)->getJson("/api/spark-shs/solar-home-systems/{$sparkSolarHomeSystem->id}/components")
            ->assertOk()
            ->assertJsonPath('data.is_spark_kit', true)
            ->assertJsonPath('data.components.0.serial', '7000000040')
            ->assertJsonPath('data.components.0.type', 'battery')
            ->assertJsonPath('data.components.1.serial', '7000000041')
            ->assertJsonCount(2, 'data.components');
        $this->actingAs($applianceUser)->getJson("/api/spark-shs/solar-home-systems/{$otherSolarHomeSystem->id}/components")
            ->assertOk()
            ->assertJsonPath('data.is_spark_kit', false)
            ->assertJsonCount(0, 'data.components');
        $this->actingAs($applianceUser)->getJson('/api/spark-shs/solar-home-systems/999999/components')
            ->assertNotFound();
        $this->actingAs($customerUser)->getJson("/api/spark-shs/solar-home-systems/{$sparkSolarHomeSystem->id}/components")
            ->assertStatus(403);
    }

    public function testDeletingTheSolarHomeSystemDeletesItsComponents(): void {
        $solarHomeSystem = $this->createDevice('6000000090', $this->sparkManufacturer, $this->createAppliance());
        SparkShsKitComponent::query()->create(['solar_home_system_id' => $solarHomeSystem->id, 'serial' => '7000000050', 'type' => 'battery']);

        $solarHomeSystem->delete();

        $this->assertSame(0, SparkShsKitComponent::query()->count());
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
        return ['serial' => $serial, 'kit_type' => $kitType, 'devices' => []];
    }

    /**
     * @param list<mixed> $devices
     *
     * @return array<string, mixed>
     */
    private function kitWithDevices(string $serial, array $devices): array {
        return ['devices' => $devices] + $this->kit($serial, 'spark_steady');
    }

    /**
     * @return array<string, string>
     */
    private function componentsOf(string $serial): array {
        $solarHomeSystemId = Device::query()->where('device_serial', $serial)->firstOrFail()->device_id;

        return SparkShsKitComponent::query()
            ->where('solar_home_system_id', $solarHomeSystemId)
            ->orderBy('serial')
            ->pluck('type', 'serial')
            ->all();
    }

    private function createDevice(string $serial, Manufacturer $manufacturer, Appliance $appliance): SolarHomeSystem {
        $solarHomeSystem = SolarHomeSystemFactory::new()->create([
            'serial_number' => $serial,
            'manufacturer_id' => $manufacturer->id,
            'appliance_id' => $appliance->id,
        ]);
        Device::factory()->for($solarHomeSystem, 'device')->createOne(['device_serial' => $serial]);

        return $solarHomeSystem;
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
