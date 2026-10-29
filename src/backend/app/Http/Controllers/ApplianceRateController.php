<?php

namespace App\Http\Controllers;

use App\Http\Resources\ApiResource;
use App\Models\ApplianceRate;
use App\Services\AppliancePaymentService;
use App\Services\ApplianceRateService;
use Dedoc\Scramble\Attributes\Group;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

#[Group('Appliance / Rate')]
class ApplianceRateController extends Controller {
    public function __construct(
        private ApplianceRateService $applianceRateService,
        private AppliancePaymentService $appliancePaymentService,
    ) {}

    public function update(Request $request, ApplianceRate $applianceRate): ApiResource {
        $request->validate(['newCost' => ['required', 'integer', 'min:0']]);
        $newCost = $request->integer('newCost');
        // The log's author is whoever is signed in, never a user id sent by the client.
        $creatorId = (int) auth('api')->id();

        // Locked so a payment processed meanwhile cannot land between the checks and the writes.
        $applianceRate = DB::connection('tenant')->transaction(function () use ($applianceRate, $newCost, $creatorId): ApplianceRate {
            $applianceRate = ApplianceRate::query()->lockForUpdate()->findOrFail($applianceRate->id);

            if ($applianceRate->rate_cost !== $applianceRate->remaining) {
                throw ValidationException::withMessages(['rate' => 'Cannot modify a rate that has been paid or partially paid']);
            }

            if ($this->appliancePaymentService->isOutstandingDownPaymentRate($applianceRate)) {
                throw ValidationException::withMessages(['rate' => 'The down payment agreed at the sale cannot be modified']);
            }

            $cost = $applianceRate->rate_cost;
            $appliancePerson = $applianceRate->appliancePerson;

            if ($newCost === 0) {
                $this->applianceRateService
                    ->deleteUpdatedApplianceRateIfCostZero($applianceRate, $creatorId, $cost, $newCost);
                --$appliancePerson->rate_count;
            } else {
                $this->applianceRateService->updateApplianceRateCost($applianceRate, $creatorId, $cost, $newCost);
            }
            $appliancePerson->total_cost += $newCost - $cost;
            $appliancePerson->save();

            return $applianceRate;
        });

        return new ApiResource($applianceRate);
    }
}
