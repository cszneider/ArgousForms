'use client';
import { Box, Paper, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useGraph, chartPlugins } from '../shared/charts.js';
import React from 'react';
import { useI18n } from '../../i18n/i18n.js';
import { Line } from 'react-chartjs-2';

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

export default function ArgousLine({
  beginAtZero = true,
  card = true,
  cardProps = {},
  data,
  datasets = [],
  height = 200,
  labels = [],
  dataLabelOffset = 8,
  dataLabelSpacing = 14,
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
  ...lineProps
}) {
  const theme = useTheme();
  const { locale } = useI18n();
  const color = theme.palette.text.primary;
  const gridColor =
    theme.palette.mode === 'dark'
      ? 'rgba(255, 255, 255, 0.22)'
      : 'rgba(75, 73, 73, 0.24)';
  const chartData = data || { labels, datasets };
  const chartLabels = chartData.labels || labels;
  const chartDatasets = chartData.datasets || [];
  const maximumValue = stacked
    ? Math.max(
        0,
        ...chartLabels.map((_, index) =>
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
          .reduce((values, dataset) => [...values, ...(dataset.data || [])], [])
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
    layout: { padding: { top: 44, bottom: 8 }, ...customLayout },
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
        display: (context) => {
          if (!showDataLabels) return false;

          const currentValue = context.dataset.data?.[context.dataIndex];
          const previousDatasets = context.chart.data.datasets.slice(
            0,
            context.datasetIndex,
          );

          return !previousDatasets.some(
            (dataset) => dataset.data?.[context.dataIndex] === currentValue,
          );
        },
        color,
        anchor: 'end',
        align: (context) => {
          if (context.dataIndex === 0) return 315;
          if (context.dataIndex === context.dataset.data.length - 1) return 225;

          return 'top';
        },
        offset: (context) => {
          const verticalScale = Object.values(context.chart.scales).find(
            (scale) => !scale.isHorizontal(),
          );
          const minimumDistance = 12 + dataLabelSpacing;
          const positions = context.chart.data.datasets
            .map((dataset, datasetIndex) => ({
              datasetIndex,
              value: Number(dataset.data?.[context.dataIndex]),
            }))
            .filter((item) => Number.isFinite(item.value))
            .filter(
              (item, index, items) =>
                items.findIndex((other) => other.value === item.value) ===
                index,
            )
            .map((item) => ({
              ...item,
              pixel: verticalScale?.getPixelForValue(item.value),
            }))
            .filter((item) => Number.isFinite(item.pixel))
            .sort((first, second) => second.pixel - first.pixel);
          let previousLabelPosition;
          const calculatedOffsets = positions.reduce((offsets, item) => {
            const naturalPosition = item.pixel - dataLabelOffset;
            const labelPosition =
              previousLabelPosition === undefined
                ? naturalPosition
                : Math.min(
                    naturalPosition,
                    previousLabelPosition - minimumDistance,
                  );

            offsets[item.datasetIndex] = item.pixel - labelPosition;
            previousLabelPosition = labelPosition;

            return offsets;
          }, {});
          const calculatedOffset =
            calculatedOffsets[context.datasetIndex] || dataLabelOffset;
          const isEdge =
            context.dataIndex === 0 ||
            context.dataIndex === context.dataset.data.length - 1;

          return isEdge ? Math.max(calculatedOffset, 10) : calculatedOffset;
        },
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
        <Line
          plugins={chartPlugins}
          {...lineProps}
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
