'use client';
import { useI18n } from '../i18n/i18n.js';
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  createTheme,
  ThemeProvider,
  CssBaseline,
  IconButton,
  Tooltip,
} from '@mui/material';
import { ptBR, enUS, esES } from '@mui/material/locale';
import { Moon, Sun } from 'lucide-react';
import {
  THEME_STORAGE_KEY,
  resolveColorMode,
  oppositeColorMode,
} from '../../utils/theme-preference.js';
const ModeContext = createContext({
  mode: 'light',
  toggle: () => {},
});
export function AppTheme({ children }) {
  const { locale } = useI18n();
  const [mode, setMode] = useState('light');
  const sessionChoice = useRef(null);
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const sync = () => {
      let saved = null;
      try {
        saved = localStorage.getItem(THEME_STORAGE_KEY);
      } catch {}
      const next = resolveColorMode(
        saved || sessionChoice.current,
        media.matches,
      );
      setMode(next);
      document.documentElement.dataset.theme = next;
    };
    const storage = (event) => {
      if (event.key === THEME_STORAGE_KEY || event.key === null) {
        sessionChoice.current = null;
        sync();
      }
    };
    sync();
    media.addEventListener('change', sync);
    window.addEventListener('storage', storage);
    return () => {
      media.removeEventListener('change', sync);
      window.removeEventListener('storage', storage);
    };
  }, []);
  const toggle = () => {
    const next = oppositeColorMode(mode);
    sessionChoice.current = next;
    setMode(next);
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      /* Keep the choice for this session when browser storage is unavailable. */
    }
  };
  const theme = useMemo(() => {
    const dark = mode === 'dark';
    return createTheme(
      {
        palette: {
          mode,
          primary: {
            main: dark ? '#80ceb1' : '#12665b',
            dark: dark ? '#59b28f' : '#0a4f46',
            contrastText: dark ? '#0c291f' : '#fff',
          },
          secondary: { main: dark ? '#9bbce1' : '#304e71' },
          background: {
            default: dark ? '#101925' : '#f5f7fa',
            paper: dark ? '#182533' : '#ffffff',
          },
          text: {
            primary: dark ? '#e3edf6' : '#172b41',
            secondary: dark ? '#a8bbcc' : '#6c7c8e',
          },
          divider: dark ? '#304455' : '#e2e8ee',
          success: { main: dark ? '#8ccd9f' : '#227658' },
          warning: { main: dark ? '#e1b56b' : '#a86a17' },
          info: { main: dark ? '#8ab7e0' : '#387caa' },
          error: { main: dark ? '#f09b9b' : '#c54c4c' },
        },
        typography: {
          fontFamily: 'Arial, Helvetica, sans-serif',
          fontSize: 14,
          h4: { fontWeight: 700, letterSpacing: '-1px' },
          h5: { fontWeight: 700, letterSpacing: '-.6px' },
          h6: { fontWeight: 650 },
          button: { textTransform: 'none', fontWeight: 600 },
        },
        shape: { borderRadius: 9 },
        components: {
          MuiButton: {
            defaultProps: { disableElevation: true },
            styleOverrides: { root: { padding: '10px 17px', borderRadius: 8 } },
          },
          MuiTextField: { defaultProps: { size: 'small', fullWidth: true } },
          MuiOutlinedInput: {
            styleOverrides: {
              root: { background: dark ? '#14212e' : '#fff', fontSize: 14 },
            },
          },
          MuiPaper: {
            defaultProps: { elevation: 0 },
            styleOverrides: { root: { backgroundImage: 'none' } },
          },
          MuiChip: {
            styleOverrides: { root: { fontSize: 12, fontWeight: 600 } },
          },
          MuiDialog: { defaultProps: { fullWidth: true, maxWidth: 'sm' } },
          MuiTableCell: {
            styleOverrides: {
              head: {
                color: dark ? '#a8bbcc' : '#7b8999',
                background: dark ? '#1d2c3b' : '#f9fafc',
                fontSize: 12,
                fontWeight: 600,
              },
              body: { fontSize: 14 },
              root: {
                borderColor: dark ? '#293e50' : '#edf0f4',
                padding: '17px 20px',
              },
            },
          },
          MuiTab: {
            styleOverrides: {
              root: { textTransform: 'none', fontWeight: 600 },
            },
          },
        },
      },
      locale === 'en-US' ? enUS : locale === 'es-ES' ? esES : ptBR,
    );
  }, [mode, locale]);
  return (
    <ModeContext.Provider value={{ mode, toggle }}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </ModeContext.Provider>
  );
}
export function ThemeToggle() {
  const { t: tr } = useI18n();
  const { mode, toggle } = useContext(ModeContext);
  const label =
    mode === 'dark' ? tr('Ativar tema claro') : tr('Ativar tema escuro');
  return (
    <Tooltip title={label}>
      <IconButton
        className="theme-toggle no-print"
        aria-label={label}
        aria-pressed={mode === 'dark'}
        onClick={toggle}
        sx={{
          width: 40,
          height: 40,
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 2,
          color: 'text.secondary',
          flexShrink: 0,
        }}
      >
        {mode === 'dark' ? <Sun size={19} /> : <Moon size={19} />}
      </IconButton>
    </Tooltip>
  );
}
