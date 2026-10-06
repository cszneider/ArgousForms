'use client';
import { Chip } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { CircleCheck, CircleX } from 'lucide-react';
import { useI18n } from './i18n/i18n.js';

export default function UserStatus({ active }) {
  const { t } = useI18n();
  const color = active ? 'success' : 'error';
  const Icon = active ? CircleCheck : CircleX;
  return (
    <Chip
      size="small"
      variant="outlined"
      color={color}
      icon={<Icon size={16} aria-hidden="true" />}
      label={t(active ? 'Ativo' : 'Inativo')}
      sx={(theme) => ({
        fontWeight: 600,
        bgcolor: alpha(theme.palette[color].main, 0.08),
      })}
    />
  );
}
