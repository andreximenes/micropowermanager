<?php

namespace App\Http\Controllers;

use App\Http\Resources\ApiResource;
use App\Models\ApplianceRate;
use App\Services\AppliancePaymentService;
use App\Services\ApplianceRateService;
use Dedoc\Scramble\Attributes\Group;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

#[Group('Appliance / Rate')]
class ApplianceRateController extends Controller {
    public function __construct(
        private ApplianceRateService $applianceRateService,
        private AppliancePaymentService $appliancePaymentService,
    ) {}

    public function update(Request $request, ApplianceRate $applianceRate): ApiResource {
        if ($applianceRate->rate_cost !== $applianceRate->remaining) {
            throw ValidationException::withMessages(['rate' => 'Cannot modify a rate that has been paid or partially paid']);
        }

        if ($this->appliancePaymentService->isOutstandingDownPaymentRate($applianceRate)) {
            throw ValidationException::withMessages(['rate' => 'The down payment agreed at the sale cannot be modified']);
        }

        $request->validate(['newCost' => ['required', 'integer', 'min:0']]);

        $cost = $applianceRate->rate_cost;
        $newCost = $request->integer('newCost');
        // The log's author is whoever is signed in, never a user id sent by the client.
        $creatorId = (int) auth('api')->id();
        $amount = $newCost - $cost;
        $appliancePerson = $applianceRate->appliancePerson;

        if ($newCost === 0) {
            $this->applianceRateService
                ->deleteUpdatedApplianceRateIfCostZero($applianceRate, $creatorId, $cost, $newCost);
            --$appliancePerson->rate_count;
        } else {
            $this->applianceRateService->updateApplianceRateCost($applianceRate, $creatorId, $cost, $newCost);
        }
        $appliancePerson->total_cost += $amount;
        $appliancePerson->save();

        return new ApiResource($applianceRate);
    }
}
