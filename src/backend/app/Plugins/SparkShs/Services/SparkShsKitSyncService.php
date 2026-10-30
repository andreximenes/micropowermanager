<?php

namespace App\Plugins\SparkShs\Services;

use App\Enums\ManufacturerMappingStatus;
use App\Models\Device;
use App\Models\Manufacturer;
use App\Models\SolarHomeSystem;
use App\Plugins\SparkShs\Exceptions\SparkShsApiResponseException;
use App\Plugins\SparkShs\Http\Clients\SparkShsApiClient;
use App\Plugins\SparkShs\Models\SparkShsKitComponent;
use App\Plugins\SparkShs\Models\SparkShsKitTypeMapping;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class SparkShsKitSyncService {
    public function __construct(
        private SparkShsApiClient $apiClient,
        private SparkShsKitTypeMapping $kitTypeMapping,
        private Manufacturer $manufacturer,
    ) {}

    /**
     * Pulls every kit visible to the configured client and stocks the new ones as unassigned
     * Spark SHS. The SHS and its device are never updated: an existing serial is either already
     * ours or a conflict. Only the components of our own kits are refreshed on every sync.
     *
     * @return array{created: int, existing: int, unmatched_kit_types: array<string, int>, conflicts: list<string>}
     */
    public function sync(): array {
        $manufacturer = $this->manufacturer->newQuery()->where('api_name', 'SparkShsApi')->firstOrFail();
        $mappings = $this->kitTypeMapping->newQuery()->inMatchingOrder()->get();

        $result = ['created' => 0, 'existing' => 0, 'unmatched_kit_types' => [], 'conflicts' => []];

        foreach ($this->fetchKits() as $kit) {
            $serial = (string) $kit['serial'];
            $existingDevice = Device::query()->where('device_serial', $serial)->first();

            if ($existingDevice instanceof Device) {
                $solarHomeSystem = $this->sparkShsOf($existingDevice, $manufacturer);
                if ($solarHomeSystem instanceof SolarHomeSystem) {
                    $this->syncComponents($solarHomeSystem, $kit);
                    ++$result['existing'];
                } else {
                    $result['conflicts'][] = $serial;
                }

                continue;
            }

            $kitType = $kit['kit_type'] ?? null;
            $applianceId = $this->resolveApplianceId($mappings, $kitType);

            if ($applianceId === null) {
                $unmatchedKey = $kitType ?? '(none)';
                $result['unmatched_kit_types'][$unmatchedKey] = ($result['unmatched_kit_types'][$unmatchedKey] ?? 0) + 1;

                continue;
            }

            $solarHomeSystem = $this->createSolarHomeSystem($serial, $manufacturer, $applianceId);
            $this->syncComponents($solarHomeSystem, $kit);
            ++$result['created'];
        }

        return $result;
    }

    /**
     * @return \Generator<int, array<string, mixed>>
     */
    private function fetchKits(): \Generator {
        $after = null;

        do {
            $query = ['limit' => config('spark-shs.kits_page_size')];
            if ($after !== null) {
                $query['after'] = $after;
            }

            $response = $this->apiClient->get('products/kits-detailed', $query);

            if (!$response->successful()) {
                throw new SparkShsApiResponseException("Spark SHS kits listing failed with status {$response->status()}.");
            }

            $page = $response->json();

            // A body without `data` would otherwise read as "no kits" and report a successful empty sync.
            if (!is_array($page) || !array_key_exists('data', $page) || !is_array($page['data']) || !array_key_exists('next_cursor', $page)) {
                throw new SparkShsApiResponseException('Spark SHS kits listing returned an unexpected response; expected {"data": [...], "next_cursor": ...}.');
            }

            yield from $page['data'];

            $after = $page['next_cursor'];
        } while ($after !== null);
    }

    private function sparkShsOf(Device $device, Manufacturer $manufacturer): ?SolarHomeSystem {
        $specificDevice = $device->device;

        return $specificDevice instanceof SolarHomeSystem && $specificDevice->manufacturer_id === $manufacturer->id
            ? $specificDevice
            : null;
    }

    /**
     * @param Collection<int, SparkShsKitTypeMapping> $mappings
     */
    private function resolveApplianceId(Collection $mappings, ?string $kitType): ?int {
        if ($kitType === null || $kitType === '') {
            return null;
        }

        // The first matching rule decides even when it has no appliance yet, so a kit is never
        // stocked under a broader rule than the one meant for it.
        return $mappings->first(fn (SparkShsKitTypeMapping $mapping): bool => $mapping->matches($kitType))?->appliance_id;
    }

    private function createSolarHomeSystem(string $serial, Manufacturer $manufacturer, int $applianceId): SolarHomeSystem {
        return DB::connection('tenant')->transaction(function () use ($serial, $manufacturer, $applianceId): SolarHomeSystem {
            $solarHomeSystem = SolarHomeSystem::query()->create([
                'serial_number' => $serial,
                'manufacturer_id' => $manufacturer->id,
                'appliance_id' => $applianceId,
            ]);

            // The kit came from Spark's own listing, so it is mapped by definition; the observer's
            // mapping check only runs inside HTTP requests and would leave it as unknown.
            Device::query()->create([
                'person_id' => null,
                'device_type' => SolarHomeSystem::RELATION_NAME,
                'device_id' => $solarHomeSystem->id,
                'device_serial' => $serial,
                'manufacturer_mapping_status' => ManufacturerMappingStatus::Mapped,
                'manufacturer_mapping_checked_at' => Carbon::now(),
            ]);

            return $solarHomeSystem;
        });
    }

    /**
     * Makes the kit's stored components match the portal's `devices` list. A component that moved
     * from another kit is reassigned, since its serial is unique.
     *
     * @param array<string, mixed> $kit
     */
    private function syncComponents(SolarHomeSystem $solarHomeSystem, array $kit): void {
        // A kit without the key says nothing about its components; reading it as an empty list
        // would wipe them if the portal ever dropped the field.
        if (!array_key_exists('devices', $kit) || !is_array($kit['devices'])) {
            return;
        }

        $components = [];
        foreach ($kit['devices'] as $device) {
            if (!is_array($device) || empty($device['serial']) || empty($device['type'])) {
                continue;
            }
            $components[] = ['serial' => (string) $device['serial'], 'type' => (string) $device['type']];
        }

        DB::connection('tenant')->transaction(function () use ($solarHomeSystem, $components): void {
            SparkShsKitComponent::query()
                ->where('solar_home_system_id', $solarHomeSystem->id)
                ->whereNotIn('serial', array_column($components, 'serial'))
                ->delete();

            foreach ($components as $component) {
                SparkShsKitComponent::query()->updateOrCreate(
                    ['serial' => $component['serial']],
                    ['solar_home_system_id' => $solarHomeSystem->id, 'type' => $component['type']],
                );
            }
        });
    }
}
