import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./features/home/home').then((m) => m.Home),
    title: 'Tayn | Premium Meal Plans',
  },
  {
    path: 'menu',
    loadComponent: () => import('./features/menu/menu').then((m) => m.Menu),
    title: 'Menu | Tayn',
  },
  {
    path: 'login',
    loadComponent: () => import('./features/login/login').then((m) => m.Login),
    title: 'Log In | Tayn',
  },
  {
    path: 'create-plan',
    loadComponent: () =>
      import('./features/create-plan/create-plan').then((m) => m.CreatePlan),
    title: 'Create My Plan | Tayn',
  },
  {
    path: 'subscription',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/subscription/subscription').then((m) => m.SubscriptionPage),
    title: 'My Subscription | Tayn',
  },
  { path: '**', redirectTo: '' },
];
