// Keep the imported components' legacy option names while targeting Chart.js 4.
function axisOptions(axis) {
  const { gridLines, ticks = {}, scaleLabel, ...rest } = axis;
  const {
    fontColor,
    fontSize,
    beginAtZero,
    suggestedMax,
    suggestedMin,
    min,
    max,
    ...tickOptions
  } = ticks;
  return {
    ...rest,
    ...(gridLines
      ? {
          grid: { ...gridLines, color: gridLines.color },
          border: { display: gridLines.drawBorder !== false },
        }
      : {}),
    ...(scaleLabel
      ? { title: { display: scaleLabel.display, text: scaleLabel.labelString } }
      : {}),
    ...Object.fromEntries(
      Object.entries({
        beginAtZero,
        suggestedMax,
        suggestedMin,
        min,
        max,
      }).filter(([, value]) => value !== undefined),
    ),
    ticks: {
      ...tickOptions,
      ...(fontColor ? { color: fontColor } : {}),
      ...(fontSize ? { font: { size: fontSize } } : {}),
    },
  };
}
export function normalizeChartOptions(options) {
  const { legend, title, tooltips, cutoutPercentage, scales, ...rest } =
    options;
  const result = { ...rest, plugins: { ...rest.plugins } };
  if (legend) {
    const { labels = {}, ...other } = legend;
    const { fontColor, ...labelOptions } = labels;
    result.plugins.legend = {
      ...other,
      labels: { ...labelOptions, ...(fontColor ? { color: fontColor } : {}) },
    };
  }
  if (title) result.plugins.title = title;
  if (tooltips) result.plugins.tooltip = tooltips;
  if (cutoutPercentage !== undefined) result.cutout = `${cutoutPercentage}%`;
  if (scales) {
    const { xAxes = [], yAxes = [], ...modern } = scales;
    result.scales = { ...modern };
    for (const [direction, axes] of [
      ['x', xAxes],
      ['y', yAxes],
    ])
      axes.forEach((axis, index) => {
        result.scales[axis.id || (index ? `${direction}${index}` : direction)] =
          axisOptions(axis);
      });
  }
  // Doughnuts have no cartesian scales unless the caller explicitly enables them.
  if (
    cutoutPercentage !== undefined &&
    result.scales &&
    Object.values(result.scales).every((axis) => axis.display === false)
  )
    delete result.scales;
  return result;
}
