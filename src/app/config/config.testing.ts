import { AppConfig } from './app-config.model';

/**
 * TESTING configuration.
 * Uses the local backend running via `python manage.py runserver`
 * (docs at http://127.0.0.1:8000/api/docs/).
 *
 * apiBaseUrl is relative (not http://127.0.0.1:8000/api) so requests stay
 * same-origin through the dev server and go through proxy.conf.json,
 * the Django backend does not currently send CORS headers, so a direct
 * cross-origin fetch from `ng serve` is blocked by the browser and every
 * call would silently fall back to bundled seed data instead of hitting
 * the real API.
 */
export const testingConfig: Omit<AppConfig, 'production'> = {
  name: 'testing',
  apiBaseUrl: '/api',
  currency: 'AED',
  enableDebugLogs: true,
  minStartLeadDays: 2,
};
