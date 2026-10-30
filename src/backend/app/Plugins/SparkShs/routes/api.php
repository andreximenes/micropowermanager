<?php

use App\Plugins\SparkShs\Http\Controllers\SparkShsCredentialController;
use App\Plugins\SparkShs\Http\Controllers\SparkShsKitComponentController;
use App\Plugins\SparkShs\Http\Controllers\SparkShsSyncController;
use Illuminate\Support\Facades\Route;

// The credentials and sync rules are company configuration: settings permission only.
Route::group(['prefix' => 'spark-shs', 'middleware' => ['auth:api', 'permission:settings']], function () {
    Route::group(['prefix' => 'credentials'], function () {
        Route::get('/', [SparkShsCredentialController::class, 'show']);
        Route::put('/', [SparkShsCredentialController::class, 'update']);
        Route::post('/check', [SparkShsCredentialController::class, 'check']);
    });
    Route::group(['prefix' => 'sync'], function () {
        Route::get('/settings', [SparkShsSyncController::class, 'showSettings']);
        Route::put('/settings', [SparkShsSyncController::class, 'updateSettings']);
        Route::post('/', [SparkShsSyncController::class, 'sync']);
        Route::get('/kit-type-mappings', [SparkShsSyncController::class, 'listMappings']);
        Route::post('/kit-type-mappings', [SparkShsSyncController::class, 'storeMapping']);
        Route::put('/kit-type-mappings/{mapping}', [SparkShsSyncController::class, 'updateMapping']);
        Route::delete('/kit-type-mappings/{mapping}', [SparkShsSyncController::class, 'destroyMapping']);
    });
});

// Kit components are read alongside a solar home system, so they share its permission.
Route::group(['prefix' => 'spark-shs', 'middleware' => ['auth:api', 'permission:appliances']], function () {
    Route::get('/solar-home-systems/{solarHomeSystemId}/components', [SparkShsKitComponentController::class, 'index'])
        ->whereNumber('solarHomeSystemId');
});
