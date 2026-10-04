import { Component, inject, OnInit } from '@angular/core';
import { Header } from '../header/header';
import { Hero } from '../hero/hero';
import { WhySteg } from '../why-steg/why-steg';
import { Stats } from '../stats/stats';
import { Domains } from '../domains/domains';
import { Offers } from '../offers/offers';
import { Footer } from '../footer/footer';
import { OffersService } from '../../core/services/offers.service';

@Component({
  selector: 'app-landing-page',
  standalone: true,
  imports: [Header, Hero, WhySteg, Stats, Domains, Offers, Footer],
  template: `
    <app-landing-header />
    <main>
      <app-hero />
      <app-why-steg />
      <app-stats />
      <app-domains />
      <app-offers />
    </main>
    <app-landing-footer />
  `,
})
export class LandingPage implements OnInit {
  private readonly offersService = inject(OffersService);

  ngOnInit(): void {
    void this.offersService.load();
  }
}
