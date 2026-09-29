'use client';
import { Box, Paper, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useGraph, chartPlugins } from '../shared/charts.js';
import React from 'react';
import { useI18n } from '../../i18n/i18n.js';
import { HorizontalBar } from '../shared/charts.js';

export default function ArgousHorizontalBar({
  card = true,
  cardProps = {},
  data,
  datasets = [],
  height = 200,
  labels = [],
  legendPosition = 'bottom',
  numberDisplayType = 'quantity',
  options: customOptions = {},
  showGrid = true,
  showLegend = true,
  subtitle = '-',
  title = '',
  titleColor,
  ...horizontalBarProps
}) {
  const theme = useTheme();
  const { locale } = useI18n();
  const color = theme.palette.text.primary;
  const gridColor =
    theme.palette.mode === 'dark'
      ? 'rgba(255, 255, 255, 0.22)'
      : 'rgba(75, 73, 73, 0.24)';
  const option = useGraph({
    responsive: true,
    maintainAspectRatio: false,
    title: { display: false },
    legend: {
      display: showLegend,
      position: legendPosition,
      size: '12px',
      fontColor: color,
      ...(customOptions.legend || {}),
    },
    layout: { padding: { right: 60 }, ...(customOptions.layout || {}) },
    scales: {
      x: { grid: { display: false } },
      y: { beginAtZero: true },
      yAxes: [
        {
          stacked: false,
          gridLines: {
            display: showGrid,
            drawBorder: showGrid,
            color: gridColor,
            zeroLineColor: gridColor,
          },
          ticks: {
            autoSkip: false,
            beginAtZero: true,
            source: 'data',
            fontColor: color,
          },
        },
      ],
      xAxes: [
        {
          stacked: false,
          gridLines: {
            display: showGrid,
            drawBorder: showGrid,
            color: gridColor,
            zeroLineColor: gridColor,
          },
          ticks: { fontColor: color, beginAtZero: true, display: false },
        },
      ],
      ...(customOptions.scales || {}),
    },
    plugins: {
      ...(customOptions.plugins || {}),
      datalabels: {
        color,
        anchor: 'end',
        align: 'end',
        offset: 6,
        clamp: true,
        clip: false,
        formatter: (value) =>
          numberDisplayType === 'quantity'
            ? value.toLocaleString(locale)
            : Number(value).toLocaleString(locale, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              }),
        ...(customOptions.plugins?.datalabels || {}),
      },
    },
    ...customOptions,
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
        <HorizontalBar
          plugins={chartPlugins}
          {...horizontalBarProps}
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
