import { AppConfig } from './app-config.model';

/**
 * PRODUCTION configuration.
 * Replace apiBaseUrl with your deployed backend URL before shipping.
 */
export const productionConfig: Omit<AppConfig, 'production'> = {
  name: 'production',
  apiBaseUrl: 'https://tayn-backend.onrender.com/api',
  currency: 'AED',
  enableDebugLogs: false,
  minStartLeadDays: 2,
};
