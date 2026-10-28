<?php

namespace App\Plugins\SparkShs\Models;

use App\Models\Appliance;
use App\Models\Base\BaseModel;
use Illuminate\Database\Eloquent\Attributes\Scope;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property      int            $id
 * @property      string         $pattern
 * @property      int|null       $appliance_id
 * @property      Carbon|null    $created_at
 * @property      Carbon|null    $updated_at
 * @property-read Appliance|null $appliance
 */
class SparkShsKitTypeMapping extends BaseModel {
    protected $table = 'spark_shs_kit_type_mappings';

    /**
     * @return BelongsTo<Appliance, $this>
     */
    public function appliance(): BelongsTo {
        return $this->belongsTo(Appliance::class);
    }

    /**
     * Patterns match anywhere in the kit type, so a longer pattern is the more specific one
     * (`spark_steady_fan` before `spark_steady`); evaluating longest first lets a variation
     * added later win over the generic rule without any manual ordering.
     *
     * @param Builder<SparkShsKitTypeMapping> $query
     *
     * @return Builder<SparkShsKitTypeMapping>
     */
    #[Scope]
    protected function inMatchingOrder(Builder $query): Builder {
        return $query->orderByRaw('CHAR_LENGTH(pattern) DESC')->orderBy('id');
    }

    /**
     * Patterns are typed by users as bare regexes; they are matched case-insensitively.
     */
    public function matches(string $kitType): bool {
        return preg_match(self::toRegex($this->pattern), $kitType) === 1;
    }

    public static function isValidPattern(string $pattern): bool {
        return @preg_match(self::toRegex($pattern), '') !== false;
    }

    private static function toRegex(string $pattern): string {
        return '~'.str_replace('~', '\~', $pattern).'~i';
    }
}
