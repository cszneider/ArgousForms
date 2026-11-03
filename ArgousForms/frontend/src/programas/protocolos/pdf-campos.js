'use client';

import { useEffect, useRef, useState } from 'react';
import { Alert, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, TextField } from '@mui/material';
import { useI18n } from '../../components/i18n/i18n.js';
import { alinharCampos, apresentacaoCampo } from './pdf-campos-layout.js';

const arredondar = (valor) => Math.round(valor * 100) / 100;
const limitar = (valor, minimo, maximo) => Math.max(minimo, Math.min(maximo, valor));

export default function PdfCampos({ modelo, variaveis, aoFechar, aoCriarVariavel, aoSalvar }) {
  const { t } = useI18n();
  const canvas = useRef(null);
  const pdf = useRef(null);
  const pdfBytes = useRef(null);
  const previaUrl = useRef(null);
  const ativo = useRef(true);
  const movimento = useRef(null);
  const sequencia = useRef(0);
  const [pagina, setPagina] = useState(1);
  const [totalPaginas, setTotalPaginas] = useState(0);
  const [tamanho, setTamanho] = useState(null);
  const [variavel, setVariavel] = useState('');
  const [campos, setCampos] = useState(() => modelo.campos || []);
  const [selecionados, setSelecionados] = useState([]);
  const [alterado, setAlterado] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [gerandoPrevia, setGerandoPrevia] = useState(false);
  const [urlPrevia, setUrlPrevia] = useState(null);
  const [carregandoPrevia, setCarregandoPrevia] = useState(false);

  useEffect(() => {
    ativo.current = true;
    return () => {
      ativo.current = false;
      if (previaUrl.current) URL.revokeObjectURL(previaUrl.current);
    };
  }, []);

  useEffect(() => {
    let cancelado = false;
    const url = `/ArgousForms/arquivo-conteudo?idArquivo=${encodeURIComponent(modelo.idArquivo)}&idArquivoVersao=${encodeURIComponent(modelo.idArquivoVersao)}&modo=visualizar`;
    fetch(url, { credentials: 'same-origin' })
      .then(async (resposta) => {
        if (!resposta.ok) throw new Error(t('Não foi possível abrir o PDF do modelo.'));
        const { openPdf } = await import('../editor/import-model.js');
        const dados = await resposta.arrayBuffer();
        pdfBytes.current = dados;
        return openPdf(dados.slice(0));
      })
      .then((documento) => {
        if (cancelado) { documento.destroy(); return; }
        pdf.current = documento;
        setTotalPaginas(documento.numPages);
      })
      .catch((falha) => { if (!cancelado) { setErro(falha.message); setCarregando(false); } });
    return () => {
      cancelado = true;
      if (pdf.current) { pdf.current.destroy(); pdf.current = null; }
      pdfBytes.current = null;
    };
  }, [modelo.idArquivo, modelo.idArquivoVersao, t]);

  useEffect(() => {
    if (!pdf.current || !canvas.current || !totalPaginas) return;
    let cancelado = false;
    let tarefa;
    setCarregando(true);
    pdf.current.getPage(pagina).then(async (paginaPdf) => {
      if (cancelado) return;
      const base = paginaPdf.getViewport({ scale: 1 });
      const escala = Math.min(1.5, 780 / base.width);
      const viewport = paginaPdf.getViewport({ scale: escala });
      const elemento = canvas.current;
      elemento.width = Math.ceil(viewport.width);
      elemento.height = Math.ceil(viewport.height);
      setTamanho({ largura: base.width, altura: base.height, escala });
      tarefa = paginaPdf.render({ canvas: elemento, canvasContext: elemento.getContext('2d'), viewport });
      await tarefa.promise;
      if (!cancelado) setCarregando(false);
    }).catch((falha) => {
      if (!cancelado && falha?.name !== 'RenderingCancelledException') { setErro(falha.message); setCarregando(false); }
    });
    return () => { cancelado = true; tarefa?.cancel(); };
  }, [pagina, totalPaginas]);

  function posicionar(evento) {
    if (!variavel || !tamanho || carregando) return;
    const limite = evento.currentTarget.getBoundingClientRect();
    const largura = Math.min(120, tamanho.largura);
    const altura = Math.min(24, tamanho.altura);
    const posX = evento.detail === 0 ? limite.width / 2 : evento.clientX - limite.left;
    const posY = evento.detail === 0 ? limite.height / 2 : evento.clientY - limite.top;
    const x = limitar(posX / limite.width * tamanho.largura, 0, tamanho.largura - largura);
    const y = limitar(posY / limite.height * tamanho.altura, 0, tamanho.altura - altura);
    const id = `novo-${++sequencia.current}`;
    setCampos((atuais) => [...atuais, { id, idVariavel: variavel,
      pagina, x: arredondar(x), y: arredondar(y), largura: arredondar(largura), altura: arredondar(altura), apresentacao: {} }]);
    setSelecionados([id]);
    setVariavel('');
    setAlterado(true);
  }

  function iniciarMovimento(evento, campo, tipo) {
    if (!tamanho || salvando) return;
    evento.preventDefault();
    evento.stopPropagation();
    selecionarCampo(campo, evento.shiftKey || evento.metaKey || evento.ctrlKey);
    const limite = evento.currentTarget.closest('.pdf-campos-pagina').getBoundingClientRect();
    movimento.current = { id: campo.id, tipo, inicioX: evento.clientX, inicioY: evento.clientY,
      origem: campo, fatorX: tamanho.largura / limite.width, fatorY: tamanho.altura / limite.height };
    evento.currentTarget.setPointerCapture(evento.pointerId);
  }

  function mover(evento) {
    const atual = movimento.current;
    if (!atual || !tamanho) return;
    const dx = (evento.clientX - atual.inicioX) * atual.fatorX;
    const dy = (evento.clientY - atual.inicioY) * atual.fatorY;
    setCampos((anteriores) => anteriores.map((campo) => {
      if (campo.id !== atual.id) return campo;
      if (atual.tipo === 'redimensionar') {
        return { ...campo, largura: arredondar(limitar(atual.origem.largura + dx, 20, tamanho.largura - campo.x)),
          altura: arredondar(limitar(atual.origem.altura + dy, 12, tamanho.altura - campo.y)) };
      }
      return { ...campo, x: arredondar(limitar(atual.origem.x + dx, 0, tamanho.largura - campo.largura)),
        y: arredondar(limitar(atual.origem.y + dy, 0, tamanho.altura - campo.altura)) };
    }));
    setAlterado(true);
  }

  function terminarMovimento(evento) {
    if (!movimento.current) return;
    movimento.current = null;
    if (evento.currentTarget.hasPointerCapture(evento.pointerId)) evento.currentTarget.releasePointerCapture(evento.pointerId);
  }

  function selecionarCampo(campo, alternar = false) {
    if (campo.pagina !== pagina) return;
    setSelecionados((atuais) => {
      if (alternar) return atuais.includes(campo.id) ? atuais.filter((id) => id !== campo.id) : [...atuais, campo.id];
      return atuais.includes(campo.id) ? atuais : [campo.id];
    });
  }

  function alinhar(direcao) {
    if (selecionados.length < 2) return;
    setCampos((atuais) => alinharCampos(atuais, selecionados, direcao));
    setAlterado(true);
  }

  function alterarApresentacao(chave, valor) {
    if (!selecionados.length) return;
    const ids = new Set(selecionados);
    setCampos((atuais) => atuais.map((campo) => ids.has(campo.id)
      ? { ...campo, apresentacao: { ...campo.apresentacao, [chave]: valor } } : campo));
    setAlterado(true);
  }

  function fechar() {
    if (salvando) return;
    if (alterado && !globalThis.confirm(t('Descartar alterações não salvas nos campos do PDF?'))) return;
    aoFechar();
  }

  async function salvar() {
    if (salvando) return;
    setSalvando(true);
    setErro('');
    try { await aoSalvar(campos); }
    catch (falha) { setErro(falha.message); }
    finally { setSalvando(false); }
  }

  async function abrirPrevia() {
    if (!pdfBytes.current || !pdf.current || gerandoPrevia || !campos.length) return;
    setGerandoPrevia(true);
    setErro('');
    try {
      const { gerarPreviaPdf } = await import('./pdf-campos-preview.js');
      if (!ativo.current || !pdfBytes.current || !pdf.current) return;
      const arquivo = await gerarPreviaPdf(pdfBytes.current, pdf.current, campos, variaveis);
      if (!ativo.current) return;
      if (previaUrl.current) URL.revokeObjectURL(previaUrl.current);
      previaUrl.current = URL.createObjectURL(arquivo);
      setCarregandoPrevia(true);
      setUrlPrevia(previaUrl.current);
    } catch (falha) {
      if (ativo.current) setErro(t(falha.message || 'Não foi possível gerar a prévia do PDF.', { nome: falha.nome || '' }));
    } finally {
      if (ativo.current) setGerandoPrevia(false);
    }
  }

  function fecharPrevia() {
    setUrlPrevia(null);
    setCarregandoPrevia(false);
    if (previaUrl.current) URL.revokeObjectURL(previaUrl.current);
    previaUrl.current = null;
  }

  const campoSelecionado = campos.find((campo) => campo.id === selecionados[0]);
  const estiloSelecionado = campoSelecionado ? apresentacaoCampo(campoSelecionado) : null;

  return <><Dialog open onClose={fechar} fullWidth maxWidth="lg">
    <DialogTitle>{t('Posicionar campos')} · {modelo.titulo}</DialogTitle>
    <DialogContent>
      {erro && <Alert severity="error" sx={{ mb: 2 }}>{erro}</Alert>}
      <div className="pdf-campos-controles">
        <TextField select size="small" label={t('Variável')} value={variavel} disabled={!variaveis.length || salvando}
          onChange={(evento) => setVariavel(evento.target.value)} sx={{ minWidth: 220 }}>
          <MenuItem value="">{t('Selecione uma variável')}</MenuItem>
          {variaveis.map((item) => <MenuItem key={item.id} value={item.id}>{item.nome} · {'{{'}{item.codigo}{'}}'}</MenuItem>)}
        </TextField>
        <span>{t(variavel ? 'Clique no PDF para posicionar a variável.' :
          variaveis.length ? 'Escolha uma variável para posicionar.' : 'Este Protocolo ainda não possui variáveis.')}</span>
        {!variaveis.length && <Button onClick={aoCriarVariavel}>{t('Cadastrar variável')}</Button>}
        <Button disabled={pagina <= 1 || salvando} onClick={() => { setSelecionados([]); setPagina(pagina - 1); }}>{t('Anterior')}</Button>
        <span>{t('Página')} {pagina} {t('de')} {totalPaginas || '…'}</span>
        <Button disabled={pagina >= totalPaginas || salvando} onClick={() => { setSelecionados([]); setPagina(pagina + 1); }}>{t('Próxima')}</Button>
        <Button variant="outlined" disabled={carregando || salvando || gerandoPrevia || !campos.length}
          onClick={abrirPrevia}>
          {t(gerandoPrevia ? 'Gerando prévia…' : 'Pré-visualizar PDF')}
        </Button>
      </div>
      <div className="pdf-campos-ferramentas">
        <div className="pdf-campos-ferramentas-linha">
          <strong>{t('Alinhar campos')}</strong>
          {[
            ['topo', 'Topo'], ['baixo', 'Base'], ['esquerda', 'Esquerda'],
            ['centro', 'Centralizar'], ['direita', 'Direita'],
          ].map(([direcao, rotulo]) => <Button key={direcao} size="small" variant="outlined"
            disabled={selecionados.length < 2 || salvando} onClick={() => alinhar(direcao)}>
            {t(rotulo)}
          </Button>)}
          <span>{t('Selecione dois ou mais campos da mesma página.')}</span>
        </div>
        {estiloSelecionado && <div className="pdf-campos-ferramentas-linha">
          <strong>{t('Fonte dos campos selecionados')}</strong>
          <span>{selecionados.length} {t(selecionados.length === 1 ? 'campo' : 'campos')}</span>
          <TextField select size="small" label={t('Fonte')} value={estiloSelecionado.fonte}
            disabled={salvando} sx={{ minWidth: 145 }}
            onChange={(evento) => alterarApresentacao('fonte', evento.target.value)}>
            <MenuItem value="HELVETICA">Helvetica</MenuItem>
            <MenuItem value="TIMES">Times</MenuItem>
            <MenuItem value="COURIER">Courier</MenuItem>
          </TextField>
          <TextField size="small" type="number" label={t('Tamanho (pt)')} value={estiloSelecionado.tamanho}
            disabled={salvando} inputProps={{ min: 4, max: 72, step: 0.5 }} sx={{ width: 125 }}
            onChange={(evento) => {
              const tamanhoFonte = Number(evento.target.value);
              if (tamanhoFonte >= 4 && tamanhoFonte <= 72) alterarApresentacao('tamanho', tamanhoFonte);
            }} />
          <label className="pdf-campos-cor">{t('Cor da fonte')}
            <input type="color" value={estiloSelecionado.cor} disabled={salvando}
              onChange={(evento) => alterarApresentacao('cor', evento.target.value)} />
          </label>
          {[
            ['negrito', 'Negrito'], ['italico', 'Itálico'], ['sublinhado', 'Sublinhado'],
          ].map(([chave, rotulo]) => <Button key={chave} size="small"
            variant={estiloSelecionado[chave] ? 'contained' : 'outlined'} disabled={salvando}
            aria-pressed={estiloSelecionado[chave]}
            onClick={() => alterarApresentacao(chave, !estiloSelecionado[chave])}>
            {t(rotulo)}
          </Button>)}
        </div>}
      </div>
      <div className="pdf-campos-rolagem">
        {carregando && <p>{t('Carregando página…')}</p>}
        <div className="pdf-campos-pagina" style={{ width: tamanho ? tamanho.largura * tamanho.escala : undefined }}>
          <canvas ref={canvas} />
          <button type="button" className="pdf-campos-superficie" disabled={!variavel || carregando || salvando}
            aria-label={t('Posicionar variável no PDF')} onClick={posicionar} />
          {tamanho && campos.filter((campo) => campo.pagina === pagina).map((campo) => {
            const item = variaveis.find((v) => v.id === campo.idVariavel);
            const posicao = { left: `${campo.x / tamanho.largura * 100}%`, top: `${campo.y / tamanho.altura * 100}%`,
              width: `${campo.largura / tamanho.largura * 100}%`, height: `${campo.altura / tamanho.altura * 100}%` };
            return <div className={`pdf-campos-marcador${selecionados.includes(campo.id) ? ' pdf-campos-marcador-selecionado' : ''}`} key={campo.id}
              style={posicao}>
              <button type="button" className="pdf-campos-mover" disabled={salvando}
                aria-label={`${t('Mover variável')} ${item?.nome || ''}`}
                onPointerDown={(evento) => iniciarMovimento(evento, campo, 'mover')}
                onPointerMove={mover} onPointerUp={terminarMovimento} onPointerCancel={terminarMovimento}>
                {`{{${item?.codigo || '?'}}}`}
              </button>
              <button type="button" className="pdf-campos-redimensionar" disabled={salvando}
                aria-label={`${t('Redimensionar variável')} ${item?.nome || ''}`}
                onPointerDown={(evento) => iniciarMovimento(evento, campo, 'redimensionar')}
                onPointerMove={mover} onPointerUp={terminarMovimento} onPointerCancel={terminarMovimento} />
            </div>;
          })}
        </div>
      </div>
      {campos.length > 0 && <div className="pdf-campos-lista">{campos.map((campo, indice) => {
        const item = variaveis.find((v) => v.id === campo.idVariavel);
        return <div key={campo.id}>
          <Checkbox size="small" checked={selecionados.includes(campo.id)} disabled={salvando || campo.pagina !== pagina}
            inputProps={{ 'aria-label': `${t('Selecionar campo')} ${item?.nome || indice + 1}` }}
            onChange={() => selecionarCampo(campo, true)} />
          {indice + 1}. {item?.nome || t('Variável')} · {t('Página')} {campo.pagina} · X {campo.x} · Y {campo.y}
          <Button size="small" disabled={salvando} onClick={() => {
            setCampos((atuais) => atuais.filter((valor) => valor.id !== campo.id));
            setSelecionados((atuais) => atuais.filter((id) => id !== campo.id));
            setAlterado(true);
          }}>{t('Remover')}</Button>
        </div>;
      })}</div>}
    </DialogContent>
    <DialogActions>
      <Button onClick={fechar} disabled={salvando}>{t('Fechar')}</Button>
      <Button variant="contained" onClick={salvar} disabled={salvando || carregando}>{t('Salvar campos')}</Button>
    </DialogActions>
  </Dialog>
    <Dialog open={!!urlPrevia} onClose={fecharPrevia} fullWidth maxWidth="xl">
      <DialogTitle>{t('Prévia do PDF')} · {modelo.titulo}</DialogTitle>
      <DialogContent>
        <p>{t('Esta prévia usa os valores de exemplo e inclui alterações de posição ainda não salvas.')}</p>
        {carregandoPrevia && <output>{t('Carregando prévia do PDF…')}</output>}
        {urlPrevia && <iframe className="pdf-campos-iframe" src={urlPrevia} title={t('Prévia do PDF')}
          onLoad={() => setCarregandoPrevia(false)} />}
      </DialogContent>
      <DialogActions><Button onClick={fecharPrevia}>{t('Fechar prévia')}</Button></DialogActions>
    </Dialog>
  </>;
}
