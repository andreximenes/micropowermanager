<?php

return [
    'default_auth_url' => 'https://auth.ruralspark.com/oauth/token',
    'default_api_url' => 'https://platform.ruralspark.com/api/v1',
    'default_audience' => 'production',
    // Spark issues tokens per API audience; development points at the staging API,
    // which is also what a locally running Spark portal expects.
    'audiences' => [
        'production' => 'https://platform.ruralspark.com/api',
        'development' => 'https://platform-staging.ruralspark.com/api',
    ],
    'kits_page_size' => 200,
    // Development only: lets the plugin call a Spark portal over http on a private address
    // (e.g. http://host.docker.internal:3000/api/v1). Never enable it in production.
    'allow_local_api_urls' => (bool) env('SPARK_SHS_ALLOW_LOCAL_API_URLS', false),
];
