<?php

namespace App\Plugins\SparkShs\Providers;

use App\Plugins\SparkShs\Console\Commands\InstallPackage;
use App\Plugins\SparkShs\Console\Commands\SyncKits;
use App\Plugins\SparkShs\Modules\Api\SparkShsApi;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Support\ServiceProvider;

class SparkShsServiceProvider extends ServiceProvider {
    public function boot(): void {
        $this->app->register(RouteServiceProvider::class);
        $this->commands([InstallPackage::class, SyncKits::class]);
        $this->app->booted(function ($app) {
            // Runs hourly; each company's own interval_hours decides whether its sync is due.
            $app->make(Schedule::class)->command('spark-shs:sync-kits')->hourly()->withoutOverlapping(50)
                ->appendOutputTo(storage_path('logs/cron.log'));
        });
    }

    public function register(): void {
        $this->app->register(EventServiceProvider::class);
        $this->app->register(ObserverServiceProvider::class);
        $this->app->bind(SparkShsApi::class);
        $this->app->alias(SparkShsApi::class, 'SparkShsApi');
    }
}
