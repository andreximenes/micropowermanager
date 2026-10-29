<?php

namespace App\Http\Requests;

use App\Models\ApplianceType;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreSolarHomeSystemRequest extends FormRequest {
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool {
        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, array<int, string|ValidationRule|\Stringable>>
     */
    public function rules(): array {
        return [
            'serial_numbers' => ['required', 'array', 'min:1'],
            'serial_numbers.*' => ['required', 'string', 'min:8', 'max:15', 'distinct', 'unique:tenant.devices,device_serial'],
            'manufacturer_id' => ['required', 'integer', Rule::exists('tenant.manufacturers', 'id')->where('type', 'shs')],
            'appliance_id' => ['required', 'integer', Rule::exists('tenant.appliances', 'id')->where('appliance_type_id', ApplianceType::APPLIANCE_TYPE_SHS)],
            'person_id' => ['nullable', 'integer', 'exists:tenant.people,id'],
        ];
    }
}
