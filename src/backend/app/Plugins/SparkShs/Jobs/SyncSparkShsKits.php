<?php

namespace App\Plugins\SparkShs\Jobs;

use App\Jobs\AbstractJob;
use App\Plugins\SparkShs\Models\SparkShsSyncSetting;
use App\Plugins\SparkShs\Services\SparkShsKitSyncService;
use App\Plugins\SparkShs\Services\SparkShsSyncSettingService;
use Illuminate\Queue\Middleware\WithoutOverlapping;

class SyncSparkShsKits extends AbstractJob {
    /**
     * The kits listing is paginated and a large partner can take several pages, so the default
     * 60s queue timeout would kill the run midway.
     */
    public int $timeout = 600;

    public function __construct(?int $companyId = null) {
        parent::__construct($companyId);

        $this->onConnection('redis');
        $this->onQueue('spark_shs');
    }

    /**
     * Both the scheduler and the "sync now" button dispatch this job; a second dispatch while one
     * is running is dropped instead of creating the same kits twice.
     *
     * @return array<int, object>
     */
    public function middleware(): array {
        return [new WithoutOverlapping('spark-shs-kits-'.$this->companyId)->dontRelease()->expireAfter($this->timeout)];
    }

    public function executeJob(): void {
        $syncSettingService = resolve(SparkShsSyncSettingService::class);

        try {
            $result = resolve(SparkShsKitSyncService::class)->sync();
        } catch (\Throwable $e) {
            $syncSettingService->recordResult(SparkShsSyncSetting::STATUS_FAILED, ['error' => $e->getMessage()]);

            throw $e;
        }

        $syncSettingService->recordResult(SparkShsSyncSetting::STATUS_SUCCESS, $result);
    }
}
