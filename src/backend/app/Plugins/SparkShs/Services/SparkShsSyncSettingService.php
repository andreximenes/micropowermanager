<?php

namespace App\Plugins\SparkShs\Services;

use App\Plugins\SparkShs\Models\SparkShsSyncSetting;
use Illuminate\Support\Carbon;

class SparkShsSyncSettingService {
    public function __construct(
        private SparkShsSyncSetting $syncSetting,
    ) {}

    public function get(): SparkShsSyncSetting {
        return $this->syncSetting->newQuery()->firstOrCreate([], ['is_enabled' => false, 'interval_hours' => 24]);
    }

    public function update(bool $isEnabled, int $intervalHours, ?int $untypedKitApplianceId): SparkShsSyncSetting {
        $setting = $this->get();
        $setting->is_enabled = $isEnabled;
        $setting->interval_hours = $intervalHours;
        $setting->untyped_kit_appliance_id = $untypedKitApplianceId;
        $setting->save();

        return $setting;
    }

    /**
     * Due-ness is derived from last_sync_at only, which is written by the job; timestamps written
     * from HTTP requests run under the tenant's timezone and would not compare with the scheduler's clock.
     */
    public function isDue(SparkShsSyncSetting $setting): bool {
        if (!$setting->is_enabled) {
            return false;
        }

        return !$setting->last_sync_at instanceof Carbon
            || $setting->last_sync_at->copy()->addHours($setting->interval_hours)->lte(Carbon::now());
    }

    /**
     * @param array<string, mixed> $result
     */
    public function recordResult(string $status, array $result): void {
        $setting = $this->get();
        $setting->last_sync_at = Carbon::now();
        $setting->last_sync_status = $status;
        $setting->last_sync_result = $result;
        $setting->save();
    }
}
