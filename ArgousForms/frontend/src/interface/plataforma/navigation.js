'use client';
import { PlatformContext } from './index.js';
import { useContext } from 'react';
import { Avatar, Button, Drawer, IconButton } from '@mui/material';
import {
  Building2,
  FileStack,
  LayoutDashboard,
  LogOut,
  Users,
} from 'lucide-react';
import { useI18n } from '../../components/i18n/i18n.js';
export default function PlatformNavigation() {
  const { value, dispatch, signOut } = useContext(PlatformContext);
  const { view, mobile } = value;
  const onClose = () => dispatch({ field: 'mobile', value: false });
  const { t } = useI18n();

  const select = (value) => {
    dispatch({ field: 'view', value });
    onClose();
  };
  const content = (
    <div className="sidebar-inner" style={{ minHeight: 0, overflowY: 'auto' }}>
      <div className="brand sidebar-brand" aria-label="ArgousDocs">
        <span className="brand-icon">
          <FileStack size={23} />
        </span>
        Argous<span>Docs</span>
      </div>
      <span className="nav-label">{t('AMBIENTE ADMINISTRADOR')}</span>
      <nav className="side-nav" aria-label={t('AMBIENTE ADMINISTRADOR')}>
        <button
          className={view === 'overview' ? 'active' : ''}
          onClick={() => select('overview')}
          aria-current={view === 'overview' ? 'page' : undefined}
        >
          <LayoutDashboard size={19} />
          <span>{t('Visão geral')}</span>
        </button>
        <button
          className={view === 'clients' ? 'active' : ''}
          onClick={() => select('clients')}
          aria-current={view === 'clients' ? 'page' : undefined}
        >
          <Building2 size={19} />
          <span>{t('Clientes')}</span>
        </button>
        <button
          className={view === 'users' ? 'active' : ''}
          onClick={() => select('users')}
          aria-current={view === 'users' ? 'page' : undefined}
        >
          <Users size={19} />
          <span>{t('Usuários')}</span>
        </button>
      </nav>
      <div style={{ marginTop: 'auto' }}>
        <div className="sidebar-bottom">
          <div className="profile-exit">
            <Button
              onClick={() => select('settings')}
              aria-label={t('Configurações do usuário')}
              sx={{
                display: 'flex',
                gap: 1.25,
                textTransform: 'none',
                color: 'inherit',
                textAlign: 'left',
                justifyContent: 'flex-start',
                flex: 1,
                minWidth: 0,
              }}
            >
              <Avatar
                sx={{
                  width: 34,
                  height: 34,
                  bgcolor: 'action.selected',
                  color: 'text.primary',
                  fontSize: 13,
                }}
              >
                AD
              </Avatar>
              <div>
                <strong>{t('Administrador')}</strong>
                <small>adm@argous.com.br</small>
              </div>
            </Button>
            <IconButton aria-label={t('Sair')} onClick={signOut}>
              <LogOut size={17} />
            </IconButton>
          </div>
        </div>
      </div>
    </div>
  );
  return (
    <>
      <aside className="desktop-sidebar">{content}</aside>
      <Drawer
        open={mobile}
        onClose={onClose}
        slotProps={{ paper: { sx: { width: 255 } } }}
      >
        {content}
      </Drawer>
    </>
  );
}
