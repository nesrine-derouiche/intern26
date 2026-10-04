import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LandingService } from '../../core/services/landing.service';
import { Icon } from '../../shared/components/icon/icon';
import { OfferCard } from '../../shared/components/offer-card/offer-card';
import { RevealDirective } from '../../shared/directives/reveal.directive';
import { SectionHeader } from '../../shared/components/section-header/section-header';

@Component({
  selector: 'app-offers',
  standalone: true,
  imports: [RouterLink, Icon, OfferCard, RevealDirective, SectionHeader],
  templateUrl: './offers.html',
  styles: [`
    .offers {
      padding-block: 96px;
    }

    .offers__grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 24px;
    }

    .offers__action {
      margin-top: 44px;
      text-align: center;
    }

    @media (max-width: 1024px) {
      .offers__grid {
        grid-template-columns: repeat(2, 1fr);
      }
    }

    @media (max-width: 640px) {
      .offers__grid {
        grid-template-columns: 1fr;
      }

      .offers {
        padding-block: 72px;
      }
    }
  `],
})
export class Offers {
  private readonly service = inject(LandingService);
  protected readonly offers = this.service.latestOffers;
}
