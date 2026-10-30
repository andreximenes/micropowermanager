<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::connection('tenant')->table('spark_shs_sync_settings', function (Blueprint $table) {
            $table->unsignedInteger('untyped_kit_appliance_id')->nullable()->after('interval_hours');
            $table->foreign('untyped_kit_appliance_id')->references('id')->on('appliances')->nullOnDelete();
        });
    }

    public function down(): void {
        Schema::connection('tenant')->table('spark_shs_sync_settings', function (Blueprint $table) {
            $table->dropForeign(['untyped_kit_appliance_id']);
            $table->dropColumn('untyped_kit_appliance_id');
        });
    }
};
