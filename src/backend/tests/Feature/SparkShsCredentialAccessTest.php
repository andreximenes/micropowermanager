<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Plugins\SparkShs\Services\SparkShsCredentialService;
use Database\Factories\UserFactory;
use Tests\CreateEnvironments;
use Tests\TestCase;

class SparkShsCredentialAccessTest extends TestCase {
    use CreateEnvironments;

    private const string AUTH_URL = 'https://auth.example.com/oauth/token';
    private const string API_URL = 'https://api.example.com';

    protected function setUp(): void {
        parent::setUp();

        $this->createTestData();
        $service = resolve(SparkShsCredentialService::class);
        $service->getCredentials();
        $service->updateCredentials([
            'client_id' => 'client-1',
            'client_secret' => 'secret-1',
            'auth_url' => self::AUTH_URL,
            'api_url' => self::API_URL,
            'audience' => array_key_first(config('spark-shs.audiences')),
            'access_token' => 'portal-token',
        ]);
    }

    public function testUsersWithoutTheSettingsPermissionAreRefused(): void {
        $user = UserFactory::new()->create();
        $this->assignPermission($user, 'customers');

        $this->actingAs($user)->getJson('/api/spark-shs/credentials')->assertStatus(403);
        $this->actingAs($user)->getJson('/api/spark-shs/sync/settings')->assertStatus(403);
    }

    public function testTheSecretAndThePortalTokenNeverLeaveTheServer(): void {
        $response = $this->actingAs($this->user)->getJson('/api/spark-shs/credentials');

        $response->assertStatus(200)
            ->assertJsonPath('data.client_id', 'client-1')
            ->assertJsonPath('data.has_client_secret', true)
            ->assertJsonMissingPath('data.client_secret')
            ->assertJsonMissingPath('data.access_token');
    }

    public function testSavingWithABlankSecretKeepsTheStoredOne(): void {
        $response = $this->actingAs($this->user)->putJson('/api/spark-shs/credentials', $this->form(['client_id' => 'client-2']));

        $response->assertStatus(200)->assertJsonMissingPath('data.client_secret');
        $stored = resolve(SparkShsCredentialService::class)->getCredentials();
        $this->assertSame('client-2', $stored->client_id);
        $this->assertSame('secret-1', $stored->client_secret);
    }

    public function testTheStoredSecretIsNotReusedForAnotherAuthenticationUrl(): void {
        $response = $this->actingAs($this->user)->putJson(
            '/api/spark-shs/credentials',
            $this->form(['auth_url' => 'https://elsewhere.example.com/token'])
        );

        $response->assertStatus(422)->assertJsonValidationErrors('client_secret');
        $this->assertSame(self::AUTH_URL, resolve(SparkShsCredentialService::class)->getCredentials()->auth_url);
    }

    /**
     * @param array<string, string> $overrides
     *
     * @return array<string, string>
     */
    private function form(array $overrides = []): array {
        return array_merge([
            'client_id' => 'client-1',
            'client_secret' => '',
            'auth_url' => self::AUTH_URL,
            'api_url' => self::API_URL,
            'audience' => array_key_first(config('spark-shs.audiences')),
        ], $overrides);
    }
}
