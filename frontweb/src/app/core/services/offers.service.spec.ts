import { TestBed } from '@angular/core/testing';
import { OffersService } from './offers.service';
import { OffersApiService, PublicOffersQuery } from './offers-api.service';
import { LandingOffer, Paginated } from '../models/landing.models';

function makeOffer(id: string, titre: string, partial: Partial<LandingOffer> = {}): LandingOffer {
  return {
    id,
    titre,
    departement: "Direction des Systèmes d'Information",
    departementId: 'd1',
    description: '',
    duree: '5 mois',
    localisation: 'Tunis',
    niveau: 'Ingénieur',
    places: 2,
    dateLimite: '2026-08-20',
    competences: [],
    missions: [],
    technologies: [],
    documents: [],
    encadrant: null,
    ...partial,
  };
}

const CATALOG: LandingOffer[] = [
  makeOffer('1', 'Développeur Web', {
    departement: 'DSI',
    departementId: 'd1',
    dateLimite: '2026-08-20',
  }),
  makeOffer('2', 'Analyste Data', {
    departement: 'Finances',
    departementId: 'd2',
    localisation: 'Sfax',
    niveau: 'Master',
    duree: '6 mois',
    dateLimite: '2026-08-10',
  }),
  makeOffer('3', 'Technicien Réseaux', {
    departement: 'DSI',
    departementId: 'd1',
    localisation: 'Sfax',
    niveau: 'Technicien',
    dateLimite: '2026-09-01',
  }),
];

const BIG_CATALOG: LandingOffer[] = Array.from({ length: 12 }, (_, i) =>
  makeOffer(String(i + 1), `Offre ${i + 1}`, {
    dateLimite: `2026-08-${String((i % 28) + 1).padStart(2, '0')}`,
  }),
);

function months(duree: string): number {
  const match = duree.match(/\d+/);
  return match ? Number.parseInt(match[0], 10) : 0;
}

/** Équivalent front de l'extension Postgres `unaccent` utilisée par l'API. */
function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/** Simule le comportement de `GET /api/public/offres` (filtres + tri + pagination). */
function serverList(catalog: LandingOffer[] = CATALOG) {
  return (query: PublicOffersQuery = {}): Promise<Paginated<LandingOffer>> => {
    let data = [...catalog];
    const term = normalize(query.search ?? '');
    if (term) {
      data = data.filter(
        (o) => normalize(o.titre).includes(term) || normalize(o.departement).includes(term),
      );
    }
    if (query.departementId) data = data.filter((o) => o.departementId === query.departementId);
    if (query.niveau) data = data.filter((o) => o.niveau === query.niveau);
    if (query.localisation) data = data.filter((o) => o.localisation === query.localisation);

    const sort = query.sort ?? 'deadline';
    if (sort === 'deadline') data.sort((a, b) => a.dateLimite.localeCompare(b.dateLimite));
    if (sort === 'recent') data.sort((a, b) => b.dateLimite.localeCompare(a.dateLimite));
    if (sort === 'duration') data.sort((a, b) => months(b.duree) - months(a.duree));
    if (sort === 'places') data.sort((a, b) => b.places - a.places);

    const page = query.page ?? 1;
    const limit = query.limit ?? 9;
    const start = (page - 1) * limit;
    return Promise.resolve({
      data: data.slice(start, start + limit),
      total: data.length,
      page,
      pages: Math.max(1, Math.ceil(data.length / limit)),
    });
  };
}

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
const waitDebounce = () => new Promise<void>((resolve) => setTimeout(resolve, 350));

describe('OffersService', () => {
  let service: OffersService;
  let api: {
    list: ReturnType<typeof vi.fn>;
    getById: ReturnType<typeof vi.fn>;
    apply: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    api = {
      list: vi.fn(),
      getById: vi.fn(),
      apply: vi.fn(),
    };
    api.list.mockImplementation(serverList());
    TestBed.configureTestingModule({
      providers: [{ provide: OffersApiService, useValue: api }],
    });
    service = TestBed.inject(OffersService);
  });

  it('charge le catalogue complet et la première page', async () => {
    await service.load();
    expect(service.allOffers().length).toBe(3);
    expect(service.totalResults()).toBe(3);
    expect(service.pageOffers().length).toBe(3);
    expect(service.departementOptions()).toEqual([
      { id: 'd1', nom: 'DSI' },
      { id: 'd2', nom: 'Finances' },
    ]);
  });

  it('envoie la recherche au serveur après le délai d’attente', async () => {
    await service.load();
    service.setSearch('developpeur');
    await waitDebounce();
    expect(api.list).toHaveBeenCalledWith(expect.objectContaining({ search: 'developpeur' }));
    expect(service.totalResults()).toBe(1);
    expect(service.pageOffers()[0].titre).toBe('Développeur Web');
  });

  it('recherche insensible à la casse', async () => {
    await service.load();
    service.setSearch('DATA');
    await waitDebounce();
    expect(service.totalResults()).toBe(1);
    expect(service.pageOffers()[0].titre).toBe('Analyste Data');
  });

  it('filtre par département et niveau via la base', async () => {
    await service.load();
    service.setDepartment('d1');
    await flush();
    service.setNiveau('Technicien');
    await flush();
    expect(api.list).toHaveBeenCalledWith(expect.objectContaining({ departementId: 'd1' }));
    expect(api.list).toHaveBeenCalledWith(expect.objectContaining({ niveau: 'Technicien' }));
    expect(service.totalResults()).toBe(1);
    expect(service.pageOffers()[0].id).toBe('3');
  });

  it('tri côté serveur par durée décroissante', async () => {
    await service.load();
    service.setSort('duration');
    await flush();
    expect(api.list).toHaveBeenCalledWith(expect.objectContaining({ sort: 'duration' }));
    expect(service.pageOffers().map((o) => o.id)).toEqual(['2', '1', '3']);
  });

  it('pagine côté serveur avec 9 offres par page', async () => {
    api.list.mockImplementation(serverList(BIG_CATALOG));
    await service.load();
    expect(service.totalPages()).toBe(2);
    expect(service.pageOffers().length).toBe(9);

    service.goToPage(2);
    await flush();
    expect(api.list).toHaveBeenCalledWith(expect.objectContaining({ page: 2, limit: 9 }));
    expect(service.pageOffers().length).toBe(3);
  });

  it('réinitialise les filtres', async () => {
    await service.load();
    service.setDepartment('d1');
    await flush();
    expect(service.hasActiveFilters()).toBe(true);

    service.reset();
    await flush();
    expect(service.hasActiveFilters()).toBe(false);
    expect(service.totalResults()).toBe(3);
  });

  it('expose les dernières offres triées par échéance', async () => {
    await service.load();
    expect(service.latestOffers().map((o) => o.id)).toEqual(['2', '1', '3']);
  });

  it('retourne une offre par identifiant', async () => {
    await service.load();
    expect(service.getById('2')?.titre).toBe('Analyste Data');
    expect(service.getById('999')).toBeUndefined();
  });

  it('signale une erreur si le chargement échoue', async () => {
    api.list.mockRejectedValue(new Error('Réseau indisponible'));
    await service.load();
    expect(service.error()).toBe('Réseau indisponible');
    expect(service.pageOffers().length).toBe(0);
  });
});
