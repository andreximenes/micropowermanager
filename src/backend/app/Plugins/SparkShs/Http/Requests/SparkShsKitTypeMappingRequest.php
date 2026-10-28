<?php

namespace App\Plugins\SparkShs\Http\Requests;

use App\Plugins\SparkShs\Models\SparkShsKitTypeMapping;
use Illuminate\Foundation\Http\FormRequest;

class SparkShsKitTypeMappingRequest extends FormRequest {
    /**
     * @return array<string, mixed>
     */
    public function rules(): array {
        return [
            'pattern' => [
                $this->isMethod('post') ? 'required' : 'sometimes',
                'string',
                'max:255',
                function (string $attribute, mixed $value, \Closure $fail): void {
                    if (is_string($value) && !SparkShsKitTypeMapping::isValidPattern($value)) {
                        $fail('The pattern is not a valid regular expression.');
                    }
                },
            ],
            'appliance_id' => ['nullable', 'integer', 'exists:tenant.appliances,id'],
        ];
    }
}
