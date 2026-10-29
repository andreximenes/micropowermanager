<?php

namespace App\Services;

use App\Exceptions\EntityHasChildrenException;
use App\Models\ApplianceType;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;

class ApplianceTypeService {
    public function __construct(private ApplianceType $applianceType) {}

    /**
     * @return LengthAwarePaginator<int, ApplianceType>|Collection<int, ApplianceType>
     */
    public function getApplianceTypes(Request $request): LengthAwarePaginator|Collection {
        $perPage = $request->integer('per_page');
        if ($perPage > 0) {
            return $this->applianceType->newQuery()->paginate($perPage);
        }

        return $this->applianceType->newQuery()->get();
    }

    /**
     * @param array{name?: string, price?: float|int} $data
     */
    public function createApplianceType(array $data): ApplianceType {
        return $this->applianceType::query()
            ->create(
                Arr::only($data, ['name', 'price'])
            );
    }

    /**
     * @param array{name?: string, price?: float|int} $data
     */
    public function updateApplianceType(array $data, ApplianceType $appliance): ApplianceType {
        $appliance->update(Arr::only($data, ['name', 'price']));
        $appliance->fresh();

        return $appliance;
    }

    /**
     * @throws EntityHasChildrenException when products still use the type
     */
    public function deleteApplianceType(ApplianceType $applianceType): ?bool {
        if ($applianceType->appliance()->exists()) {
            throw new EntityHasChildrenException("{$applianceType->name} still has products, so it can't be deleted. Move or delete those products first.");
        }

        return $applianceType->delete();
    }
}
