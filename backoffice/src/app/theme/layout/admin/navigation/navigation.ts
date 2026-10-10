export interface NavigationItem {
  id: string;
  title: string;
  type: 'item' | 'collapse' | 'group';
  translate?: string;
  icon?: string;
  hidden?: boolean;
  url?: string;
  classes?: string;
  external?: boolean;
  target?: boolean;
  breadcrumbs?: boolean;
  children?: NavigationItem[];
  roles?: string[];
  isMainParent?: boolean;
}

export const NavigationItems: NavigationItem[] = [
  {
    id: 'menu',
    title: 'Menu',
    type: 'group',
    icon: 'icon-navigation',
    children: [
      {
        id: 'default',
        title: 'Tableau de bord',
        type: 'item', classes: 'nav-item', url: '/default', icon: 'ti ti-dashboard', breadcrumbs: false,
        roles: ['ADMIN', 'RH', 'ENCADRANT', 'CHEF_DEPARTEMENT']
      },
      {
        id: 'stagiaires',
        title: 'Stagiaires',
        type: 'item', classes: 'nav-item', url: '/stagiaires', icon: 'ti ti-users', breadcrumbs: false,
        roles: ['ADMIN', 'RH', 'CHEF_DEPARTEMENT']
      },
      {
        id: 'encadrants',
        title: 'Encadrants',
        type: 'item', classes: 'nav-item', url: '/encadrants', icon: 'ti ti-user-check', breadcrumbs: false,
        roles: ['ADMIN', 'RH', 'CHEF_DEPARTEMENT']
      },
      {
        id: 'taches',
        title: 'Tâches',
        type: 'item', classes: 'nav-item', url: '/taches', icon: 'ti ti-checkbox', breadcrumbs: false,
        roles: ['ADMIN', 'RH', 'ENCADRANT']
      },
      {
        id: 'stages',
        title: 'Stages',
        type: 'item', classes: 'nav-item', url: '/stages', icon: 'ti ti-school', breadcrumbs: false,
        roles: ['ADMIN', 'RH', 'ENCADRANT', 'CHEF_DEPARTEMENT']
      },
      {
        id: 'presences',
        title: 'Présences',
        type: 'item', classes: 'nav-item', url: '/presences', icon: 'ti ti-clock', breadcrumbs: false,
        roles: ['ADMIN', 'RH', 'ENCADRANT']
      },
      {
        id: 'planning',
        title: 'Planning',
        type: 'item', classes: 'nav-item', url: '/planning', icon: 'ti ti-calendar-time', breadcrumbs: false,
        roles: ['ADMIN', 'RH', 'ENCADRANT', 'CHEF_DEPARTEMENT']
      },
      {
        id: 'reunions',
        title: 'Réunions',
        type: 'item', classes: 'nav-item', url: '/reunions', icon: 'ti ti-calendar', breadcrumbs: false,
        roles: ['ADMIN', 'RH', 'ENCADRANT', 'CHEF_DEPARTEMENT']
      },
      {
        id: 'offres',
        title: 'Offres de Stage',
        type: 'item', classes: 'nav-item', url: '/offres', icon: 'ti ti-file-text', breadcrumbs: false,
        roles: ['ADMIN', 'RH']
      },
      {
        id: 'candidatures',
        title: 'Candidatures',
        type: 'item', classes: 'nav-item', url: '/candidatures', icon: 'ti ti-send', breadcrumbs: false,
        roles: ['ADMIN', 'RH']
      },
      {
        id: 'evaluations',
        title: 'Évaluations',
        type: 'item', classes: 'nav-item', url: '/evaluations', icon: 'ti ti-star', breadcrumbs: false,
        roles: ['ADMIN', 'RH', 'ENCADRANT']
      },
      {
        id: 'departements',
        title: 'Départements',
        type: 'item', classes: 'nav-item', url: '/departements', icon: 'ti ti-building', breadcrumbs: false,
        roles: ['ADMIN', 'RH']
      },
      {
        id: 'templates',
        title: 'Templates',
        type: 'item', classes: 'nav-item', url: '/templates', icon: 'ti ti-template', breadcrumbs: false,
        roles: ['ADMIN', 'RH']
      },
      {
        id: 'certifications',
        title: 'Certifications',
        type: 'item', classes: 'nav-item', url: '/certifications', icon: 'ti ti-award', breadcrumbs: false,
        roles: ['ADMIN', 'RH', 'ENCADRANT']
      }
    ]
  }
];

