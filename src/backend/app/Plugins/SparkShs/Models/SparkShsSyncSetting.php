<?php

namespace App\Plugins\SparkShs\Models;

use App\Models\Base\BaseModel;
use Illuminate\Support\Carbon;

/**
 * @property int                       $id
 * @property bool                      $is_enabled
 * @property int                       $interval_hours
 * @property Carbon|null               $last_sync_at
 * @property string|null               $last_sync_status
 * @property array<string, mixed>|null $last_sync_result
 * @property Carbon|null               $created_at
 * @property Carbon|null               $updated_at
 */
class SparkShsSyncSetting extends BaseModel {
    public const STATUS_SUCCESS = 'success';
    public const STATUS_FAILED = 'failed';

    protected $table = 'spark_shs_sync_settings';

    protected $casts = [
        'is_enabled' => 'boolean',
        'interval_hours' => 'integer',
        'last_sync_at' => 'datetime',
        'last_sync_result' => 'array',
    ];
}
