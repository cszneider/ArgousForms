'use client';
import { useState } from 'react';
import { Avatar, Button, Collapse, Drawer, IconButton } from '@mui/material';
import {
  BookOpen,
  ChevronDown,
  ChevronUp,
  Code,
  FileStack,
  LayoutDashboard,
  LogOut,
  Server,
  Users,
} from 'lucide-react';
import { useI18n } from '../../components/i18n/i18n.js';
export default function PlatformNavigation({
  view,
  onSelect,
  mobile,
  onClose,
  onLogout,
}) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(true);
  const select = (value) => {
    onSelect(value);
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
          className={view === 'users' ? 'active' : ''}
          onClick={() => select('users')}
          aria-current={view === 'users' ? 'page' : undefined}
        >
          <Users size={19} />
          <span>{t('Usuários')}</span>
        </button>
        <button onClick={() => setExpanded(!expanded)} aria-expanded={expanded}>
          <BookOpen size={19} />
          <span>{t('Base de conhecimento')}</span>
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
        <Collapse in={expanded}>
          {[
            ['backend', 'Backend', Server],
            ['frontend', 'Frontend', Code],
          ].map(([key, label, Icon]) => (
            <button
              key={key}
              className={view === key ? 'active' : ''}
              aria-current={view === key ? 'page' : undefined}
              onClick={() => select(key)}
              style={{ paddingLeft: 30 }}
            >
              <Icon size={19} />
              <span>{label}</span>
            </button>
          ))}
        </Collapse>
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
            <IconButton aria-label={t('Sair')} onClick={onLogout}>
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
