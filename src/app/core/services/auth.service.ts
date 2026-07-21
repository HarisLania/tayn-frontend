import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { APP_CONFIG } from '../tokens/app-config.token';
import { AuthResponse, JwtTokens, LoginRequest, RegisterRequest, User } from '../models';

/**
 * True only when the backend could not be reached at all (network down, CORS,
 * DNS), meaning `status === 0`. Any real HTTP response, including 401/400, is the
 * server actively answering and must NOT be masked by demo mode.
 */
function isUnreachable(err: unknown): boolean {
  return err instanceof HttpErrorResponse && err.status === 0;
}

const ACCESS_KEY = 'tayn_access';
const REFRESH_KEY = 'tayn_refresh';
const USER_KEY = 'tayn_user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(APP_CONFIG);
  private get api(): string { return this.config.apiBaseUrl; }

  private readonly _user = signal<User | null>(this.restore(USER_KEY));
  private readonly _access = signal<string | null>(this.get(ACCESS_KEY));
  private readonly _refresh = signal<string | null>(this.get(REFRESH_KEY));

  readonly user = this._user.asReadonly();
  readonly isLoggedIn = computed(() => this._access() !== null);
  readonly accessToken = this._access.asReadonly();

  /** Convenience: user's display name. */
  readonly displayName = computed(() => {
    const u = this._user();
    if (!u) return '';
    return [u.first_name, u.last_name].filter(Boolean).join(' ') || u.email;
  });

  /**
   * POST /auth/login/ → { user, tokens }.
   * Falls back to a demo login ONLY when the backend is unreachable. A real
   * rejection (e.g. 401 "Invalid email or password.") propagates so the user
   * sees the error instead of being silently signed in with bad credentials.
   */
  login(credentials: LoginRequest): Observable<User> {
    return this.http.post<AuthResponse>(`${this.api}/auth/login/`, credentials).pipe(
      catchError((err) => isUnreachable(err) ? of(this.demoAuth(credentials.email)) : throwError(() => err)),
      tap((res) => this.persist(res)),
      map((res) => res.user),
    );
  }

  /**
   * POST /auth/register/ → { user, tokens }.
   * Same rule as login: only demo-fall-back when the backend is unreachable, so
   * a genuine rejection (duplicate email, password mismatch) surfaces to the UI.
   */
  register(body: RegisterRequest): Observable<User> {
    return this.http.post<AuthResponse>(`${this.api}/auth/register/`, body).pipe(
      catchError((err) => isUnreachable(err) ? of(this.demoAuth(body.email, body.name)) : throwError(() => err)),
      tap((res) => this.persist(res)),
      map((res) => res.user),
    );
  }

  /** GET /auth/me/: refresh the cached user from the server. */
  me(): Observable<User | null> {
    return this.http.get<User>(`${this.api}/auth/me/`).pipe(
      tap((user) => { this._user.set(user); this.set(USER_KEY, JSON.stringify(user)); }),
      catchError(() => of(this._user())),
    );
  }

  /** POST /auth/logout/ (blacklist refresh) then clear local state. */
  logout(): void {
    const refresh = this._refresh();
    if (refresh) {
      this.http.post(`${this.api}/auth/logout/`, { refresh }).pipe(catchError(() => of(null))).subscribe();
    }
    this._user.set(null);
    this._access.set(null);
    this._refresh.set(null);
    [ACCESS_KEY, REFRESH_KEY, USER_KEY].forEach((k) => this.remove(k));
  }

  /** Store tokens returned by the checkout flow for a brand-new account. */
  applyTokens(tokens: JwtTokens, user: User): void {
    this.persist({ tokens, user });
  }

  // ---- helpers ----
  private persist(res: AuthResponse): void {
    this._user.set(res.user);
    this._access.set(res.tokens.access);
    this._refresh.set(res.tokens.refresh);
    this.set(ACCESS_KEY, res.tokens.access);
    this.set(REFRESH_KEY, res.tokens.refresh);
    this.set(USER_KEY, JSON.stringify(res.user));
  }

  private demoAuth(email: string, name = ''): AuthResponse {
    const base = name || email.split('@')[0] || 'Member';
    const [first, ...rest] = base.split(' ');
    return {
      tokens: { access: 'demo-access', refresh: 'demo-refresh' },
      user: {
        id: 0,
        email,
        first_name: first.charAt(0).toUpperCase() + first.slice(1),
        last_name: rest.join(' '),
        profile: null,
      },
    };
  }

  private restore(key: string): User | null {
    const raw = this.get(key);
    return raw ? (JSON.parse(raw) as User) : null;
  }
  private get(k: string): string | null { try { return localStorage.getItem(k); } catch { return null; } }
  private set(k: string, v: string): void { try { localStorage.setItem(k, v); } catch { /* ignore */ } }
  private remove(k: string): void { try { localStorage.removeItem(k); } catch { /* ignore */ } }
}
