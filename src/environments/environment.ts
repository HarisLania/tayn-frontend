// Production environment (used when building/serving with --configuration production)
// This file REPLACES environment.development.ts at build time (see angular.json fileReplacements).
import { productionConfig } from '../app/config/config.production';
import { AppConfig } from '../app/config/app-config.model';

export const environment: AppConfig = {
  ...productionConfig,
  production: true,
};
