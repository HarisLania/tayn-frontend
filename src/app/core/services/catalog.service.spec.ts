import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { CatalogService } from './catalog.service';
import { APP_CONFIG } from '../tokens/app-config.token';
import { AppConfig } from '../../config/app-config.model';

const CFG: AppConfig = { name: 'testing', production: false, apiBaseUrl: 'http://api.test/api', currency: 'AED', enableDebugLogs: false, minStartLeadDays: 2 };

describe('CatalogService', () => {
  let service: CatalogService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), { provide: APP_CONFIG, useValue: CFG }],
    });
    service = TestBed.inject(CatalogService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('turns /plans/ into cards carrying the per-meal rate', () => {
    service.getPlanCards().subscribe((cards) => {
      expect(cards.length).toBe(1);
      expect(cards[0].slug).toBe('standard');
      expect(cards[0].pricePerMeal).toBe(40);
      expect(cards[0].planId).toBe(11);
      expect(cards[0].kcalRange).toContain('kcal'); // from metadata merge
    });
    http.expectOne('http://api.test/api/plans/').flush([{
      id: 11, category: { id: 1, name: 'Standard', slug: 'standard', description: '' },
      name: 'Standard', price_per_meal: '40.00', is_active: true,
    }]);
  });

  it('falls back to seed data when the endpoint errors', () => {
    service.getPlanCards().subscribe((cards) => {
      expect(cards.length).toBe(4);
      expect(cards.map((c) => c.pricePerMeal)).toEqual([40, 35, 50, 75]);
    });
    http.expectOne('http://api.test/api/plans/').error(new ProgressEvent('x'));
  });
});
