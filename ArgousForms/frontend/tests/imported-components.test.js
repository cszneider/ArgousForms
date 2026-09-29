import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeChartOptions } from '../src/components/componentesCriadosViaPrototipo/shared/chart-options.js';
test('imported charts preserve legacy axes, labels and data-label callbacks with Chart.js 4', () => {
  const formatter = (value) => `${value}%`;
  const source = {
    legend: { position: 'bottom', labels: { fontColor: '#fff' } },
    scales: {
      yAxes: [
        {
          ticks: { beginAtZero: true, suggestedMax: 120, fontColor: '#eee' },
          gridLines: { display: false },
        },
      ],
    },
    plugins: { datalabels: { formatter } },
  };
  const options = normalizeChartOptions(source);
  assert.equal(options.plugins.legend.labels.color, '#fff');
  assert.equal(options.plugins.datalabels.formatter, formatter);
  assert.equal(options.scales.y.beginAtZero, true);
  assert.equal(options.scales.y.suggestedMax, 120);
  assert.equal(options.scales.y.ticks.color, '#eee');
  assert.equal(options.scales.y.grid.display, false);
  assert.equal(source.scales.yAxes[0].ticks.suggestedMax, 120);
  assert.equal(source.scales.y, undefined);
});
test('doughnut cutout is converted and hidden Cartesian axes are omitted', () => {
  const options = normalizeChartOptions({
    cutoutPercentage: 60,
    scales: { xAxes: [{ display: false }], yAxes: [{ display: false }] },
  });
  assert.equal(options.cutout, '60%');
  assert.equal(options.scales, undefined);
});
