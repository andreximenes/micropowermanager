<?php

namespace App\Plugins\SparkShs\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class SparkShsSyncSettingRequest extends FormRequest {
    /**
     * @return array<string, mixed>
     */
    public function rules(): array {
        return [
            'is_enabled' => ['required', 'boolean'],
            'interval_hours' => ['required', 'integer', 'min:1', 'max:720'],
        ];
    }
}
