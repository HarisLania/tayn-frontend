// Development / testing environment (default). Points at the local backend.
import { testingConfig } from '../app/config/config.testing';
import { AppConfig } from '../app/config/app-config.model';

export const environment: AppConfig = {
  ...testingConfig,
  production: false,
};
