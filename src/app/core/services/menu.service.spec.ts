import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { MenuService } from './menu.service';
import { APP_CONFIG } from '../tokens/app-config.token';
import { AppConfig } from '../../config/app-config.model';

const CFG: AppConfig = { name: 'testing', production: false, apiBaseUrl: 'http://api.test/api', currency: 'AED', enableDebugLogs: false, minStartLeadDays: 2 };

describe('MenuService', () => {
  let service: MenuService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), { provide: APP_CONFIG, useValue: CFG }],
    });
    service = TestBed.inject(MenuService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('GETs /meals/ with category + meal_type params', () => {
    service.getMeals({ category: 'low-cal', meal_type: 'snack' }).subscribe((m) => expect(m.length).toBe(0));
    const req = http.expectOne((r) => r.url === 'http://api.test/api/meals/');
    expect(req.request.params.get('category')).toBe('low-cal');
    expect(req.request.params.get('meal_type')).toBe('snack');
    req.flush([]);
  });

  it('falls back to seed meals on error', () => {
    service.getMeals().subscribe((m) => expect(m.length).toBe(16));
    http.expectOne((r) => r.url === 'http://api.test/api/meals/').error(new ProgressEvent('x'));
  });
});
