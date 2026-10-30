<?php

namespace App\Plugins\SparkShs\Models;

use App\Models\Base\BaseModel;
use App\Models\SolarHomeSystem;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * A device connected to a Spark kit (a screen or a battery), as listed by the Spark portal.
 *
 * @property      int             $id
 * @property      int             $solar_home_system_id
 * @property      string          $serial
 * @property      string          $type
 * @property      Carbon|null     $created_at
 * @property      Carbon|null     $updated_at
 * @property-read SolarHomeSystem $solarHomeSystem
 */
class SparkShsKitComponent extends BaseModel {
    protected $table = 'spark_shs_kit_components';

    /**
     * @return BelongsTo<SolarHomeSystem, $this>
     */
    public function solarHomeSystem(): BelongsTo {
        return $this->belongsTo(SolarHomeSystem::class);
    }
}
