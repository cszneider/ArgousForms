'use client';
import {
  accountId,
  USER_LANGUAGE_PREFIX,
} from '../../programas/plataforma/users.js';
import { Select, MenuItem } from '@mui/material';
import { Check, ChevronDown } from 'lucide-react';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  LANGUAGE_STORAGE_KEY,
  resolveLocale,
  translate,
  translateSystemMessage,
} from '../../utils/i18n/i18n.js';
const defaults = {
  locale: 'pt-BR',
  setLocale: (_) => {},
  t: (message, values) => translate('pt-BR', message, values),
  system: (message) => message,
};
const LanguageContext = createContext(defaults);
export function LanguageProvider({ children }) {
  const [locale, updateLocale] = useState('pt-BR');
  useEffect(() => {
    const sync = () => {
      try {
        const id = accountId(sessionStorage.getItem('argousdocs:session'));
        updateLocale(
          resolveLocale(
            localStorage.getItem(
              id ? USER_LANGUAGE_PREFIX + id : LANGUAGE_STORAGE_KEY,
            ),
          ),
        );
      } catch {}
    };
    sync();
    const storage = (event) => {
      if (
        event.key === LANGUAGE_STORAGE_KEY ||
        event.key?.startsWith(USER_LANGUAGE_PREFIX) ||
        event.key === null
      )
        sync();
    };
    window.addEventListener('storage', storage);
    return () => window.removeEventListener('storage', storage);
  }, []);
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  const value = useMemo(
    () => ({
      locale,
      setLocale: (next) => {
        updateLocale(next);
        try {
          const id = accountId(sessionStorage.getItem('argousdocs:session'));
          localStorage.setItem(
            id ? USER_LANGUAGE_PREFIX + id : LANGUAGE_STORAGE_KEY,
            next,
          );
        } catch {}
      },
      t: (message, values) => translate(locale, message, values),
      system: (message) => translateSystemMessage(locale, message),
    }),
    [locale],
  );
  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}
export const useI18n = () => useContext(LanguageContext);
const languages = [
  { value: 'pt-BR', flag: '🇧🇷', name: 'Português' },
  { value: 'en-US', flag: '🇺🇸', name: 'English' },
  { value: 'es-ES', flag: '🇪🇸', name: 'Español' },
];
function LanguageLabel({ language }) {
  return (
    <span className="language-label" lang={language.value}>
      <span className="language-flag" aria-hidden="true">
        {language.flag}
      </span>
      <span className="language-divider" aria-hidden="true">
        –
      </span>
      <span>{language.name}</span>
    </span>
  );
}
export function LanguageSelect() {
  const { locale, setLocale, t } = useI18n();
  return (
    <Select
      className="language-picker no-print"
      value={locale}
      inputProps={{ 'aria-label': t('Idioma') }}
      IconComponent={ChevronDown}
      onChange={(event) => setLocale(resolveLocale(event.target.value))}
      renderValue={(value) => (
        <LanguageLabel
          language={
            languages.find((item) => item.value === value) || languages[0]
          }
        />
      )}
      MenuProps={{
        anchorOrigin: { vertical: 'bottom', horizontal: 'right' },
        transformOrigin: { vertical: 'top', horizontal: 'right' },
        slotProps: {
          paper: {
            className: 'language-menu',
            sx: {
              mt: 1,
              borderRadius: '14px',
              minWidth: 200,
              p: '5px',
              border: '1px solid var(--border)',
              bgcolor: 'var(--theme-surface, #fff)',
              color: 'var(--theme-text-strong, #172b41)',
              boxShadow: '0 12px 36px #00000020',
            },
          },
          list: { 'aria-label': t('Idioma'), sx: { p: 0 } },
        },
      }}
    >
      {languages.map((language) => (
        <MenuItem
          className="language-option"
          key={language.value}
          value={language.value}
        >
          <LanguageLabel language={language} />
          {locale === language.value && (
            <Check className="language-check" size={16} aria-hidden="true" />
          )}
        </MenuItem>
      ))}
    </Select>
  );
}
