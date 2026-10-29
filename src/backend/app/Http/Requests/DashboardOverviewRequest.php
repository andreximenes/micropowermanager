<?php

namespace App\Http\Requests;

use App\Services\DashboardOverviewService;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class DashboardOverviewRequest extends FormRequest {
    /**
     * @return array<string, mixed>
     */
    public function rules(): array {
        return [
            'period' => ['nullable', Rule::in(DashboardOverviewService::PERIODS)],
        ];
    }

    public function period(): string {
        return $this->string('period', DashboardOverviewService::PERIOD_THIS_MONTH)->toString();
    }
}
