import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CatalogService } from '../../core/services/catalog.service';
import { PlanCard } from '../../core/models';
import { DELIVERY_EMIRATES } from '../../core/data/seed.data';

interface HowStep { num: string; title: string; text: string; icon: string; }
interface Testimonial { stars: number; quote: string; name: string; location: string; plan: string; }

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class Home {
  private readonly catalog = inject(CatalogService);

  readonly plans = signal<PlanCard[]>([]);
  readonly emirates = DELIVERY_EMIRATES;

  readonly steps: HowStep[] = [
    { num: '01', title: 'Choose Your Plan', icon: '📋', text: 'Pick from four nutritionist-designed programs matching your health goals, whether that\'s losing weight, gaining muscle, or eating balanced.' },
    { num: '02', title: 'Select Your Days', icon: '📅', text: 'Tell us which days of the week work for you. Want 5 days on, weekends off? Done. Full week? Even better.' },
    { num: '03', title: 'We Cook & Deliver', icon: '→', text: 'Our chefs prepare your meals fresh each morning. Packed in eco-conscious containers, delivered to your door by 7am.' },
  ];

  readonly testimonials: Testimonial[] = [
    { stars: 5, quote: 'I\'ve been on the Protein Power plan for three months and my performance in the gym has completely transformed. The meals are genuinely delicious, not typical "diet food" at all. I look forward to opening that box every morning.', name: 'Sarah Al Mansoori', location: 'Dubai Marina', plan: 'Protein Power' },
    { stars: 5, quote: 'Lost 9kg over 4 months and never once felt deprived. Delivery is always by 7am, and I haven\'t had to think about lunch prep in months. Tayn genuinely changed how I think about food.', name: 'Ahmed Khalil', location: 'Abu Dhabi, Khalidiyah', plan: 'Low Cal' },
    { stars: 5, quote: 'The variety is incredible. I never eat the same thing twice in a week. Packaging is premium and eco-friendly. It feels like a luxury service at a completely fair price.', name: 'Nadia Rashid', location: 'Sharjah, Al Nahda', plan: 'Standard' },
  ];

  constructor() {
    this.catalog.getPlanCards().subscribe((p) => this.plans.set(p));
  }
}
