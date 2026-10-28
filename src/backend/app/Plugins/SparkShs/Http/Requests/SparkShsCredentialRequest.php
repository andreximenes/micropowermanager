<?php

namespace App\Plugins\SparkShs\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class SparkShsCredentialRequest extends FormRequest {
    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, mixed>
     */
    public function rules(): array {
        $urlRule = config('spark-shs.allow_local_api_urls') ? 'url:http,https' : 'url:https';

        return [
            'client_id' => ['required', 'string'],
            'client_secret' => ['required', 'string'],
            'auth_url' => ['required', $urlRule],
            'api_url' => ['required', $urlRule],
            'audience' => ['required', Rule::in(array_keys(config('spark-shs.audiences')))],
        ];
    }
}
