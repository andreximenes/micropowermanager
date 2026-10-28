<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::connection('tenant')->table('spark_shs_credentials', function (Blueprint $table) {
            $table->string('audience')->default('production')->after('api_url');
        });

        Schema::connection('tenant')->create('spark_shs_sync_settings', function (Blueprint $table) {
            $table->id();
            $table->boolean('is_enabled')->default(false);
            $table->unsignedInteger('interval_hours')->default(24);
            $table->timestamp('last_sync_at')->nullable();
            $table->string('last_sync_status')->nullable();
            $table->json('last_sync_result')->nullable();
            $table->timestamps();
        });

        Schema::connection('tenant')->create('spark_shs_kit_type_mappings', function (Blueprint $table) {
            $table->id();
            $table->string('pattern');
            $table->unsignedInteger('appliance_id')->nullable();
            $table->foreign('appliance_id')->references('id')->on('appliances')->nullOnDelete();
            $table->timestamps();
        });

        // Spark's standard kit types, so a company only has to pick an appliance for each.
        $now = Carbon::now();
        DB::connection('tenant')->table('spark_shs_kit_type_mappings')->insert(array_map(
            fn (string $pattern): array => ['pattern' => $pattern, 'appliance_id' => null, 'created_at' => $now, 'updated_at' => $now],
            ['spark_start', 'spark_steady', 'spark_strong', 'spark_supreme'],
        ));
    }

    public function down(): void {
        Schema::connection('tenant')->dropIfExists('spark_shs_kit_type_mappings');
        Schema::connection('tenant')->dropIfExists('spark_shs_sync_settings');
        Schema::connection('tenant')->table('spark_shs_credentials', function (Blueprint $table) {
            $table->dropColumn('audience');
        });
    }
};
