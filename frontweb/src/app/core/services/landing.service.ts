import { Injectable, inject, signal } from '@angular/core';
import { LandingDomain, LandingStat, WhyPoint } from '../models/landing.models';
import { OffersService } from './offers.service';

/**
 * Couche de données du landing public.
 *
 * Les offres « dernières » sont fournies par le catalogue
 * partagé (`OffersService`).
 */
@Injectable({ providedIn: 'root' })
export class LandingService {
  private readonly offersService = inject(OffersService);

  readonly latestOffers = this.offersService.latestOffers;

  private readonly statsData: LandingStat[] = [
    { value: 420, suffix: '+', label: 'Stages proposés', icon: 'briefcase' },
    { value: 24, suffix: '', label: 'Directions & départements', icon: 'building' },
    { value: 3800, suffix: '+', label: 'Stagiaires formés', icon: 'users' },
    { value: 96, suffix: '%', label: 'Taux de satisfaction', icon: 'trending-up' },
  ];

  private readonly domainsData: LandingDomain[] = [
    {
      id: 'informatique',
      titre: 'Informatique & Digital',
      description:
        'Développement web, data, cybersécurité et transformation numérique des services.',
      nbStages: 86,
      icon: 'code',
      color: 'var(--color-primary)',
    },
    {
      id: 'electrotechnique',
      titre: 'Électrotechnique & Énergie',
      description:
        'Production, transport et distribution : le cœur de métier de la STEG.',
      nbStages: 120,
      icon: 'zap',
      color: 'var(--color-warning)',
    },
    {
      id: 'electromecanique',
      titre: 'Électromécanique',
      description:
        'Maintenance industrielle, GMAO et optimisation des équipements de production.',
      nbStages: 64,
      icon: 'wrench',
      color: 'var(--color-teal)',
    },
    {
      id: 'renouvelables',
      titre: 'Énergies Renouvelables',
      description:
        'Solaire, éolien et efficacité énergétique : la STEG prépare la transition.',
      nbStages: 74,
      icon: 'rocket',
      color: 'var(--color-violet)',
    },
    {
      id: 'finances',
      titre: 'Finances & Contrôle de Gestion',
      description:
        'Gestion budgétaire, analyse financière et audit des projets d\'investissement.',
      nbStages: 42,
      icon: 'calculator',
      color: 'var(--color-primary-dark)',
    },
    {
      id: 'reseaux',
      titre: 'Réseaux & Télécoms',
      description:
        'Infrastructures critiques, téléconduite et supervision des systèmes de communication.',
      nbStages: 34,
      icon: 'network',
      color: 'var(--color-danger)',
    },
  ];

  private readonly whyData: WhyPoint[] = [
    {
      icon: 'graduation-cap',
      titre: 'Apprentissage encadré',
      description:
        'Un tuteur dédié vous accompagne tout au long du stage avec des objectifs clairs et des évaluations régulières.',
    },
    {
      icon: 'briefcase',
      titre: 'Expérience terrain réelle',
      description:
        'Des missions concrètes au cœur des métiers de l\'énergie, de la production à la transformation digitale.',
    },
    {
      icon: 'users',
      titre: 'Réseau professionnel',
      description:
        'Échangez avec des centaines d\'ingénieurs et de techniciens experts et construisez votre carrière.',
    },
    {
      icon: 'award',
      titre: 'Attestation & valorisation',
      description:
        'Une attestation de stage reconnue et l\'opportunité d\'intégrer le vivier de recrutement de la STEG.',
    },
  ];

  /** Offres exposées en lecture seule via un signal. */
  readonly stats = signal<LandingStat[]>(this.statsData);
  readonly domains = signal<LandingDomain[]>(this.domainsData);
  readonly whyPoints = signal<WhyPoint[]>(this.whyData);
}
