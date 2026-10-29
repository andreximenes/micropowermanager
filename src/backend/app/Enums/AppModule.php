<?php

declare(strict_types=1);

namespace App\Enums;

/**
 * An optional area of the web app a company can switch on in its settings.
 * Stored in `main_settings.enabled_modules`; a company with none listed runs without them.
 */
enum AppModule: string {
    /** Meters and meter types */
    case Meters = 'meters';
    /** Tariffs */
    case Tariffs = 'tariffs';
    /** Connection groups and connection types */
    case Connections = 'connections';
    /** SMS messages and SMS settings */
    case Sms = 'sms';
    /** E-bikes */
    case EBikes = 'e-bikes';
    /** Targets */
    case Targets = 'targets';
    /** Maintenance */
    case Maintenance = 'maintenance';
    /** Mini-grid dashboards */
    case MiniGrids = 'mini-grids';
}
