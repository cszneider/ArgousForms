'use client';
import { Paper, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import React from 'react';

export default function ArgousSimpleCard({
  title = '-',
  value = '--',
  gradient,
  backgroundColor,
  opacity = 1,
}) {
  const theme = useTheme();
  const background = gradient
    ? `linear-gradient(${gradient.direction || '135deg'}, ${gradient.startColor || theme.palette.background.paper}, ${gradient.endColor || theme.palette.background.default})`
    : backgroundColor || theme.palette.background.paper;

  return (
    <Paper
      elevation={0}
      style={{
        width: '100%',
        minHeight: 96,
        boxSizing: 'border-box',
        padding: 20,
        borderRadius: 10,
        background,
        opacity,
      }}
    >
      <Typography
        variant="body1"
        color="text.secondary"
        style={{ marginBottom: 2 }}
      >
        {title}
      </Typography>
      <Typography
        variant="h4"
        color="text.primary"
        style={{ fontWeight: 500, lineHeight: 1.1 }}
      >
        {value}
      </Typography>
    </Paper>
  );
}
