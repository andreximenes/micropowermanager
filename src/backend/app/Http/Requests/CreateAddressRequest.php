<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class CreateAddressRequest extends FormRequest {
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool {
        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, mixed>
     */
    public function rules(): array {
        return [
            'city_id' => ['required'],
            'phone' => ['phone:INTERNATIONAL'],
            /*
             * Where the address is on the map, as "latitude,longitude".
             *
             * @example 9.57621,8.2985
             */
            'points' => ['sometimes', 'nullable', 'string', 'regex:/^-?\d+(\.\d+)?,\s*-?\d+(\.\d+)?$/'],
        ];
    }
}
