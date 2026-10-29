<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class TransactionExportRequest extends FormRequest {
    /**
     * @return array<string, mixed>
     */
    public function rules(): array {
        return [
            /*
             * Export format.
             *
             * @default excel
             */
            'format' => ['nullable', 'in:excel,csv,json'],

            /*
             * Filter by device type.
             *
             * @default all
             */
            'deviceType' => ['nullable', 'in:all,meter,solar_home_system,e_bike'],

            /* Filter by device serial number. */
            'serial_number' => ['nullable', 'string'],

            /* Filter by meter tariff id. */
            'tariff' => ['nullable', 'integer'],

            /*
             * Filter by transaction provider: `agent_transaction`, `cash_transaction`,
             * `third_party_transaction`, or the alias of an installed payment provider plugin.
             *
             * @default all
             */
            'provider' => ['nullable', 'string'],

            /* Filter by transaction status: `1` = confirmed, `0` = processing, `-1` = rejected, `3` = cancelled. */
            'status' => ['nullable', 'integer'],

            /* Include transactions created on or after this date. */
            'from' => ['nullable', 'date'],

            /* Include transactions created on or before this date (the whole day for a plain date). */
            'to' => ['nullable', 'date'],
        ];
    }
}
