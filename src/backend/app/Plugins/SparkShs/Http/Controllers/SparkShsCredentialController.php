<?php

namespace App\Plugins\SparkShs\Http\Controllers;

use App\Plugins\SparkShs\Http\Clients\SparkShsApiClient;
use App\Plugins\SparkShs\Http\Requests\SparkShsCredentialRequest;
use App\Plugins\SparkShs\Http\Resources\SparkShsResource;
use App\Plugins\SparkShs\Services\SparkShsCredentialService;
use Dedoc\Scramble\Attributes\Group;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\JsonResponse;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\Http;
use Illuminate\Validation\ValidationException;

#[Group('Plugins / Spark SHS', 'API endpoints for integrating with Spark solar home systems')]
class SparkShsCredentialController extends Controller {
    public function __construct(
        private SparkShsCredentialService $credentialService,
    ) {}

    public function show(): SparkShsResource {
        return SparkShsResource::make($this->credentialService->getCredentials());
    }

    public function update(SparkShsCredentialRequest $request): SparkShsResource {
        // A cached token was issued for the previous client and audience, so any change forces a new one.
        $credentials = $this->credentialService->updateCredentials([
            'client_id' => $request->string('client_id')->toString(),
            'client_secret' => $this->clientSecret($request),
            'auth_url' => $request->string('auth_url')->toString(),
            'api_url' => $request->string('api_url')->toString(),
            'audience' => $request->string('audience')->toString(),
            'access_token' => null,
            'access_token_expires_at' => null,
        ]);

        return SparkShsResource::make($credentials);
    }

    public function check(SparkShsCredentialRequest $request): JsonResponse {
        $urls = [
            'auth_url' => $request->string('auth_url')->toString(),
            'api_url' => $request->string('api_url')->toString(),
        ];

        foreach ($urls as $url) {
            SparkShsApiClient::assertSafeUrl($url);
        }

        try {
            $authResponse = Http::asJson()
                ->post($urls['auth_url'], [
                    'client_id' => $request->string('client_id')->toString(),
                    'client_secret' => $this->clientSecret($request),
                    'audience' => config('spark-shs.audiences')[$request->string('audience')->toString()],
                    'grant_type' => 'client_credentials',
                ]);
        } catch (ConnectionException) {
            abort(503, 'Service unavailable');
        }

        if (in_array($authResponse->status(), [400, 401])) {
            return response()->json([
                'valid' => false,
            ]);
        }

        $testApiUrl = rtrim($urls['api_url'], '/').'/products/kits';

        try {
            $apiResponse = Http::withHeaders([
                'Authorization' => 'Bearer '.$authResponse->json()['access_token'],
            ])->get($testApiUrl);
        } catch (ConnectionException) {
            abort(503, 'Service unavailable');
        }

        if ($apiResponse->successful()) {
            $contentType = $apiResponse->header('Content-Type');

            // Check that we return an actual JSON not a 404 HTML error page
            if (str_contains($contentType, 'json')) {
                return response()->json([
                    'valid' => true,
                ]);
            }
        }

        abort(502, 'Authentication service error. Are URLs correct?');
    }

    /**
     * The secret typed in the form, or the stored one when the field is left blank. The stored secret
     * is only reused for the authentication URL it was saved with, so changing the URL cannot send it
     * to another server.
     */
    private function clientSecret(SparkShsCredentialRequest $request): string {
        if ($request->filled('client_secret')) {
            return $request->string('client_secret')->toString();
        }

        $stored = $this->credentialService->getCredentials();
        if (blank($stored->client_secret) || $stored->auth_url !== $request->string('auth_url')->toString()) {
            throw ValidationException::withMessages(['client_secret' => 'Enter the client secret (it is required when none is stored or the authentication URL changes).']);
        }

        return $stored->client_secret;
    }
}
