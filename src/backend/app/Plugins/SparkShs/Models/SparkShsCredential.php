<?php

namespace App\Plugins\SparkShs\Models;

use App\Models\Base\BaseModel;
use Illuminate\Support\Carbon;

/**
 * @property int         $id
 * @property string      $auth_url
 * @property string      $api_url
 * @property string      $audience
 * @property string      $client_id
 * @property string      $client_secret
 * @property string|null $access_token
 * @property Carbon|null $access_token_expires_at
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
class SparkShsCredential extends BaseModel {
    protected $table = 'spark_shs_credentials';

    /**
     * The secret and the portal token never leave the server; `has_client_secret` tells the UI one is stored.
     *
     * @var list<string>
     */
    protected $hidden = ['client_secret', 'access_token', 'access_token_expires_at'];

    /** @var list<string> */
    protected $appends = ['has_client_secret'];

    public function getHasClientSecretAttribute(): bool {
        return filled($this->client_secret);
    }

    public function audienceUrl(): string {
        return config('spark-shs.audiences')[$this->audience];
    }
}
