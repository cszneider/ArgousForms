'use client';
import { Box, Paper, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useGraph, chartPlugins } from '../shared/charts.js';
import React from 'react';
import { useI18n } from '../../i18n/i18n.js';
import { Bar } from 'react-chartjs-2';

const formatNumber = (value, numberDisplayType, context, locale) => {
  const number = Number(value);

  if (!Number.isFinite(number)) return value;

  if (numberDisplayType === 'percentage') {
    const values =
      context.chart.data.datasets[context.datasetIndex]?.data || [];
    const total = values.reduce((sum, item) => sum + (Number(item) || 0), 0);
    const percentage = total ? (number / total) * 100 : 0;

    return `${percentage.toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
  }

  if (numberDisplayType === 'currency') {
    return number.toLocaleString(locale, {
      style: 'currency',
      currency: 'BRL',
    });
  }

  if (numberDisplayType === 'decimal') {
    return number.toLocaleString(locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  return number.toLocaleString(locale);
};

export default function ArgousBar({
  beginAtZero = true,
  card = true,
  cardProps = {},
  data,
  datasets = [],
  height = 200,
  labels = [],
  legendPosition = 'bottom',
  numberDisplayType = 'quantity',
  options: customOptions = {},
  scaleTopPadding = 0.15,
  showDataLabels = true,
  showGrid = true,
  showLegend = true,
  stacked = false,
  subtitle = '-',
  title = '',
  titleColor,
  ...barProps
}) {
  const theme = useTheme();
  const { locale } = useI18n();
  const color = theme.palette.text.primary;
  const gridColor =
    theme.palette.mode === 'dark'
      ? 'rgba(255, 255, 255, 0.22)'
      : 'rgba(75, 73, 73, 0.24)';
  const chartData = data || { labels, datasets };
  const chartDatasets = chartData.datasets || [];
  const maximumValue = stacked
    ? Math.max(
        0,
        ...(chartData.labels || labels).map((_, index) =>
          chartDatasets.reduce(
            (total, dataset) =>
              total + Math.max(0, Number(dataset.data?.[index]) || 0),
            0,
          ),
        ),
      )
    : Math.max(
        0,
        ...chartDatasets
          .flatMap((dataset) => dataset.data || [])
          .map((value) => Number(value) || 0),
      );
  const suggestedMax =
    maximumValue > 0 ? maximumValue * (1 + scaleTopPadding) : undefined;
  const {
    legend: customLegend = {},
    layout: customLayout = {},
    plugins: customPlugins = {},
    scales: customScales = {},
    ...remainingOptions
  } = customOptions;
  const { labels: customLegendLabels = {}, ...remainingLegend } = customLegend;
  const { datalabels: customDataLabels = {}, ...remainingPlugins } =
    customPlugins;
  const {
    xAxes: customXAxes = [],
    yAxes: customYAxes = [],
    ...remainingScales
  } = customScales;
  const [customXAxis = {}, ...remainingXAxes] = customXAxes;
  const [customYAxis = {}, ...remainingYAxes] = customYAxes;
  const {
    gridLines: customXGridLines = {},
    ticks: customXTicks = {},
    ...remainingXAxis
  } = customXAxis;
  const {
    gridLines: customYGridLines = {},
    ticks: customYTicks = {},
    ...remainingYAxis
  } = customYAxis;
  const option = useGraph({
    responsive: true,
    maintainAspectRatio: false,
    title: { display: false },
    legend: {
      display: showLegend,
      position: legendPosition,
      labels: { fontColor: color, usePointStyle: true, ...customLegendLabels },
      ...remainingLegend,
    },
    layout: { padding: { top: 24 }, ...customLayout },
    scales: {
      ...remainingScales,
      xAxes: [
        {
          stacked,
          ...remainingXAxis,
          gridLines: {
            color: gridColor,
            zeroLineColor: gridColor,
            ...customXGridLines,
            display: showGrid,
            drawBorder: showGrid,
          },
          ticks: { fontColor: color, ...customXTicks },
        },
        ...remainingXAxes,
      ],
      yAxes: [
        {
          stacked,
          ...remainingYAxis,
          gridLines: {
            color: gridColor,
            zeroLineColor: gridColor,
            ...customYGridLines,
            display: showGrid,
            drawBorder: showGrid,
          },
          ticks: {
            beginAtZero,
            fontColor: color,
            suggestedMax,
            ...customYTicks,
          },
        },
        ...remainingYAxes,
      ],
    },
    plugins: {
      ...remainingPlugins,
      datalabels: {
        display: showDataLabels,
        color,
        anchor: 'end',
        align: 'end',
        offset: 4,
        clamp: true,
        clip: false,
        font: { size: 12, weight: 'bold' },
        formatter: (value, context) =>
          formatNumber(value, numberDisplayType, context, locale),
        ...customDataLabels,
      },
    },
    ...remainingOptions,
  });
  const content = (
    <>
      {title && (
        <Typography variant="subtitle1" style={{ color: titleColor || color }}>
          {title}
        </Typography>
      )}
      <Typography
        variant="caption"
        style={{
          display: 'block',
          color: theme.palette.text.secondary,
          fontSize: 12,
        }}
      >
        {subtitle || '-'}
      </Typography>
      <Box style={{ height }}>
        <Bar
          plugins={chartPlugins}
          {...barProps}
          data={chartData}
          options={option}
        />
      </Box>
    </>
  );

  if (!card)
    return (
      <Box
        style={{
          width: '100%',
          boxSizing: 'border-box',
          background: 'transparent',
        }}
      >
        {content}
      </Box>
    );

  return (
    <Paper
      elevation={2}
      {...cardProps}
      style={{
        padding: 16,
        width: '100%',
        boxSizing: 'border-box',
        border: `1px solid ${theme.palette.divider}`,
        borderRadius: 8,
        background: theme.palette.background.paper,
        ...(cardProps.style || {}),
      }}
    >
      {content}
    </Paper>
  );
}
