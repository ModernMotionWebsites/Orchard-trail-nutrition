<?php
/*
 * Orchard Trail Nutrition — database settings.
 *
 * Copy this file to config.php on the server and fill in the four MySQL
 * values from GoDaddy cPanel -> Databases -> MySQL Databases.
 * config.php is blocked from the browser by .htaccess and is never sent to
 * the page visitor.
 */

return [
    // 'mysql' on GoDaddy. 'sqlite' only exists for local testing.
    'driver' => 'mysql',

    'mysql' => [
        'host' => 'localhost',          // cPanel usually shows this as "localhost"
        'name' => 'cpaneluser_otn',     // the database name cPanel created
        'user' => 'cpaneluser_otn',     // the database user cPanel created
        'pass' => 'PUT-THE-PASSWORD-HERE',
        'port' => 3306,
    ],

    // Local testing only (driver = 'sqlite'): a single file path.
    'sqlite_path' => __DIR__ . '/data/local.sqlite',

    // The public address of the website, used in the sitemap and robot file.
    'site_url' => 'https://orchardtrailnutrition.com',

    // A private random string; it makes the anonymous visitor counting
    // numbers impossible to reverse. Change it once and leave it alone.
    'analytics_salt' => 'change-this-to-any-long-random-text',

    // Where the dashboard lives. '/admin' keeps the familiar address.
    'admin_path' => '/admin',
];
