<?php

namespace App\Http\Controllers;

use App\Http\Requests\DashboardOverviewRequest;
use App\Http\Resources\ApiResource;
use App\Services\DashboardOverviewService;
use Carbon\CarbonImmutable;

class DashboardOverviewController extends Controller {
    public function __construct(private DashboardOverviewService $dashboardOverviewService) {}

    public function show(DashboardOverviewRequest $request): ApiResource {
        return ApiResource::make($this->dashboardOverviewService->getOverview($request->period(), CarbonImmutable::today()));
    }
}
