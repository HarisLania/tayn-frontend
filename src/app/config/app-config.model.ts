/**
 * Shared shape for every environment / deployment config.
 * Inject the active instance with the APP_CONFIG token (see core/tokens).
 */
export interface AppConfig {
  /** Human-readable name of the active configuration. */
  name: 'testing' | 'production';
  /** Whether Angular production mode is enabled. */
  production: boolean;
  /** Base URL of the REST API, e.g. http://127.0.0.1:8000/api */
  apiBaseUrl: string;
  /** Currency code shown across the UI. */
  currency: string;
  /** Toggle verbose logging in services. */
  enableDebugLogs: boolean;
  /**
   * Kitchen lead time in days. Mirrors the backend's MIN_START_LEAD_DAYS.
   * The wizard offers no start date earlier than today + this, because
   * `validate_start_date` would reject it.
   */
  minStartLeadDays: number;
}
