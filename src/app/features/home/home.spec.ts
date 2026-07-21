import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { Home } from './home';
import { APP_CONFIG } from '../../core/tokens/app-config.token';
import { AppConfig } from '../../config/app-config.model';

const CFG: AppConfig = { name: 'testing', production: false, apiBaseUrl: 'http://api.test/api', currency: 'AED', enableDebugLogs: false, minStartLeadDays: 2 };

describe('Home', () => {
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Home],
      providers: [
        provideHttpClient(), provideHttpClientTesting(), provideRouter([]),
        { provide: APP_CONFIG, useValue: CFG },
      ],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('loads plan cards from the catalog on init', () => {
    const fixture = TestBed.createComponent(Home);
    fixture.detectChanges();

    http.expectOne('http://api.test/api/plans/').flush([{
      id: 1, category: { id: 1, name: 'Standard', slug: 'standard', description: '' },
      name: 'Standard', price_per_meal: '40.00', is_active: true,
    }]);

    expect(fixture.componentInstance.plans().length).toBe(1);
    expect(fixture.componentInstance.plans()[0].pricePerMeal).toBe(40);
  });

  it('renders one card per plan, priced per meal', () => {
    const fixture = TestBed.createComponent(Home);
    fixture.detectChanges();
    http.expectOne('http://api.test/api/plans/').error(new ProgressEvent('x'));
    fixture.detectChanges();

    const cards = fixture.nativeElement.querySelectorAll('.plan-card');
    expect(cards.length).toBe(4);                                   // seed fallback
    expect(fixture.nativeElement.textContent).toContain('/meal');
  });

  it('exposes the fixed how-it-works steps and testimonials', () => {
    const fixture = TestBed.createComponent(Home);
    fixture.detectChanges();
    http.expectOne('http://api.test/api/plans/').error(new ProgressEvent('x'));

    expect(fixture.componentInstance.steps.length).toBeGreaterThan(0);
    expect(fixture.componentInstance.testimonials.length).toBeGreaterThan(0);
  });
});
