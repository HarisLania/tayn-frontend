import { InjectionToken } from '@angular/core';
import { AppConfig } from '../../config/app-config.model';
import { environment } from '../../../environments/environment';

/**
 * DI token for the active application configuration.
 * Provided in app.config.ts from the current environment.
 */
export const APP_CONFIG = new InjectionToken<AppConfig>('APP_CONFIG', {
  providedIn: 'root',
  factory: () => environment,
});
