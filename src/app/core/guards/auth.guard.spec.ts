import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, UrlTree } from '@angular/router';
import { provideRouter } from '@angular/router';
import { authGuard } from './auth.guard';
import { AuthService } from '../services/auth.service';
import { APP_CONFIG } from '../tokens/app-config.token';
import { AppConfig } from '../../config/app-config.model';

const CFG: AppConfig = { name: 'testing', production: false, apiBaseUrl: 'http://api.test/api', currency: 'AED', enableDebugLogs: false, minStartLeadDays: 2 };

describe('authGuard', () => {
  let auth: AuthService;
  let router: Router;

  beforeEach(() => {
    try { localStorage.clear(); } catch { /* ignore */ }
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(), provideHttpClientTesting(), provideRouter([]),
        { provide: APP_CONFIG, useValue: CFG },
      ],
    });
    auth = TestBed.inject(AuthService);
    router = TestBed.inject(Router);
  });

  it('allows navigation when the user is logged in', () => {
    auth.applyTokens({ access: 'a', refresh: 'r' }, { id: 1, email: 'a@b.com', first_name: 'A', last_name: 'B', profile: null });
    const result = TestBed.runInInjectionContext(() =>
      authGuard({} as never, { url: '/subscription' } as never),
    );
    expect(result).toBe(true);
  });

  it('redirects to /login with a redirect query param when logged out', () => {
    const result = TestBed.runInInjectionContext(() =>
      authGuard({} as never, { url: '/subscription' } as never),
    ) as UrlTree;
    expect(result).toBeInstanceOf(UrlTree);
    expect(router.serializeUrl(result)).toBe('/login?redirect=%2Fsubscription');
  });
});
