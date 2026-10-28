<?php

namespace App\Plugins\SparkShs\Http\Controllers;

use App\Plugins\SparkShs\Http\Requests\SparkShsKitTypeMappingRequest;
use App\Plugins\SparkShs\Http\Requests\SparkShsSyncSettingRequest;
use App\Plugins\SparkShs\Http\Resources\SparkShsResource;
use App\Plugins\SparkShs\Jobs\SyncSparkShsKits;
use App\Plugins\SparkShs\Models\SparkShsKitTypeMapping;
use App\Plugins\SparkShs\Services\SparkShsSyncSettingService;
use Dedoc\Scramble\Attributes\Group;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Routing\Controller;

#[Group('Plugins / Spark SHS', 'API endpoints for integrating with Spark solar home systems')]
class SparkShsSyncController extends Controller {
    public function __construct(
        private SparkShsSyncSettingService $syncSettingService,
        private SparkShsKitTypeMapping $kitTypeMapping,
    ) {}

    public function showSettings(): SparkShsResource {
        return SparkShsResource::make($this->syncSettingService->get());
    }

    public function updateSettings(SparkShsSyncSettingRequest $request): JsonResponse {
        $setting = $this->syncSettingService->update(
            $request->boolean('is_enabled'),
            $request->integer('interval_hours'),
        );

        // The settings row is created lazily, so the first update would otherwise answer 201.
        return SparkShsResource::make($setting)->response()->setStatusCode(Response::HTTP_OK);
    }

    /**
     * Queue a kit sync now, regardless of the configured interval.
     */
    public function sync(): JsonResponse {
        if (!$this->syncSettingService->get()->is_enabled) {
            abort(Response::HTTP_UNPROCESSABLE_ENTITY, 'Kit synchronization is disabled. Enable it first.');
        }

        dispatch(new SyncSparkShsKits());

        return response()->json(['queued' => true], Response::HTTP_ACCEPTED);
    }

    public function listMappings(): AnonymousResourceCollection {
        return SparkShsResource::collection(
            $this->kitTypeMapping->newQuery()->with('appliance')->inMatchingOrder()->get()
        );
    }

    public function storeMapping(SparkShsKitTypeMappingRequest $request): SparkShsResource {
        $mapping = $this->kitTypeMapping->newQuery()->create([
            'pattern' => $request->string('pattern')->toString(),
            'appliance_id' => $request->filled('appliance_id') ? $request->integer('appliance_id') : null,
        ]);

        return SparkShsResource::make($mapping->load('appliance'));
    }

    public function updateMapping(SparkShsKitTypeMappingRequest $request, SparkShsKitTypeMapping $mapping): SparkShsResource {
        if ($request->has('pattern')) {
            $mapping->pattern = $request->string('pattern')->toString();
        }
        $mapping->appliance_id = $request->filled('appliance_id') ? $request->integer('appliance_id') : null;
        $mapping->save();

        return SparkShsResource::make($mapping->load('appliance'));
    }

    public function destroyMapping(SparkShsKitTypeMapping $mapping): Response {
        $mapping->delete();

        return response()->noContent();
    }
}
