<?php

namespace Tests\Feature;

use App\Models\MainSettings;
use App\Models\User;
use Database\Factories\MainSettingsFactory;
use Database\Factories\UserFactory;
use Tests\RefreshMultipleDatabases;
use Tests\TestCase;

class MainSettingsModulesTest extends TestCase {
    use RefreshMultipleDatabases;

    private User $user;
    private MainSettings $mainSettings;

    protected function setUp(): void {
        parent::setUp();

        $this->user = UserFactory::new()->create();
        $this->assignRole($this->user, 'admin');
        MainSettings::query()->delete();
        $this->mainSettings = MainSettingsFactory::new()->create();
    }

    public function testNoModuleIsEnabledByDefault(): void {
        $response = $this->actingAs($this->user)->get('/api/settings/main');

        $response->assertOk();
        $response->assertJsonPath('data.enabled_modules', null);
    }

    public function testEnabledModulesAreSavedAndReturned(): void {
        $response = $this->actingAs($this->user)->put(
            "/api/settings/main/{$this->mainSettings->id}",
            ['enabled_modules' => ['meters', 'sms']],
        );

        $response->assertOk();
        $response->assertJsonPath('data.enabled_modules', ['meters', 'sms']);
        $this->actingAs($this->user)->get('/api/settings/main')
            ->assertJsonPath('data.enabled_modules', ['meters', 'sms']);
    }

    public function testModulesCanBeSwitchedAllOff(): void {
        $this->mainSettings->update(['enabled_modules' => ['targets']]);

        $response = $this->actingAs($this->user)->put(
            "/api/settings/main/{$this->mainSettings->id}",
            ['enabled_modules' => []],
        );

        $response->assertOk();
        $response->assertJsonPath('data.enabled_modules', []);
    }

    public function testOtherSettingsUpdatesLeaveModulesUnchanged(): void {
        $this->mainSettings->update(['enabled_modules' => ['tariffs']]);

        $response = $this->actingAs($this->user)->put(
            "/api/settings/main/{$this->mainSettings->id}",
            ['company_name' => 'Spark'],
        );

        $response->assertOk();
        $response->assertJsonPath('data.company_name', 'Spark');
        $response->assertJsonPath('data.enabled_modules', ['tariffs']);
    }

    public function testUnknownModuleIsRejected(): void {
        $response = $this->actingAs($this->user)->putJson(
            "/api/settings/main/{$this->mainSettings->id}",
            ['enabled_modules' => ['meters', 'crypto-mining']],
        );

        $response->assertUnprocessable();
        $response->assertJsonValidationErrors('enabled_modules.1');
        $this->assertNull($this->mainSettings->fresh()?->enabled_modules);
    }

    public function testEnabledModulesMustBeAList(): void {
        $response = $this->actingAs($this->user)->putJson(
            "/api/settings/main/{$this->mainSettings->id}",
            ['enabled_modules' => 'meters'],
        );

        $response->assertUnprocessable();
        $response->assertJsonValidationErrors('enabled_modules');
    }

    public function testDuplicateModulesAreRejected(): void {
        $response = $this->actingAs($this->user)->putJson(
            "/api/settings/main/{$this->mainSettings->id}",
            ['enabled_modules' => ['sms', 'sms']],
        );

        $response->assertUnprocessable();
    }
}
