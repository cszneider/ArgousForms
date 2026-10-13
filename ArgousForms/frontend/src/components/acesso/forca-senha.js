import { Box, LinearProgress, Typography } from '@mui/material';
import { useI18n } from '../i18n/i18n.js';
import { avaliarSenha } from '../../programas/login/politica-senha.js';

export default function ForcaSenha({ senha }) {
  const { t } = useI18n();
  const resultado = avaliarSenha(senha);
  const criterios = [
    ['tamanho', 'De 8 a 1024 caracteres'],
    ['maiuscula', 'Letra maiúscula'],
    ['minuscula', 'Letra minúscula'],
    ['numeral', 'Numeral'],
    ['simbolo', 'Símbolo'],
  ];

  return <Box aria-live="polite" sx={{ width: '100%' }}>
    <Typography variant="body2" sx={{ mb: 0.5 }}>{t('Força da senha')}: {t(resultado.rotulo)}</Typography>
    <LinearProgress variant="determinate" value={resultado.forca} color={resultado.valida ? 'success' : 'warning'} />
    <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
      {t('Pelo menos 8 caracteres e 3 das 4 condições abaixo.')}
    </Typography>
    <Box component="ul" sx={{ mt: 0.5, mb: 0, pl: 2.5, color: 'text.secondary', fontSize: '0.78rem' }}>
      {criterios.map(([chave, texto]) => <li key={chave}>{resultado[chave] ? '✓' : '○'} {t(texto)}</li>)}
    </Box>
  </Box>;
}
