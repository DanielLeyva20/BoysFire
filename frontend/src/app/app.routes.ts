import { Routes } from '@angular/router';

/** Cada página se carga solo al entrar: el mapa y los gráficos pesan y no se necesitan a la vez. */
export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    title: 'Mapa · BoysFire',
    loadComponent: () => import('./features/map/map-page').then((module) => module.MapPage),
  },
  {
    path: 'calendario',
    title: 'Calendario · BoysFire',
    loadComponent: () => import('./features/calendar/calendar-page').then((module) => module.CalendarPage),
  },
  {
    path: 'linea-de-tiempo',
    title: 'Línea de tiempo · BoysFire',
    loadComponent: () => import('./features/timeline/timeline-page').then((module) => module.TimelinePage),
  },
  {
    path: 'estadisticas',
    title: 'Estadísticas · BoysFire',
    loadComponent: () => import('./features/stats/stats-page').then((module) => module.StatsPage),
  },
  { path: '**', redirectTo: '' },
];
