import { Component, input } from '@angular/core';
import { NgApexchartsModule, ApexOptions } from 'ng-apexcharts';

@Component({
  selector: 'app-widget-chart',
  imports: [NgApexchartsModule],
  template: `
    <apx-chart
      [series]="options().series ?? []"
      [chart]="options().chart ?? { type: 'bar', height: 280 }"
      [xaxis]="options().xaxis ?? {}"
      [yaxis]="options().yaxis ?? {}"
      [labels]="options().labels ?? []"
      [colors]="options().colors ?? []"
      [stroke]="options().stroke ?? {}"
      [fill]="options().fill ?? {}"
      [dataLabels]="options().dataLabels ?? {}"
      [legend]="options().legend ?? {}"
      [plotOptions]="options().plotOptions ?? {}"
      [tooltip]="options().tooltip ?? {}"
      [grid]="options().grid ?? {}"
      [noData]="options().noData ?? {}"
      [responsive]="options().responsive ?? []"
    ></apx-chart>
  `
})
export class WidgetChartComponent {
  options = input<ApexOptions>({ chart: { type: 'bar', height: 280 } });
}
