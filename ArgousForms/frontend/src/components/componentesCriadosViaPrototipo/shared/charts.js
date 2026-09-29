'use client';
import { Chart as ChartJS, registerables } from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { Bar } from 'react-chartjs-2';
import { normalizeChartOptions } from './chart-options.js';
ChartJS.register(...registerables);
// Register data labels only on these charts; do not affect other charts in the application.
export const chartPlugins = [ChartDataLabels];
export const useGraph = normalizeChartOptions;
export function HorizontalBar(props) {
  return <Bar {...props} options={{ ...props.options, indexAxis: 'y' }} />;
}
