<?php

namespace App\Plugins\SparkShs\Http\Clients;

use App\Plugins\SparkShs\Exceptions\SparkShsUnsafeAuthRequestException;
use App\Plugins\SparkShs\Services\SparkShsCredentialService;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Http;

class SparkShsApiClient {
    public function __construct(
        private SparkShsCredentialService $credentialService,
    ) {}

    /**
     * Get a valid access token.
     * Checks DB first, then (re-)authenticates if needed.
     */
    public function getToken(): string {
        if ($this->hasValidToken()) {
            return $this->credentialService->getCredentials()->access_token;
        }

        return $this->authenticate();
    }

    /**
     * Checks if current token exists and is not expired.
     */
    protected function hasValidToken(): bool {
        $credentials = $this->credentialService->getCredentials();

        return $credentials->access_token
            && $credentials->access_token_expires_at
            && Carbon::now()->lt($credentials->access_token_expires_at);
    }

    /**
     * The URLs are typed by users, so requests to internal addresses are refused to prevent SSRF.
     * A local development setup can opt out to reach a Spark portal running on the host machine.
     */
    public static function assertSafeUrl(string $url): void {
        $parts = parse_url($url);
        $allowLocal = (bool) config('spark-shs.allow_local_api_urls');
        $allowedSchemes = $allowLocal ? ['https', 'http'] : ['https'];

        if (!in_array($parts['scheme'] ?? null, $allowedSchemes, true)) {
            throw new SparkShsUnsafeAuthRequestException("Only HTTPS URLs allowed. {$url} given.");
        }

        if (empty($parts['host'])) {
            throw new SparkShsUnsafeAuthRequestException("URL invalid: {$url}");
        }

        if ($allowLocal) {
            return;
        }

        $ip = gethostbyname($parts['host']);

        if (!filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)) {
            throw new SparkShsUnsafeAuthRequestException("Invalid target IP address for: {$url}");
        }
    }

    /**
     * Authenticate with credentials and store access token in DB.
     */
    protected function authenticate(): string {
        $credentials = $this->credentialService->getCredentials();

        $urls = [
            'auth_url' => $credentials->auth_url,
            'api_url' => $credentials->api_url,
        ];

        foreach ($urls as $url) {
            self::assertSafeUrl($url);
        }

        $response = Http::asJson()
            ->post($credentials->auth_url, [
                'client_id' => $credentials->client_id,
                'client_secret' => $credentials->client_secret,
                'audience' => $credentials->audienceUrl(),
                'grant_type' => 'client_credentials',
            ]);

        $data = $response->json();

        if (!isset($data['access_token']) || !isset($data['expires_in'])) {
            throw new \Exception('Failed to authenticate with Spark SHS API');
        }

        $this->credentialService->updateCredentials([
            'access_token' => $data['access_token'],
            'access_token_expires_at' => Carbon::now()->addSeconds($data['expires_in']),
        ]);

        return $data['access_token'];
    }

    /**
     * Build full URL from API root + path.
     */
    protected function buildUrl(string $path): string {
        $credentials = $this->credentialService->getCredentials();
        $apiRoot = rtrim($credentials->api_url, '/');
        $path = ltrim($path, '/');

        $url = "{$apiRoot}/{$path}";

        self::assertSafeUrl($url);

        return $url;
    }

    /**
     * GET request to API with Bearer token.
     *
     * @param array<string,mixed>  $query
     * @param array<string,string> $headers
     */
    public function get(string $path, array $query = [], array $headers = []): Response {
        $url = $this->buildUrl($path);

        return Http::withHeaders(array_merge($headers, [
            'Authorization' => 'Bearer '.$this->getToken(),
        ]))->get($url, $query);
    }

    /**
     * POST request to API with Bearer token.
     *
     * @param array<string,mixed>  $data
     * @param array<string,string> $headers
     */
    public function post(string $path, array $data = [], array $headers = []): Response {
        $url = $this->buildUrl($path);

        return Http::withHeaders(array_merge($headers, [
            'Authorization' => 'Bearer '.$this->getToken(),
        ]))->post($url, $data);
    }

    /**
     * PUT request to API with Bearer token.
     *
     * @param array<string,mixed>  $data
     * @param array<string,string> $headers
     */
    public function put(string $path, array $data = [], array $headers = []): Response {
        $url = $this->buildUrl($path);

        return Http::withHeaders(array_merge($headers, [
            'Authorization' => 'Bearer '.$this->getToken(),
        ]))->put($url, $data);
    }
}
