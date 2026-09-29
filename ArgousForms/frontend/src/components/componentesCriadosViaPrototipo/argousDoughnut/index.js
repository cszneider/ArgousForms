'use client';
import { Box, Paper, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useGraph, chartPlugins } from '../shared/charts.js';
import React from 'react';
import { useI18n } from '../../i18n/i18n.js';
import { Doughnut } from 'react-chartjs-2';

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

export default function ArgousDoughnut({
  card = true,
  cardProps = {},
  cutoutPercentage = 60,
  data,
  datasets = [],
  height = 200,
  labels = [],
  legendPosition = 'bottom',
  numberDisplayType = 'quantity',
  options: customOptions = {},
  showDataLabels = true,
  showGrid = false,
  showLegend = true,
  showSegmentBorders = true,
  subtitle = '-',
  title = '',
  titleColor,
  ...doughnutProps
}) {
  const theme = useTheme();
  const { locale } = useI18n();
  const color = theme.palette.text.primary;
  const {
    elements: customElements = {},
    legend: customLegend = {},
    layout: customLayout = {},
    plugins: customPlugins = {},
    scales: customScales = {},
    ...remainingOptions
  } = customOptions;
  const { arc: customArc = {}, ...remainingElements } = customElements;
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
    cutoutPercentage,
    title: { display: false },
    elements: {
      ...remainingElements,
      arc: {
        borderColor: theme.palette.background.paper,
        borderWidth: showSegmentBorders ? 2 : 0,
        ...customArc,
      },
    },
    legend: {
      display: showLegend,
      position: legendPosition,
      labels: { fontColor: color, usePointStyle: true, ...customLegendLabels },
      ...remainingLegend,
    },
    layout: { padding: 8, ...customLayout },
    scales: {
      ...remainingScales,
      xAxes: [
        {
          ...remainingXAxis,
          display: showGrid,
          gridLines: {
            ...customXGridLines,
            display: showGrid,
            drawBorder: showGrid,
          },
          ticks: { ...customXTicks, display: showGrid },
        },
        ...remainingXAxes,
      ],
      yAxes: [
        {
          ...remainingYAxis,
          display: showGrid,
          gridLines: {
            ...customYGridLines,
            display: showGrid,
            drawBorder: showGrid,
          },
          ticks: { ...customYTicks, display: showGrid },
        },
        ...remainingYAxes,
      ],
    },
    plugins: {
      ...remainingPlugins,
      datalabels: {
        display: showDataLabels,
        color,
        anchor: 'center',
        align: 'center',
        clamp: true,
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
        <Doughnut
          plugins={chartPlugins}
          {...doughnutProps}
          data={data || { labels, datasets }}
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
