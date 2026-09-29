'use client';
import {
  Box,
  Divider,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Paper,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  Plus as Add,
  Trash2 as DeleteOutline,
  RefreshCw as Refresh,
} from 'lucide-react';
import { useI18n } from '../../i18n/i18n.js';
import React, { useEffect, useMemo, useRef, useState } from 'react';

const PAGE_SIZE = 20;

const perfis = [
  {
    title: 'Financeiro',
    subtitle: '34 prog · 118 usu',
  },
  {
    title: 'Vendas',
    subtitle: '21 prog · 96 usu',
  },
  {
    title: 'Operação',
    subtitle: '28 prog · 74 usu',
  },
  {
    title: 'Fiscal',
    subtitle: '19 prog · 52 usu',
  },
  {
    title: 'TI',
    subtitle: '61 prog · 31 usu',
  },
  {
    title: 'Auditoria externa',
    subtitle: '7 prog · 0 usu',
  },
];

export default function ArgousScrolling({
  items = perfis,
  itemAction = 'deleteReactivate',
  onAdd = () => {},
  onItemAction = () => {},
  onItemClick = () => {},
  onSearch = null,
  selectedItem = null,
  searchLabel: providedSearchLabel,
  showAdd = true,
  showFilter = true,
}) {
  const { locale, t } = useI18n();
  const searchLabel = providedSearchLabel ?? t('Buscar perfil');
  const [search, setSearch] = useState('');
  const [visibleItemsCount, setVisibleItemsCount] = useState(PAGE_SIZE);
  const onSearchRef = useRef(onSearch);
  const primeiraBuscaRef = useRef(true);
  const buscaNoServidor = typeof onSearch === 'function';
  const itemsLength = items.length;
  const filteredItems = useMemo(() => {
    if (buscaNoServidor) return items;
    const normalizedSearch = search.trim().toLocaleLowerCase(locale);
    if (!normalizedSearch) return items;
    return items.filter((item) => {
      const indicators = (item.indicators || [])
        .map((indicator) => `${indicator.label || ''} ${indicator.value ?? ''}`)
        .join(' ');
      return `${item.title || ''} ${item.subtitle || ''} ${indicators}`
        .toLocaleLowerCase(locale)
        .includes(normalizedSearch);
    });
  }, [buscaNoServidor, items, search, locale]);
  const visibleItems = filteredItems.slice(0, visibleItemsCount);

  useEffect(() => {
    onSearchRef.current = onSearch;
  }, [onSearch]);

  useEffect(() => {
    if (!buscaNoServidor) return undefined;
    if (primeiraBuscaRef.current) {
      primeiraBuscaRef.current = false;
      return undefined;
    }

    const timeout = setTimeout(() => onSearchRef.current(search), 300);
    return () => clearTimeout(timeout);
  }, [buscaNoServidor, search]);

  useEffect(() => setVisibleItemsCount(PAGE_SIZE), [itemsLength, search]);

  const adicionar = () => onAdd();

  const executarAcaoItem = (item) => onItemAction(item);

  const itemSelecionado = (item, index) => {
    if (!selectedItem) return index === 0;
    if (selectedItem === item) return true;

    const idItem =
      item.idPerfil ?? item.idUsuario ?? item.idPrograma ?? item.id;
    const idSelecionado =
      selectedItem.idPerfil ??
      selectedItem.idUsuario ??
      selectedItem.idPrograma ??
      selectedItem.id;
    return (
      idItem !== undefined &&
      idSelecionado !== undefined &&
      String(idItem) === String(idSelecionado)
    );
  };

  const carregarProximaPagina = (event) => {
    const list = event.currentTarget;
    const reachedEnd =
      list.scrollTop + list.clientHeight >= list.scrollHeight - 24;
    if (reachedEnd && visibleItemsCount < filteredItems.length)
      setVisibleItemsCount((current) =>
        Math.min(current + PAGE_SIZE, filteredItems.length),
      );
  };

  return (
    <Paper variant="outlined">
      {showFilter && (
        <>
          <Box sx={{ p: 1 }}>
            <TextField
              fullWidth
              margin="dense"
              size="medium"
              variant="outlined"
              label={searchLabel}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </Box>
          <Divider />
        </>
      )}
      <Box
        sx={{
          px: 1,
          py: 0.5,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Typography color="text.secondary">
          {t('{0} itens', { 0: filteredItems.length })}
        </Typography>
        {showAdd && (
          <IconButton
            size="medium"
            color="primary"
            title={t('Adicionar item')}
            aria-label={t('Adicionar item')}
            onClick={(e) => adicionar()}
          >
            <Add />
          </IconButton>
        )}
      </Box>
      <Divider />
      <List
        disablePadding
        onScroll={carregarProximaPagina}
        style={{ maxHeight: 520, overflowY: 'auto' }}
      >
        {visibleItems.map((perfil, index) => (
          <ListItem
            disablePadding
            divider
            key={
              perfil.idPerfil ??
              perfil.idUsuario ??
              perfil.idPrograma ??
              perfil.id ??
              perfil.title
            }
            secondaryAction={
              itemAction !== 'none' && (
                <IconButton
                  edge="end"
                  size="medium"
                  aria-label={
                    perfil.active === false && itemAction === 'deleteReactivate'
                      ? t('Reativar item')
                      : t('Excluir item')
                  }
                  color={
                    perfil.active === false && itemAction === 'deleteReactivate'
                      ? 'primary'
                      : 'secondary'
                  }
                  title={
                    perfil.active === false && itemAction === 'deleteReactivate'
                      ? t('Reativar item')
                      : t('Excluir item')
                  }
                  onClick={(e) => {
                    e.stopPropagation();
                    executarAcaoItem(perfil);
                  }}
                >
                  {perfil.active === false &&
                  itemAction === 'deleteReactivate' ? (
                    <Refresh />
                  ) : (
                    <DeleteOutline />
                  )}
                </IconButton>
              )
            }
          >
            <ListItemButton
              selected={itemSelecionado(perfil, index)}
              onClick={() => onItemClick(perfil)}
              sx={{ pr: itemAction === 'none' ? 2 : 7 }}
            >
              <ListItemText
                primary={perfil.title}
                secondary={
                  perfil.indicators?.length ? (
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                      }}
                      component="span"
                    >
                      {perfil.indicators.map((indicator, indicatorIndex) => (
                        <Tooltip
                          key={`${indicator.label}-${indicatorIndex}`}
                          title={indicator.tooltip || indicator.label || ''}
                          arrow
                        >
                          <Box
                            sx={{ display: 'inline-flex' }}
                            component="span"

                            style={{
                              cursor: 'help',
                              marginRight:
                                indicatorIndex < perfil.indicators.length - 1
                                  ? 12
                                  : 0,
                            }}
                          >
                            <Typography
                              component="span"
                              variant="caption"
                              color="text.secondary"
                            >
                              {indicator.label}:{' '}
                              <Box sx={{ fontWeight: 600 }} component="span">
                                {indicator.value}
                              </Box>
                            </Typography>
                          </Box>
                        </Tooltip>
                      ))}
                    </Box>
                  ) : (
                    perfil.subtitle
                  )
                }
                slotProps={{
                  secondary: {
                    component: 'div',
                    style: { whiteSpace: 'pre-line' },
                  },
                }}
              />
            </ListItemButton>
          </ListItem>
        ))}
        {visibleItems.length < filteredItems.length && (
          <ListItem>
            <ListItemText
              secondary={t('Exibindo {0} de {1}. Role para carregar mais.', {
                0: visibleItems.length,
                1: filteredItems.length,
              })}
            />
          </ListItem>
        )}
      </List>
    </Paper>
  );
}
