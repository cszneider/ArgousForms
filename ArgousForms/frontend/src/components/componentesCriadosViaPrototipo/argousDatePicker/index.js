'use client';
import {
  Box,
  IconButton,
  InputAdornment,
  MenuItem,
  Paper,
  Popover,
  TextField,
  Typography,
} from '@mui/material';
import {
  CalendarDays as CalendarToday,
  ChevronLeft,
  ChevronRight,
  X as Close,
} from 'lucide-react';
import moment from 'moment';
import { useI18n } from '../../i18n/i18n.js';
import React, { useEffect, useMemo, useState } from 'react';

const parseDate = (value, format = 'DD/MM/YYYY') => {
  if (!value) return null;
  if (moment.isMoment(value)) return value.isValid() ? value.toDate() : null;
  if (value instanceof Date)
    return Number.isNaN(value.getTime()) ? null : value;
  const parsed = moment(
    value,
    [format, 'YYYY-MM-DD', moment.ISO_8601, 'DD/MM/YYYY', 'MM/YYYY'],
    true,
  );
  return parsed.isValid() ? parsed.toDate() : null;
};

const calendarDays = (referenceDate) => {
  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth();
  return [
    ...Array.from({ length: new Date(year, month, 1).getDay() }, () => null),
    ...Array.from(
      { length: new Date(year, month + 1, 0).getDate() },
      (_, index) => new Date(year, month, index + 1),
    ),
  ];
};

const formatKeyboardValue = (value, format) => {
  const digits = String(value || '').replace(/\D/g, '');
  if (format === 'DD/MM/YYYY')
    return [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)]
      .filter(Boolean)
      .join('/');
  if (format === 'MM/DD/YYYY')
    return [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)]
      .filter(Boolean)
      .join('/');
  if (format === 'MM/YYYY')
    return [digits.slice(0, 2), digits.slice(2, 6)].filter(Boolean).join('/');
  if (format === 'YYYY-MM-DD')
    return [digits.slice(0, 4), digits.slice(4, 6), digits.slice(6, 8)]
      .filter(Boolean)
      .join('-');
  return value;
};

export default function ArgousDatePicker({
  clearable = true,
  disableFuture = false,
  disablePast = false,
  disabled = false,
  format = 'DD/MM/YYYY',
  fullWidth = true,
  keyboardInput = true,
  label: providedLabel,
  margin = 'dense',
  maxDate,
  minDate,
  onAccept = () => {},
  onChange = () => {},
  shouldDisableDate = () => false,
  value = null,
  ...textFieldProps
}) {
  const { locale, t } = useI18n();
  const label = providedLabel ?? t('Data');
  const WEEK_DAYS = Array.from({ length: 7 }, (_, day) =>
    new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(
      new Date(2024, 0, 7 + day),
    ),
  );
  const MONTHS = Array.from({ length: 12 }, (_, month) =>
    new Intl.DateTimeFormat(locale, { month: 'long' }).format(
      new Date(2024, month, 1),
    ),
  );
  const competence = format === 'MM/YYYY';
  const selectedDate = useMemo(() => parseDate(value, format), [format, value]);
  const [anchorElement, setAnchorElement] = useState(null);
  const [inputValue, setInputValue] = useState(() =>
    selectedDate ? moment(selectedDate).format(format) : '',
  );
  const [visibleMonth, setVisibleMonth] = useState(
    () => selectedDate || new Date(),
  );
  const days = useMemo(() => calendarDays(visibleMonth), [visibleMonth]);
  const minimumDate = parseDate(minDate, format);
  const maximumDate = parseDate(maxDate, format);
  const minimumYear =
    minimumDate?.getFullYear() || new Date().getFullYear() - 100;
  const maximumYear =
    maximumDate?.getFullYear() || new Date().getFullYear() + 100;
  const years = useMemo(
    () =>
      Array.from(
        { length: Math.max(0, maximumYear - minimumYear + 1) },
        (_, index) => minimumYear + index,
      ),
    [maximumYear, minimumYear],
  );

  useEffect(() => {
    setInputValue(selectedDate ? moment(selectedDate).format(format) : '');
  }, [format, selectedDate]);

  const abrirCalendario = (event) => {
    if (disabled) return;
    setVisibleMonth(selectedDate || new Date());
    setAnchorElement(event.currentTarget);
  };

  const fecharCalendario = () => setAnchorElement(null);
  const alterarPeriodo = (difference) =>
    setVisibleMonth((current) =>
      competence
        ? new Date(current.getFullYear() + difference, current.getMonth(), 1)
        : new Date(current.getFullYear(), current.getMonth() + difference, 1),
    );

  const selecionarData = (date) => {
    const nextValue = moment(date);
    setInputValue(nextValue.format(format));
    onChange(nextValue);
    onAccept(nextValue);
    fecharCalendario();
  };

  const digitarData = (event) => {
    const nextInputValue = formatKeyboardValue(event.target.value, format);
    setInputValue(nextInputValue);
    if (!nextInputValue) {
      onChange(null);
      return;
    }
    const nextValue = moment(nextInputValue, format, true);
    if (nextValue.isValid() && !dataDesabilitada(nextValue.toDate()))
      onChange(nextValue);
  };

  const dataDesabilitada = (date) => {
    const comparisonUnit = competence ? 'month' : 'day';
    const currentDate = moment(date).startOf(comparisonUnit);
    const today = moment().startOf(comparisonUnit);
    return (
      (disablePast && currentDate.isBefore(today)) ||
      (disableFuture && currentDate.isAfter(today)) ||
      (minimumDate &&
        currentDate.isBefore(moment(minimumDate).startOf(comparisonUnit))) ||
      (maximumDate &&
        currentDate.isAfter(moment(maximumDate).startOf(comparisonUnit))) ||
      shouldDisableDate(moment(date))
    );
  };

  const limparData = (event) => {
    event.stopPropagation();
    setInputValue('');
    onChange(null);
    onAccept(null);
    fecharCalendario();
  };

  return (
    <>
      <TextField
        {...textFieldProps}
        fullWidth={fullWidth}
        disabled={disabled}
        label={label}
        margin={margin}
        size="medium"
        variant="outlined"
        value={inputValue}
        onChange={digitarData}
        slotProps={{
          ...textFieldProps.slotProps,
          htmlInput: {
            readOnly: !keyboardInput,
            maxLength: format.length,
            inputMode: 'numeric',
            ...(textFieldProps.slotProps?.htmlInput || {}),
          },
          input: {
            ...(textFieldProps.slotProps?.input || {}),
            endAdornment: (
              <InputAdornment position="end">
                {clearable && inputValue && (
                  <IconButton
                    disabled={disabled}
                    size="small"
                    aria-label={t('Limpar {0}', { 0: label })}
                    onClick={limparData}
                  >
                    <Close size={18} />
                  </IconButton>
                )}
                <IconButton
                  disabled={disabled}
                  size="small"
                  aria-label={t('Selecionar {0}', { 0: label })}
                  onClick={abrirCalendario}
                >
                  <CalendarToday size={18} />
                </IconButton>
              </InputAdornment>
            ),
          },
        }}
      />
      <Popover
        open={Boolean(anchorElement)}
        anchorEl={anchorElement}
        onClose={fecharCalendario}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
      >
        <Paper elevation={0} style={{ width: 300, padding: 12 }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              mb: 1,
            }}
          >
            <IconButton
              size="small"
              aria-label={competence ? t('Ano anterior') : t('Mês anterior')}
              onClick={() => alterarPeriodo(-1)}
            >
              <ChevronLeft />
            </IconButton>
            <Box
              sx={{ display: 'flex', alignItems: 'center' }}
              style={{ gap: 6 }}
            >
              {!competence && (
                <TextField
                  select
                  size="small"
                  variant="outlined"
                  value={visibleMonth.getMonth()}
                  onChange={(event) =>
                    setVisibleMonth(
                      (current) =>
                        new Date(
                          current.getFullYear(),
                          Number(event.target.value),
                          1,
                        ),
                    )
                  }
                >
                  {MONTHS.map((month, index) => (
                    <MenuItem key={month} value={index}>
                      {month}
                    </MenuItem>
                  ))}
                </TextField>
              )}
              <TextField
                select
                size="small"
                variant="outlined"
                value={visibleMonth.getFullYear()}
                onChange={(event) =>
                  setVisibleMonth(
                    (current) =>
                      new Date(
                        Number(event.target.value),
                        current.getMonth(),
                        1,
                      ),
                  )
                }
              >
                {years.map((year) => (
                  <MenuItem key={year} value={year}>
                    {year}
                  </MenuItem>
                ))}
              </TextField>
            </Box>
            <IconButton
              size="small"
              aria-label={competence ? t('Próximo ano') : t('Próximo mês')}
              onClick={() => alterarPeriodo(1)}
            >
              <ChevronRight />
            </IconButton>
          </Box>
          {competence ? (
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gridGap: 6,
              }}
            >
              {MONTHS.map((month, index) => {
                const date = new Date(visibleMonth.getFullYear(), index, 1);
                const selected =
                  selectedDate && moment(selectedDate).isSame(date, 'month');
                return (
                  <IconButton
                    key={month}
                    size="small"
                    disabled={dataDesabilitada(date)}
                    color={selected ? 'primary' : 'default'}
                    aria-label={t('Selecionar {0}', {
                      0: `${month} ${visibleMonth.getFullYear()}`,
                    })}
                    onClick={() => selecionarData(date)}
                    style={{
                      borderRadius: 6,
                      backgroundColor: selected
                        ? 'rgba(0, 153, 93, 0.14)'
                        : undefined,
                    }}
                  >
                    <Typography variant="caption" color="inherit">
                      {month.slice(0, 3)}
                    </Typography>
                  </IconButton>
                );
              })}
            </Box>
          ) : (
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(7, 1fr)',
                gridGap: 2,
              }}
            >
              {WEEK_DAYS.map((day) => (
                <Typography
                  key={day}
                  align="center"
                  variant="caption"
                  color="text.secondary"
                >
                  {day}
                </Typography>
              ))}
              {days.map((date, index) =>
                date ? (
                  <IconButton
                    key={moment(date).format('YYYY-MM-DD')}
                    size="small"
                    disabled={dataDesabilitada(date)}
                    color={
                      selectedDate && moment(selectedDate).isSame(date, 'day')
                        ? 'primary'
                        : 'default'
                    }
                    aria-label={t('Selecionar {0}', {
                      0: moment(date).format(format),
                    })}
                    onClick={() => selecionarData(date)}
                    style={{
                      backgroundColor:
                        selectedDate && moment(selectedDate).isSame(date, 'day')
                          ? 'rgba(0, 153, 93, 0.14)'
                          : undefined,
                    }}
                  >
                    <Typography variant="body2" color="inherit">
                      {date.getDate()}
                    </Typography>
                  </IconButton>
                ) : (
                  <span key={`empty-${index}`} />
                ),
              )}
            </Box>
          )}
        </Paper>
      </Popover>
    </>
  );
}
