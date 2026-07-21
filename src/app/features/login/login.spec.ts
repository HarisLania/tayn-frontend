import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';
import { convertToParamMap } from '@angular/router';
import { throwError } from 'rxjs';
import { Login } from './login';
import { AuthService } from '../../core/services/auth.service';
import { APP_CONFIG } from '../../core/tokens/app-config.token';
import { AppConfig } from '../../config/app-config.model';

const CFG: AppConfig = { name: 'testing', production: false, apiBaseUrl: 'http://api.test/api', currency: 'AED', enableDebugLogs: false, minStartLeadDays: 2 };

function activatedRouteStub(redirect: string | null) {
  return { snapshot: { queryParamMap: convertToParamMap(redirect ? { redirect } : {}) } };
}

describe('Login', () => {
  let http: HttpTestingController;

  async function setup(redirect: string | null = null) {
    await TestBed.configureTestingModule({
      imports: [Login],
      providers: [
        provideHttpClient(), provideHttpClientTesting(), provideRouter([]),
        { provide: APP_CONFIG, useValue: CFG },
        { provide: ActivatedRoute, useValue: activatedRouteStub(redirect) },
      ],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(Login);
    fixture.detectChanges();
    return fixture;
  }

  afterEach(() => http.verify());

  it('does not submit an invalid form', async () => {
    const fixture = await setup();
    fixture.componentInstance.submit();
    expect(fixture.componentInstance.form.get('email')!.touched).toBeTrue();
    http.expectNone(() => true);
  });

  it('logs in and navigates to /subscription by default', async () => {
    const fixture = await setup();
    const router = TestBed.inject(Router);
    const navSpy = spyOn(router, 'navigateByUrl');

    fixture.componentInstance.form.setValue({ email: 'a@b.com', password: 'secret' });
    fixture.componentInstance.submit();
    http.expectOne('http://api.test/api/auth/login/').flush({
      user: { id: 1, email: 'a@b.com', first_name: 'A', last_name: 'B', profile: null },
      tokens: { access: 'acc', refresh: 'ref' },
    });

    expect(navSpy).toHaveBeenCalledWith('/subscription');
    expect(fixture.componentInstance.loading()).toBeFalse();
  });

  it('honors a redirect query param on success', async () => {
    const fixture = await setup('/create-plan');
    const router = TestBed.inject(Router);
    const navSpy = spyOn(router, 'navigateByUrl');

    fixture.componentInstance.form.setValue({ email: 'a@b.com', password: 'secret' });
    fixture.componentInstance.submit();
    http.expectOne('http://api.test/api/auth/login/').flush({
      user: { id: 1, email: 'a@b.com', first_name: 'A', last_name: 'B', profile: null },
      tokens: { access: 'acc', refresh: 'ref' },
    });

    expect(navSpy).toHaveBeenCalledWith('/create-plan');
  });

  it('shows the backend message and does not navigate when credentials are rejected (401)', async () => {
    const fixture = await setup();
    const router = TestBed.inject(Router);
    const navSpy = spyOn(router, 'navigateByUrl');

    fixture.componentInstance.form.setValue({ email: 'a@b.com', password: 'wrong' });
    fixture.componentInstance.submit();
    http.expectOne('http://api.test/api/auth/login/').flush(
      { detail: 'Invalid email or password.' },
      { status: 401, statusText: 'Unauthorized' },
    );

    expect(fixture.componentInstance.loading()).toBeFalse();
    expect(fixture.componentInstance.error()).toBe('Invalid email or password.');
    expect(navSpy).not.toHaveBeenCalled();
  });

  it('falls back to a generic error message when the login observable errors without a detail', async () => {
    const fixture = await setup();
    spyOn(TestBed.inject(AuthService), 'login').and.returnValue(throwError(() => new Error('boom')));

    fixture.componentInstance.form.setValue({ email: 'a@b.com', password: 'secret' });
    fixture.componentInstance.submit();

    expect(fixture.componentInstance.loading()).toBeFalse();
    expect(fixture.componentInstance.error()).toBe('Something went wrong. Please try again.');
  });
});
