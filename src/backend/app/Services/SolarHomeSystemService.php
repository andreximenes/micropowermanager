<?php

namespace App\Services;

use App\Enums\DeviceType;
use App\Exceptions\Device\DeviceHasActivityException;
use App\Models\SolarHomeSystem;
use App\Services\Interfaces\IBaseService;
use App\Traits\HasCrudOperations;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;
use Spatie\QueryBuilder\AllowedSort;
use Spatie\QueryBuilder\QueryBuilder;

/**
 * @implements IBaseService<SolarHomeSystem>
 */
class SolarHomeSystemService implements IBaseService {
    /** @use HasCrudOperations<SolarHomeSystem> */
    use HasCrudOperations;

    public function __construct(private SolarHomeSystem $solarHomeSystem) {}

    protected function crudModel(): SolarHomeSystem {
        return $this->solarHomeSystem;
    }

    public function getById(int $id): SolarHomeSystem {
        return $this->solarHomeSystem->newQuery()
            ->with(['manufacturer', 'appliance', 'device.person.addresses.city', 'device.geo', 'tokens'])
            ->findOrFail($id);
    }

    /**
     * Sorting is read from the request's `sort_by` parameter by Spatie QueryBuilder.
     *
     * @return LengthAwarePaginator<int, SolarHomeSystem>
     */
    public function search(string $term, int $perPage): LengthAwarePaginator {
        $query = $this->solarHomeSystem->newQuery()
            ->with(['manufacturer', 'appliance', 'device.person'])
            ->when($term !== '', fn (Builder $query) => $query->where(
                fn (Builder $match) => $match
                    ->where('serial_number', 'LIKE', "%{$term}%")
                    ->orWhereHas('device.person', fn (Builder $person) => $person
                        ->where('name', 'LIKE', "%{$term}%")
                        ->orWhere('surname', 'LIKE', "%{$term}%")
                        ->orWhereRaw("CONCAT(name, ' ', surname) LIKE ?", ["%{$term}%"]))
            ));

        return QueryBuilder::for($query)
            ->allowedSorts($this->allowedSorts())
            ->defaultSort('-created_at')
            ->paginate($perPage)
            ->withQueryString();
    }

    /**
     * @return array<int, string|AllowedSort>
     */
    private function allowedSorts(): array {
        return [
            'id',
            'serial_number',
            'created_at',
            'updated_at',
            AllowedSort::callback('owner', function (Builder $query, bool $descending) {
                $direction = $descending ? 'desc' : 'asc';

                $subquery = DB::table('devices')
                    ->selectRaw('CONCAT(p.name, " ", p.surname)')
                    ->join('people as p', 'p.id', '=', 'devices.person_id')
                    ->whereColumn('devices.device_id', 'solar_home_systems.id')
                    ->where('devices.device_type', DeviceType::SolarHomeSystem)
                    ->limit(1);

                $query->orderByRaw('('.$subquery->toSql().') '.$direction)
                    ->addBinding($subquery->getBindings(), 'order');
            }),
        ];
    }

    /**
     * @param array<string, mixed> $data
     */
    public function update($model, array $data): SolarHomeSystem {
        $serialNumber = $data['serial_number'] ?? $model->serial_number;

        DB::connection('tenant')->transaction(function () use ($model, $data, $serialNumber): void {
            if ($serialNumber !== $model->serial_number) {
                $this->ensureDeviceHasNoActivity($model);
                $model->device?->update(['device_serial' => $serialNumber]);
            }

            $model->update($data);
        });

        return $model->fresh(['manufacturer', 'appliance', 'device.person']);
    }

    public function delete($model): ?bool {
        return DB::connection('tenant')->transaction(function () use ($model): ?bool {
            $this->ensureDeviceHasNoActivity($model);
            $model->device?->geo()->delete();
            $model->device?->delete();

            return $model->delete();
        });
    }

    private function ensureDeviceHasNoActivity(SolarHomeSystem $solarHomeSystem): void {
        $device = $solarHomeSystem->device;
        if ($device === null) {
            return;
        }

        $hasActivity = $device->transactions()->exists()
            || $device->tokens()->exists()
            || $device->appliancePerson()->exists();

        if ($hasActivity) {
            throw new DeviceHasActivityException("Solar Home System {$solarHomeSystem->serial_number} already has payments, tokens or an appliance sale linked to its serial number, so it can no longer be renamed or deleted.");
        }
    }
}
