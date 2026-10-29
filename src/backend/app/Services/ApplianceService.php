<?php

namespace App\Services;

use App\Exceptions\EntityHasChildrenException;
use App\Models\Appliance;
use App\Models\EBike;
use App\Models\SolarHomeSystem;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Http\Request;

class ApplianceService {
    public function __construct(private Appliance $appliance) {}

    /**
     * @return LengthAwarePaginator<int, Appliance>|Collection<int, Appliance>
     */
    public function getAppliances(Request $request): LengthAwarePaginator|Collection {
        $query = $this->appliance->newQuery()
            ->with(['applianceType'])
            ->withCount(['rates as sold_count']);

        $perPage = $request->integer('per_page');
        if ($perPage > 0) {
            return $query->paginate($perPage);
        }

        return $query->get();
    }

    public function createAppliance(Request $request): Appliance {
        return $this->appliance::query()
            ->create(
                $request->only(['appliance_type_id', 'name', 'price'])
            );
    }

    public function updateAppliance(Request $request, Appliance $appliance): Appliance {
        $appliance->update($request->only(['name', 'appliance_type_id', 'price']));

        return $appliance->refresh();
    }

    /**
     * @throws EntityHasChildrenException when the appliance was sold or devices point to it
     */
    public function deleteAppliance(Appliance $appliance): Appliance {
        if ($this->isInUse($appliance)) {
            throw new EntityHasChildrenException("{$appliance->name} has been sold or has devices linked, so it can't be deleted. Change its price instead.");
        }

        $applianceCopy = clone $appliance;
        $appliance->delete();

        return $applianceCopy;
    }

    /**
     * Trashed sales and agent assignments count as usage: payment histories and
     * agent sales still reference them, so deleting the appliance would orphan them.
     */
    private function isInUse(Appliance $appliance): bool {
        return $appliance->rates()->withTrashed()->exists()
            || $appliance->agentAssignedAppliance()->withTrashed()->exists()
            || SolarHomeSystem::query()->where('appliance_id', $appliance->id)->exists()
            || EBike::query()->where('appliance_id', $appliance->id)->exists();
    }

    public function getById(int $id): ?Appliance {
        return $this->appliance->newQuery()->with(['applianceType'])->find($id);
    }

    /**
     * @return Collection<int, Appliance>
     */
    public function getAllForExport(): Collection {
        return $this->appliance->newQuery()->with([
            'applianceType',
            'agentAssignedAppliance',
            'rates',
        ])->get();
    }
}
