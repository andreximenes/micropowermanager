<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::connection('tenant')->create('spark_shs_kit_components', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('solar_home_system_id');
            // The core deletes a solar home system without knowing about plugins, so the cascade cleans up here.
            $table->foreign('solar_home_system_id')->references('id')->on('solar_home_systems')->cascadeOnDelete();
            $table->string('serial')->unique();
            $table->string('type');
            $table->timestamps();
        });
    }

    public function down(): void {
        Schema::connection('tenant')->dropIfExists('spark_shs_kit_components');
    }
};
