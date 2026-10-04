import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Icon } from '../../shared/components/icon/icon';

@Component({
  selector: 'app-landing-footer',
  standalone: true,
  imports: [RouterLink, Icon],
  templateUrl: './footer.html',
  styles: [`
    .footer {
      background: #0b1526;
      color: #94a3b8;
    }

    .footer__top {
      display: grid;
      grid-template-columns: 1.4fr 1fr 1fr 1fr;
      gap: 48px;
      padding-block: 72px 56px;
    }

    .footer__brand app-icon {
      font-size: 22px;
      color: #fff;
    }

    .footer__brand__logo {
      width: 46px;
      height: 46px;
      border-radius: 13px;
      background: linear-gradient(135deg, #3b9dff, var(--color-primary-dark));
      display: grid;
      place-items: center;
      margin-bottom: 18px;
    }

    .footer__brand__name {
      font-size: 18px;
      font-weight: 800;
      color: #fff;
    }

    .footer__brand__text {
      margin-top: 14px;
      font-size: 14.5px;
      line-height: 1.7;
      max-width: 320px;
    }

    .footer__social {
      display: flex;
      gap: 10px;
      margin-top: 22px;
    }

    .footer__social a {
      width: 40px;
      height: 40px;
      border-radius: 11px;
      border: 1px solid rgba(255, 255, 255, 0.14);
      display: grid;
      place-items: center;
      color: #cbd5e1;
      font-size: 18px;
      transition: background-color 0.18s ease, color 0.18s ease, transform 0.18s ease;
    }

    .footer__social a:hover {
      background: var(--color-primary);
      color: #fff;
      border-color: var(--color-primary);
      transform: translateY(-2px);
    }

    .footer__col__title {
      font-size: 14px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: #fff;
      margin-bottom: 18px;
    }

    .footer__col ul {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      gap: 12px;
    }

    .footer__col a {
      font-size: 14.5px;
      transition: color 0.18s ease;
    }

    .footer__col a:hover {
      color: #fff;
    }

    .footer__bottom {
      border-top: 1px solid rgba(255, 255, 255, 0.08);
      padding-block: 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      flex-wrap: wrap;
      font-size: 13.5px;
    }

    .footer__legal {
      display: flex;
      gap: 22px;
    }

    .footer__legal a:hover {
      color: #fff;
    }

    @media (max-width: 960px) {
      .footer__top {
        grid-template-columns: 1fr 1fr;
      }
    }

    @media (max-width: 560px) {
      .footer__top {
        grid-template-columns: 1fr;
        gap: 36px;
        padding-block: 56px 40px;
      }
    }
  `],
})
export class Footer {}
