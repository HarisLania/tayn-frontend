import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { authInterceptor } from './auth.interceptor';
import { AuthService } from '../services/auth.service';
import { APP_CONFIG } from '../tokens/app-config.token';
import { AppConfig } from '../../config/app-config.model';

const CFG: AppConfig = { name: 'testing', production: false, apiBaseUrl: 'http://api.test/api', currency: 'AED', enableDebugLogs: false, minStartLeadDays: 2 };

describe('authInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let auth: AuthService;

  beforeEach(() => {
    try { localStorage.clear(); } catch { /* ignore */ }
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: APP_CONFIG, useValue: CFG },
      ],
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(AuthService);
  });
  afterEach(() => httpMock.verify());

  it('attaches a Bearer token when the user is signed in', () => {
    auth.applyTokens({ access: 'my-token', refresh: 'r' }, { id: 1, email: 'a@b.com', first_name: 'A', last_name: 'B', profile: null });
    http.get('/api/subscriptions/me/').subscribe();
    const req = httpMock.expectOne('/api/subscriptions/me/');
    expect(req.request.headers.get('Authorization')).toBe('Bearer my-token');
    req.flush({});
  });

  it('leaves the request untouched when logged out', () => {
    http.get('/api/categories/').subscribe();
    const req = httpMock.expectOne('/api/categories/');
    expect(req.request.headers.has('Authorization')).toBeFalse();
    req.flush([]);
  });
});
