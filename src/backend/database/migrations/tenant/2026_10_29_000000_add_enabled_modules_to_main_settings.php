<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::connection('tenant')->table('main_settings', function (Blueprint $table) {
            $table->json('enabled_modules')->nullable();
        });
    }

    public function down(): void {
        if (Schema::connection('tenant')->hasColumn('main_settings', 'enabled_modules')) {
            Schema::connection('tenant')->table('main_settings', function (Blueprint $table) {
                $table->dropColumn('enabled_modules');
            });
        }
    }
};
