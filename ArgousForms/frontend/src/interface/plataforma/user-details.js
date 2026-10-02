'use client';
import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  IconButton,
  Tooltip,
  TextField,
  Typography,
} from '@mui/material';
import { useI18n } from '../../components/i18n/i18n.js';
import {
  readProfile,
  validateProfile,
} from '../../programas/plataforma/profile.js';
import {
  deleteManagedUser,
  saveManagedProfile,
} from '../../programas/plataforma/user-management.js';
import { readStore } from '../../programas/documentos/storage.js';
import {
  isEnabled,
  setUserEnabled,
} from '../../programas/plataforma/access.js';
export default function UserDetails({ user, onBack, onChange }) {
  const { t } = useI18n();
  const [profile, setProfile] = useState(() => readProfile(user.id, user));
  const [expected, setExpected] = useState(() =>
    JSON.stringify(readProfile(user.id)),
  );
  const [editing, setEditing] = useState(false);
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState(null);
  const [confirm, setConfirm] = useState(false);
  const active = user.id === 'platform-admin' || isEnabled(user.id);
  const back = () => {
    if (!editing || window.confirm(t('Descartar alterações não salvas?')))
      onBack();
  };
  return (
    <section className="panel">
      <Box sx={{ p: 3 }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 2,
            mb: 1,
          }}
        >
          <Typography variant="h6">{profile.name}</Typography>
          <Tooltip title={t('Voltar à lista')}>
            <IconButton aria-label={t('Voltar à lista')} onClick={back}>
              <ArrowLeft size={22} />
            </IconButton>
          </Tooltip>
        </Box>
        <Typography color="text.secondary" mb={3}>
          {t(user.company === 'platform' ? 'Plataforma' : 'Empresa de teste')} ·{' '}
          {t(active ? 'Ativo' : 'Inativo')}
        </Typography>
        {message && (
          <Alert severity={message.error ? 'error' : 'success'} sx={{ mb: 2 }}>
            {t(message.text)}
          </Alert>
        )}
        <Box
          component="form"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            if (!editing) return;
            const next = validateProfile(profile);
            setErrors(next);
            if (Object.keys(next).length) return;
            try {
              setProfile(saveManagedProfile(user.id, profile, expected));
              setExpected(JSON.stringify(readProfile(user.id)));
              setEditing(false);
              setMessage({ text: 'Cadastro salvo.' });
              onChange();
            } catch (e) {
              setMessage({ error: true, text: e.message });
            }
          }}
        >
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
              gap: 2,
            }}
          >
            {[
              ['name', 'Nome', 'text', true],
              ['email', 'E-mail', 'email', true],
              ['cpf', 'CPF', 'text', true],
              ['birthDate', 'Data de nascimento', 'date', true],
              ['phone', 'Telefone', 'tel', false],
            ].map(([key, label, type, required]) => (
              <TextField
                key={key}
                label={t(label)}
                type={type}
                required={required}
                value={profile[key]}
                onChange={(e) =>
                  setProfile({ ...profile, [key]: e.target.value })
                }
                slotProps={{
                  input: { readOnly: !editing },
                  inputLabel: { shrink: true },
                }}
                error={Boolean(errors[key])}
                helperText={errors[key] && t(errors[key])}
              />
            ))}
            <TextField
              select
              disabled={!editing}
              label={t('Gênero')}
              value={profile.gender}
              onChange={(e) =>
                setProfile({ ...profile, gender: e.target.value })
              }
            >
              {[
                '',
                'Feminino',
                'Masculino',
                'Não binário',
                'Outro',
                'Prefiro não informar',
              ].map((value) => (
                <MenuItem key={value} value={value}>
                  {t(value || 'Não informado')}
                </MenuItem>
              ))}
            </TextField>
          </Box>
          <Typography variant="body2" sx={{ my: 2 }}>
            {t('O e-mail cadastral não altera o login de demonstração.')}
          </Typography>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: '1fr',
                sm: editing
                  ? 'repeat(2, minmax(150px, 190px))'
                  : 'repeat(3, minmax(130px, 170px))',
              },
              justifyContent: 'end',
              gap: 1.5,
              mt: 3,
            }}
          >
            {editing && (
              <>
                <Button
                  fullWidth
                  variant="contained"
                  size="medium"
                  type="submit"
                >
                  {t('Salvar')}
                </Button>
                <Button
                  fullWidth
                  variant="contained"
                  size="medium"
                  onClick={() => {
                    setProfile(readProfile(user.id, user));
                    setExpected(JSON.stringify(readProfile(user.id)));
                    setEditing(false);
                    setErrors({});
                  }}
                >
                  {t('Cancelar')}
                </Button>
              </>
            )}
            {!editing && (
              <>
                <Button
                  fullWidth
                  variant="contained"
                  size="medium"
                  disabled={editing}
                  onClick={() => setEditing(true)}
                >
                  {t('Editar')}
                </Button>
                <Button
                  fullWidth
                  variant="contained"
                  size="medium"
                  disabled={editing || user.id === 'platform-admin'}
                  onClick={() => {
                    try {
                      setUserEnabled(user.id, !active, readStore().people);
                      onChange();
                      setMessage(null);
                    } catch (e) {
                      setMessage({ error: true, text: e.message });
                    }
                  }}
                >
                  {t(active ? 'Inativar' : 'Reativar')}
                </Button>
                <Button
                  fullWidth
                  variant="contained"
                  size="medium"
                  color="error"
                  disabled={editing || user.id === 'platform-admin'}
                  onClick={() => setConfirm(true)}
                >
                  {t('Excluir')}
                </Button>
              </>
            )}
          </Box>
        </Box>
        <Dialog open={confirm} onClose={() => setConfirm(false)}>
          <DialogTitle>{t('Excluir usuário')}</DialogTitle>
          <DialogContent>
            <Typography>{profile.name}</Typography>
            <Typography>
              {t(
                'Confirma a exclusão deste usuário? Esta ação não pode ser desfeita.',
              )}
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button
              fullWidth
              variant="contained"
              size="medium"
              onClick={() => setConfirm(false)}
            >
              {t('Cancelar')}
            </Button>
            <Button
              fullWidth
              variant="contained"
              size="medium"
              color="error"
              onClick={() => {
                setConfirm(false);
                try {
                  deleteManagedUser(user.id);
                  onChange();
                  onBack();
                } catch (e) {
                  setMessage({ error: true, text: e.message });
                }
              }}
            >
              {t('Excluir')}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </section>
  );
}
