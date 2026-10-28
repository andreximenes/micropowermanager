<?php

namespace App\Plugins\SparkShs\Console\Commands;

use App\Console\Commands\AbstractSharedCommand;
use App\Models\MpmPlugin;
use App\Plugins\SparkShs\Jobs\SyncSparkShsKits;
use App\Plugins\SparkShs\Services\SparkShsCredentialService;
use App\Plugins\SparkShs\Services\SparkShsSyncSettingService;
use App\Traits\ScheduledPluginCommand;

class SyncKits extends AbstractSharedCommand {
    use ScheduledPluginCommand;

    protected $signature = 'spark-shs:sync-kits';
    protected $description = 'Dispatch the Spark kit sync for companies whose sync interval has elapsed.';

    public function __construct(
        private SparkShsSyncSettingService $syncSettingService,
        private SparkShsCredentialService $credentialService,
    ) {
        parent::__construct();
    }

    public function handle(): void {
        if (!$this->checkForPluginStatusIsActive(MpmPlugin::SPARK_SHS)) {
            return;
        }

        if (!$this->credentialService->getCredentials()->client_id) {
            $this->info('Spark SHS credentials not configured, skipping kit sync.');

            return;
        }

        if (!$this->syncSettingService->isDue($this->syncSettingService->get())) {
            return;
        }

        dispatch(new SyncSparkShsKits());
    }
}
