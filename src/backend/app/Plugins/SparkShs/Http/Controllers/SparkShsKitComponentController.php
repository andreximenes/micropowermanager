<?php

namespace App\Plugins\SparkShs\Http\Controllers;

use App\Models\SolarHomeSystem;
use App\Plugins\SparkShs\Http\Resources\SparkShsResource;
use App\Plugins\SparkShs\Models\SparkShsKitComponent;
use Dedoc\Scramble\Attributes\Group;
use Illuminate\Routing\Controller;

#[Group('Plugins / Spark SHS', 'API endpoints for integrating with Spark solar home systems')]
class SparkShsKitComponentController extends Controller {
    public function __construct(
        private SolarHomeSystem $solarHomeSystem,
        private SparkShsKitComponent $kitComponent,
    ) {}

    /**
     * List the devices connected to a Spark kit. The plugin decides what a Spark kit is, because
     * the manufacturer's API name is hidden from the UI; any other solar home system has none.
     */
    public function index(int $solarHomeSystemId): SparkShsResource {
        $solarHomeSystem = $this->solarHomeSystem->newQuery()->with('manufacturer')->findOrFail($solarHomeSystemId);

        return SparkShsResource::make([
            'is_spark_kit' => $solarHomeSystem->manufacturer?->api_name === 'SparkShsApi',
            'components' => $this->kitComponent->newQuery()
                ->where('solar_home_system_id', $solarHomeSystem->id)
                ->orderBy('type')
                ->orderBy('serial')
                ->get(['id', 'serial', 'type']),
        ]);
    }
}
