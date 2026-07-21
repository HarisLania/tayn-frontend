import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AuthService } from './auth.service';
import { APP_CONFIG } from '../tokens/app-config.token';
import { AppConfig } from '../../config/app-config.model';

const CFG: AppConfig = { name: 'testing', production: false, apiBaseUrl: 'http://api.test/api', currency: 'AED', enableDebugLogs: false, minStartLeadDays: 2 };
const USER = { id: 1, email: 'a@b.com', first_name: 'A', last_name: 'B', profile: null };
const TOKENS = { access: 'acc', refresh: 'ref' };

describe('AuthService', () => {
  let service: AuthService;
  let http: HttpTestingController;

  beforeEach(() => {
    try { localStorage.clear(); } catch { /* ignore */ }
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), { provide: APP_CONFIG, useValue: CFG }],
    });
    service = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('starts logged out', () => expect(service.isLoggedIn()).toBeFalse());

  it('logs in via POST /auth/login/ and stores the access token', () => {
    service.login({ email: 'a@b.com', password: 'secret' }).subscribe((u) => expect(u.email).toBe('a@b.com'));
    const req = http.expectOne('http://api.test/api/auth/login/');
    expect(req.request.method).toBe('POST');
    req.flush({ user: USER, tokens: TOKENS });
    expect(service.isLoggedIn()).toBeTrue();
    expect(service.accessToken()).toBe('acc');
    expect(service.displayName()).toBe('A B');
  });

  it('falls back to a demo login only when the backend is unreachable (network error)', () => {
    service.login({ email: 'demo@tayn.ae', password: 'test' }).subscribe((u) => {
      expect(u.email).toBe('demo@tayn.ae');
      expect(service.isLoggedIn()).toBeTrue();
    });
    // A ProgressEvent error surfaces as HttpErrorResponse status 0 (unreachable).
    http.expectOne('http://api.test/api/auth/login/').error(new ProgressEvent('fail'));
  });

  it('rejects and does NOT log in when the backend returns 401 for bad credentials', () => {
    let errored = false;
    service.login({ email: 'a@b.com', password: 'wrong' }).subscribe({
      next: () => fail('login should not succeed on a 401'),
      error: (err) => {
        errored = true;
        expect(err.status).toBe(401);
        expect(err.error.detail).toBe('Invalid email or password.');
      },
    });
    http.expectOne('http://api.test/api/auth/login/').flush(
      { detail: 'Invalid email or password.' },
      { status: 401, statusText: 'Unauthorized' },
    );
    expect(errored).toBeTrue();
    expect(service.isLoggedIn()).toBeFalse();
    expect(service.accessToken()).toBeNull();
  });

  it('rejects and does NOT log in when registration is refused (e.g. duplicate email)', () => {
    let errored = false;
    service.register({ name: 'A B', email: 'taken@b.com', phone: '500000000', delivery_address: 'X', password: 'password1', confirm_password: 'password1' }).subscribe({
      next: () => fail('register should not succeed on a 400'),
      error: () => { errored = true; },
    });
    http.expectOne('http://api.test/api/auth/register/').flush(
      { email: ['A user with this email already exists.'] },
      { status: 400, statusText: 'Bad Request' },
    );
    expect(errored).toBeTrue();
    expect(service.isLoggedIn()).toBeFalse();
  });

  it('clears state on logout (and blacklists the refresh token)', () => {
    service.applyTokens(TOKENS, USER);
    expect(service.isLoggedIn()).toBeTrue();
    service.logout();
    http.expectOne('http://api.test/api/auth/logout/').flush({});
    expect(service.isLoggedIn()).toBeFalse();
    expect(service.accessToken()).toBeNull();
  });
});
