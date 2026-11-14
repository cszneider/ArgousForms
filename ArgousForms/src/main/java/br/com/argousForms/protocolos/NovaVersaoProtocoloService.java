package br.com.argousForms.protocolos;

import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

import org.json.JSONArray;
import org.json.JSONObject;

import br.com.argousForms.api.ArgousFormsApiException;
import br.com.argousForms.auth.AutenticacaoLocalService;
import br.com.argousForms.model.negocio.processos.EncaminhamentoNegocio;
import br.com.argousForms.model.negocio.processos.FormularioNegocio;
import br.com.argousForms.model.negocio.processos.FormularioVariavelNegocio;
import br.com.argousForms.model.negocio.processos.ProtocoloDocumentoHTMLNegocio;
import br.com.argousForms.model.negocio.processos.ProtocoloDocumentoHtmlParteNegocio;
import br.com.argousForms.model.negocio.processos.ProtocoloDocumentoPDFNegocio;
import br.com.argousForms.model.negocio.processos.ProtocoloDocumentoPdfCampoNegocio;
import br.com.argousForms.model.negocio.processos.ProtocoloDocumentoVersaoNegocio;
import br.com.argousForms.model.negocio.processos.ProtocoloEtapaDestinatarioNegocio;
import br.com.argousForms.model.negocio.processos.ProtocoloEtapaNegocio;
import br.com.argousForms.model.negocio.processos.ProtocoloGestorElegivelNegocio;
import br.com.argousForms.model.negocio.processos.ProtocoloVersaoDocumentoNegocio;
import br.com.argousForms.model.negocio.processos.ProtocoloVersaoNegocio;
import br.com.argousForms.model.negocio.processos.ProtocoloVersaoVariavelNegocio;
import br.com.argousForms.model.persistencia.processos.Encaminhamento;
import br.com.argousForms.model.persistencia.processos.EncaminhamentoLocalizador;
import br.com.argousForms.model.persistencia.processos.Formulario;
import br.com.argousForms.model.persistencia.processos.FormularioVariavel;
import br.com.argousForms.model.persistencia.processos.ProtocoloDocumentoHTML;
import br.com.argousForms.model.persistencia.processos.ProtocoloDocumentoHtmlParte;
import br.com.argousForms.model.persistencia.processos.ProtocoloDocumentoPDF;
import br.com.argousForms.model.persistencia.processos.ProtocoloDocumentoPdfCampo;
import br.com.argousForms.model.persistencia.processos.ProtocoloDocumentoVersao;
import br.com.argousForms.model.persistencia.processos.ProtocoloEtapa;
import br.com.argousForms.model.persistencia.processos.ProtocoloEtapaDestinatario;
import br.com.argousForms.model.persistencia.processos.ProtocoloEtapaLocalizador;
import br.com.argousForms.model.persistencia.processos.ProtocoloGestorElegivel;
import br.com.argousForms.model.persistencia.processos.ProtocoloVersao;
import br.com.argousForms.model.persistencia.processos.ProtocoloVersaoDocumento;
import br.com.argousForms.model.persistencia.processos.ProtocoloVersaoVariavel;
import quatro.sql.Conexao;
import quatro.sql.PoolDeConexoes;
import quatro.util.QtData;

public final class NovaVersaoProtocoloService {

	public JSONObject criar( AutenticacaoLocalService.Usuario usuario, UUID idProtocolo ) throws Exception {

		if( !usuario.papeis().contains( "CRIADOR_DE_PROTOCOLOS" ) && !usuario.papeis().contains( "MODELADOR" ) ) throw new ArgousFormsApiException( 403, "ACESSO_NEGADO", "Seu usuário não pode criar versões de Protocolos." );
		try ( Conexao conexao = PoolDeConexoes.getConexao() ) {
			conexao.beginTransaction();
			try {
				String titulo;
				String descricao;
				UUID origem;
				String sql = "select p.DS_TITULO, p.DS_DESCRICAO, (select v.ID_PROTOCOLO_VERSAO from Processos.PROTOCOLO_VERSOES v where v.ID_PROTOCOLO = p.ID_PROTOCOLO and v.NR_VERSAO > 0 order by v.NR_VERSAO desc limit 1) from Processos.PROTOCOLOS p where p.ID_PROTOCOLO = ? and p.ID_USUARIO_CRIADOR = ? for update of p";
				try ( PreparedStatement consulta = conexao.getConnection().prepareStatement( sql ) ) {
					consulta.setObject( 1, idProtocolo );
					consulta.setObject( 2, usuario.idUsuario() );
					try ( ResultSet linha = consulta.executeQuery() ) {
						if( !linha.next() ) throw new ArgousFormsApiException( 404, "PROTOCOLO_NAO_ENCONTRADO", "Protocolo indisponível para este Criador." );
						titulo = linha.getString( 1 );
						descricao = linha.getString( 2 );
						origem = linha.getObject( 3, UUID.class );
					}
				}
				if( origem == null ) throw new ArgousFormsApiException( 409, "VERSAO_PUBLICADA_NAO_ENCONTRADA", "Publique a primeira versão antes de criar outra." );
				if( existeRascunho( conexao, idProtocolo ) ) throw new ArgousFormsApiException( 409, "RASCUNHO_EXISTENTE", "Este Protocolo já possui um rascunho em andamento." );

				QtData agora = new QtData( Instant.now().toEpochMilli() );
				ProtocoloVersao nova = new ProtocoloVersao();
				nova.setIdProtocoloVersao( UUID.randomUUID() );
				nova.setIdProtocolo( idProtocolo );
				nova.setNrVersao( -1 );
				nova.setTpSituacao( "R" );
				nova.setIdUsuarioAbriu( usuario.idUsuario() );
				nova.setIdUsuarioResponsavel( usuario.idUsuario() );
				nova.setDtInclusao( agora );
				nova.setDtAlteracao( agora );
				nova.setDsTitulo( titulo );
				nova.setDsDescricao( descricao );
				try ( PreparedStatement consulta = conexao.getConnection().prepareStatement( "select SN_PERMITE_CONVIDADOS, TX_SCRIPT_INICIALIZACAO, TX_SCRIPT_FINALIZACAO, SN_GESTOR_FINALIZA from Processos.PROTOCOLO_VERSOES where ID_PROTOCOLO_VERSAO = ?" ) ) {
					consulta.setObject( 1, origem );
					try ( ResultSet linha = consulta.executeQuery() ) {
						linha.next();
						nova.setSnPermiteConvidados( linha.getBoolean( 1 ) );
						nova.setSnGestorFinaliza( linha.getBoolean( 4 ) );
						nova.setTxScriptInicializacao( linha.getString( 2 ) );
						nova.setTxScriptFinalizacao( linha.getString( 3 ) );
					}
				}
				new ProtocoloVersaoNegocio( conexao, nova ).insere();

				copiarVariaveis( conexao, origem, nova.getIdProtocoloVersao() );
				Map<UUID, UUID> formularios = copiarFormularios( conexao, origem, nova.getIdProtocoloVersao(), agora );
				Map<UUID, UUID> documentos = copiarDocumentos( conexao, origem, nova.getIdProtocoloVersao(), agora );
				copiarFluxo( conexao, origem, nova.getIdProtocoloVersao(), formularios, documentos );
				copiarGestores( conexao, origem, nova.getIdProtocoloVersao() );
				conexao.commit();
				return new JSONObject().put( "idProtocolo", idProtocolo.toString() ).put( "idVersao", nova.getIdProtocoloVersao().toString() );
			} catch ( Exception e ) {
				if( conexao.inTransaction() ) conexao.rollback();
				throw e;
			}
		}
	}

	private boolean existeRascunho( Conexao conexao, UUID idProtocolo ) throws Exception {

		try ( PreparedStatement consulta = conexao.getConnection().prepareStatement( "select 1 from Processos.PROTOCOLO_VERSOES where ID_PROTOCOLO = ? and NR_VERSAO = -1" ) ) {
			consulta.setObject( 1, idProtocolo );
			try ( ResultSet linha = consulta.executeQuery() ) { return linha.next(); }
		}
	}

	private void copiarVariaveis( Conexao conexao, UUID origem, UUID destino ) throws Exception {

		String sql = "select x.ID_VARIAVEL, (select max(v.NR_VERSAO) from Processos.PROTOCOLO_VARIAVEL_VERSOES v where v.ID_VARIAVEL = x.ID_VARIAVEL) as NR_ATUAL from Processos.PROTOCOLO_VERSAO_VARIAVEIS x where x.ID_PROTOCOLO_VERSAO = ?";
		try ( PreparedStatement consulta = conexao.getConnection().prepareStatement( sql ) ) {
			consulta.setObject( 1, origem );
			try ( ResultSet linhas = consulta.executeQuery() ) {
				while( linhas.next() ) {
					ProtocoloVersaoVariavel item = new ProtocoloVersaoVariavel();
					item.setIdProtocoloVersao( destino );
					item.setIdVariavel( linhas.getObject( 1, UUID.class ) );
					item.setNrVersao( linhas.getInt( 2 ) );
					new ProtocoloVersaoVariavelNegocio( conexao, item ).insere();
				}
			}
		}
	}

	private Map<UUID, UUID> copiarFormularios( Conexao conexao, UUID origem, UUID destino, QtData agora ) throws Exception {

		Map<UUID, UUID> ids = new HashMap<>();
		try ( PreparedStatement consulta = conexao.getConnection().prepareStatement( "select ID_FORMULARIO, DS_TITULO, DS_DESCRICAO from Processos.FORMULARIOS where ID_PROTOCOLO_VERSAO = ?" ) ) {
			consulta.setObject( 1, origem );
			try ( ResultSet linhas = consulta.executeQuery() ) {
				while( linhas.next() ) {
					UUID antigo = linhas.getObject( 1, UUID.class );
					Formulario formulario = new Formulario();
					formulario.setIdFormulario( UUID.randomUUID() );
					formulario.setIdProtocoloVersao( destino );
					formulario.setDsTitulo( linhas.getString( 2 ) );
					formulario.setDsDescricao( linhas.getString( 3 ) );
					formulario.setDtInclusao( agora );
					new FormularioNegocio( conexao, formulario ).insere();
					ids.put( antigo, formulario.getIdFormulario() );
					copiarCamposFormulario( conexao, antigo, formulario.getIdFormulario() );
				}
			}
		}
		return ids;
	}

	private void copiarCamposFormulario( Conexao conexao, UUID origem, UUID destino ) throws Exception {

		try ( PreparedStatement consulta = conexao.getConnection().prepareStatement( "select ID_VARIAVEL, TP_ACESSO, NR_ORDEM, SN_OBRIGATORIA, TP_APRESENTACAO from Processos.FORMULARIO_VARIAVEIS where ID_FORMULARIO = ?" ) ) {
			consulta.setObject( 1, origem );
			try ( ResultSet linhas = consulta.executeQuery() ) {
				while( linhas.next() ) {
					FormularioVariavel campo = new FormularioVariavel();
					campo.setIdFormulario( destino );
					campo.setIdVariavel( linhas.getObject( 1, UUID.class ) );
					campo.setTpAcesso( linhas.getString( 2 ) );
					campo.setNrOrdem( linhas.getInt( 3 ) );
					campo.setSnObrigatoria( linhas.getBoolean( 4 ) );
					campo.setTpApresentacao( linhas.getString( 5 ) );
					new FormularioVariavelNegocio( conexao, campo ).insere();
				}
			}
		}
	}

	private Map<UUID, UUID> copiarDocumentos( Conexao conexao, UUID origem, UUID destino, QtData agora ) throws Exception {

		Map<UUID, UUID> ids = new HashMap<>();
		String sql = "select x.ID_PROTOCOLO_DOCUMENTO, v.ID_PROTOCOLO_DOCUMENTO_VERSAO, v.TP_MODELO, v.DS_OBSERVACOES, v.NR_DIAS_VENCIMENTO from Processos.PROTOCOLO_VERSAO_DOCUMENTOS x join Processos.PROTOCOLO_DOCUMENTO_VERSOES v on v.ID_PROTOCOLO_DOCUMENTO_VERSAO = x.ID_PROTOCOLO_DOCUMENTO_VERSAO where x.ID_PROTOCOLO_VERSAO = ?";
		try ( PreparedStatement consulta = conexao.getConnection().prepareStatement( sql ) ) {
			consulta.setObject( 1, origem );
			try ( ResultSet linhas = consulta.executeQuery() ) {
				while( linhas.next() ) {
					UUID idDocumento = linhas.getObject( 1, UUID.class );
					UUID idAnterior = linhas.getObject( 2, UUID.class );
					ProtocoloDocumentoVersao versao = new ProtocoloDocumentoVersao();
					versao.setIdProtocoloDocumentoVersao( UUID.randomUUID() );
					versao.setIdProtocoloDocumento( idDocumento );
					versao.setNrVersao( proximoNumeroModelo( conexao, idDocumento ) );
					versao.setTpModelo( linhas.getString( 3 ) );
					versao.setDsObservacoes( linhas.getString( 4 ) );
					versao.setNrDiasVencimento( linhas.getObject( 5 ) == null ? null : linhas.getInt( 5 ) );
					versao.setDtInclusao( agora );
					new ProtocoloDocumentoVersaoNegocio( conexao, versao ).insere();
					UUID idNovo = versao.getIdProtocoloDocumentoVersao();
					if( "P".equals( versao.getTpModelo() ) ) copiarPdf( conexao, idAnterior, idNovo, agora );
					else if( "H".equals( versao.getTpModelo() ) ) copiarHtml( conexao, idAnterior, idNovo, agora );
					else throw new ArgousFormsApiException( 409, "MODELO_DESCONHECIDO", "Há um tipo de modelo de documento desconhecido." );
					ProtocoloVersaoDocumento vinculo = new ProtocoloVersaoDocumento();
					vinculo.setIdProtocoloVersao( destino );
					vinculo.setIdProtocoloDocumento( idDocumento );
					vinculo.setIdProtocoloDocumentoVersao( idNovo );
					new ProtocoloVersaoDocumentoNegocio( conexao, vinculo ).insere();
					ids.put( idAnterior, idNovo );
				}
			}
		}
		return ids;
	}

	private int proximoNumeroModelo( Conexao conexao, UUID idDocumento ) throws Exception {

		try ( PreparedStatement consulta = conexao.getConnection().prepareStatement( "select coalesce(max(NR_VERSAO), 0) + 1 from Processos.PROTOCOLO_DOCUMENTO_VERSOES where ID_PROTOCOLO_DOCUMENTO = ?" ) ) {
			consulta.setObject( 1, idDocumento );
			try ( ResultSet linha = consulta.executeQuery() ) { linha.next(); return linha.getInt( 1 ); }
		}
	}

	private void copiarPdf( Conexao conexao, UUID origem, UUID destino, QtData agora ) throws Exception {

		try ( PreparedStatement consulta = conexao.getConnection().prepareStatement( "select ID_ARQUIVO_MODELO_PDF from Processos.PROTOCOLO_DOCUMENTO_PDF where ID_PROTOCOLO_DOCUMENTO_VERSAO = ?" ) ) {
			consulta.setObject( 1, origem );
			try ( ResultSet linha = consulta.executeQuery() ) {
				if( !linha.next() ) throw new ArgousFormsApiException( 409, "PDF_AUSENTE", "Modelo PDF publicado sem arquivo de origem." );
				ProtocoloDocumentoPDF pdf = new ProtocoloDocumentoPDF();
				pdf.setIdProtocoloDocumentoVersao( destino );
				pdf.setIdArquivoModeloPdf( linha.getObject( 1, UUID.class ) );
				pdf.setDtInclusao( agora );
				new ProtocoloDocumentoPDFNegocio( conexao, pdf ).insere();
			}
		}
		try ( PreparedStatement consulta = conexao.getConnection().prepareStatement( "select ID_VARIAVEL, ID_ATRIBUTO, NR_PAGINA, VL_POS_X, VL_POS_Y, VL_LARGURA, VL_ALTURA, JS_APRESENTACAO from Processos.PROTOCOLO_DOCUMENTO_PDF_CAMPOS where ID_PROTOCOLO_DOCUMENTO_VERSAO = ?" ) ) {
			consulta.setObject( 1, origem );
			try ( ResultSet linhas = consulta.executeQuery() ) {
				while( linhas.next() ) {
					ProtocoloDocumentoPdfCampo campo = new ProtocoloDocumentoPdfCampo();
					campo.setIdPdfCampo( UUID.randomUUID() );
					campo.setIdProtocoloDocumentoVersao( destino );
					campo.setIdVariavel( linhas.getObject( 1, UUID.class ) );
					campo.setIdAtributo( (Integer) linhas.getObject( 2 ) );
					campo.setNrPagina( linhas.getInt( 3 ) );
					campo.setVlPosX( linhas.getBigDecimal( 4 ) );
					campo.setVlPosY( linhas.getBigDecimal( 5 ) );
					campo.setVlLargura( linhas.getBigDecimal( 6 ) );
					campo.setVlAltura( linhas.getBigDecimal( 7 ) );
					campo.setJsApresentacao( linhas.getString( 8 ) );
					new ProtocoloDocumentoPdfCampoNegocio( conexao, campo ).insere();
				}
			}
		}
	}

	private void copiarHtml( Conexao conexao, UUID origem, UUID destino, QtData agora ) throws Exception {

		try ( PreparedStatement consulta = conexao.getConnection().prepareStatement( "select TX_CSS from Processos.PROTOCOLO_DOCUMENTO_HTML where ID_PROTOCOLO_DOCUMENTO_VERSAO = ?" ) ) {
			consulta.setObject( 1, origem );
			try ( ResultSet linha = consulta.executeQuery() ) {
				if( !linha.next() ) throw new ArgousFormsApiException( 409, "HTML_AUSENTE", "Modelo HTML publicado sem conteúdo." );
				ProtocoloDocumentoHTML html = new ProtocoloDocumentoHTML();
				html.setIdProtocoloDocumentoVersao( destino );
				html.setTxCss( linha.getString( 1 ) );
				html.setDtInclusao( agora );
				new ProtocoloDocumentoHTMLNegocio( conexao, html ).insere();
			}
		}
		try ( PreparedStatement consulta = conexao.getConnection().prepareStatement( "select TP_PARTE, NR_ORDEM, TX_HTML from Processos.PROTOCOLO_DOCUMENTO_HTML_PARTES where ID_PROTOCOLO_DOCUMENTO_VERSAO = ?" ) ) {
			consulta.setObject( 1, origem );
			try ( ResultSet linhas = consulta.executeQuery() ) {
				while( linhas.next() ) {
					ProtocoloDocumentoHtmlParte parte = new ProtocoloDocumentoHtmlParte();
					parte.setIdDocumentoHtmlParte( UUID.randomUUID() );
					parte.setIdProtocoloDocumentoVersao( destino );
					parte.setTpParte( linhas.getString( 1 ) );
					parte.setNrOrdem( linhas.getInt( 2 ) );
					parte.setTxHtml( linhas.getString( 3 ) );
					new ProtocoloDocumentoHtmlParteNegocio( conexao, parte ).insere();
				}
			}
		}
	}

	private void copiarFluxo( Conexao conexao, UUID origem, UUID destino, Map<UUID, UUID> formularios, Map<UUID, UUID> documentos ) throws Exception {

		Map<UUID, UUID> etapas = new HashMap<>();
		Map<UUID, UUID> saidas = new HashMap<>();
		try ( PreparedStatement consulta = conexao.getConnection().prepareStatement( "select ID_PROTOCOLO_ETAPA, ID_FORMULARIO, DS_TITULO, DS_OBSERVACOES, NR_POSICAO_X, NR_POSICAO_Y, TX_SCRIPT_INICIALIZACAO, TX_SCRIPT_FINALIZACAO, ID_ENCAMINHAMENTO, JS_GERACAO_DOCUMENTOS from Processos.PROTOCOLOS_ETAPAS where ID_PROTOCOLO_VERSAO = ?" ) ) {
			consulta.setObject( 1, origem );
			try ( ResultSet linhas = consulta.executeQuery() ) {
				while( linhas.next() ) {
					UUID antigo = linhas.getObject( 1, UUID.class );
					UUID formulario = formularios.get( linhas.getObject( 2, UUID.class ) );
					if( formulario == null ) throw new ArgousFormsApiException( 409, "FLUXO_INCONSISTENTE", "Uma etapa do fluxo não possui formulário nesta versão." );
					ProtocoloEtapa etapa = new ProtocoloEtapa();
					etapa.setIdProtocoloEtapa( UUID.randomUUID() );
					etapa.setIdProtocoloVersao( destino );
					etapa.setIdFormulario( formulario );
					etapa.setDsTitulo( linhas.getString( 3 ) );
					etapa.setDsObservacoes( linhas.getString( 4 ) );
					etapa.setNrPosicaoX( linhas.getInt( 5 ) );
					etapa.setNrPosicaoY( linhas.getInt( 6 ) );
					etapa.setTxScriptInicializacao( linhas.getString( 7 ) );
					etapa.setTxScriptFinalizacao( linhas.getString( 8 ) );
					UUID saida = linhas.getObject( 9, UUID.class );
					if( saida != null ) saidas.put( antigo, saida );
					etapa.setJsGeracaoDocumentos( remapearDocumentos( linhas.getString( 10 ), documentos ) );
					new ProtocoloEtapaNegocio( conexao, etapa ).insere();
					etapas.put( antigo, etapa.getIdProtocoloEtapa() );
				}
			}
		}

		for( Map.Entry<UUID, UUID> item : etapas.entrySet() ) copiarDestinatarios( conexao, item.getKey(), item.getValue() );
		Map<UUID, UUID> encaminhamentos = copiarEncaminhamentos( conexao, origem, destino, etapas );
		for( Map.Entry<UUID, UUID> item : saidas.entrySet() ) {
			ProtocoloEtapa etapa = ProtocoloEtapaLocalizador.buscaProtocoloEtapa( conexao, etapas.get( item.getKey() ) );
			etapa.setIdEncaminhamento( encaminhamentos.get( item.getValue() ) );
			new ProtocoloEtapaNegocio( conexao, etapa ).altera();
		}
	}

	private String remapearDocumentos( String definicao, Map<UUID, UUID> documentos ) throws Exception {

		if( definicao == null ) return null;
		JSONObject json = new JSONObject( definicao );
		JSONArray anteriores = json.optJSONArray( "aoFinalizar" );
		if( anteriores == null ) return definicao;
		JSONArray novos = new JSONArray();
		for( int i = 0; i < anteriores.length(); i++ ) {
			UUID novo = documentos.get( UUID.fromString( anteriores.getString( i ) ) );
			if( novo == null ) throw new ArgousFormsApiException( 409, "DOCUMENTO_INCONSISTENTE", "Uma etapa gera um documento ausente desta versão." );
			novos.put( novo.toString() );
		}
		json.put( "aoFinalizar", novos );
		return json.toString();
	}

	private void copiarDestinatarios( Conexao conexao, UUID origem, UUID destino ) throws Exception {

		try ( PreparedStatement consulta = conexao.getConnection().prepareStatement( "select ID_USUARIO_SISTEMA, ID_GRUPO, CD_TAG_GRUPO, CD_TAG_USUARIO, CD_TAG_VINCULO from Processos.PROTOCOLO_ETAPA_DESTINATARIOS where ID_PROTOCOLO_ETAPA = ?" ) ) {
			consulta.setObject( 1, origem );
			try ( ResultSet linhas = consulta.executeQuery() ) {
				while( linhas.next() ) {
					ProtocoloEtapaDestinatario regra = new ProtocoloEtapaDestinatario();
					regra.setIdEtapaDestinatario( UUID.randomUUID() );
					regra.setIdProtocoloEtapa( destino );
					regra.setIdUsuarioSistema( linhas.getObject( 1, UUID.class ) );
					regra.setIdGrupo( (Integer) linhas.getObject( 2 ) );
					regra.setCdTagGrupo( linhas.getString( 3 ) );
					regra.setCdTagUsuario( linhas.getString( 4 ) );
					regra.setCdTagVinculo( linhas.getString( 5 ) );
					new ProtocoloEtapaDestinatarioNegocio( conexao, regra ).insere();
				}
			}
		}
	}

	private Map<UUID, UUID> copiarEncaminhamentos( Conexao conexao, UUID origem, UUID destino, Map<UUID, UUID> etapas ) throws Exception {

		Map<UUID, UUID> ids = new HashMap<>();
		Map<UUID, UUID> proximos = new HashMap<>();
		try ( PreparedStatement consulta = conexao.getConnection().prepareStatement( "select ID_ENCAMINHAMENTO, TP_ENCAMINHAMENTO, TX_TESTE, ID_PROXIMA_ETAPA, ID_PROXIMO_ENCAMINHAMENTO from Processos.ENCAMINHAMENTOS where ID_PROTOCOLO_VERSAO = ?" ) ) {
			consulta.setObject( 1, origem );
			try ( ResultSet linhas = consulta.executeQuery() ) {
				while( linhas.next() ) {
					UUID antigo = linhas.getObject( 1, UUID.class );
					UUID etapa = etapas.get( linhas.getObject( 4, UUID.class ) );
					if( etapa == null ) throw new ArgousFormsApiException( 409, "FLUXO_INCONSISTENTE", "Encaminhamento sem etapa de destino nesta versão." );
					Encaminhamento caminho = new Encaminhamento();
					caminho.setIdEncaminhamento( UUID.randomUUID() );
					caminho.setIdProtocoloVersao( destino );
					caminho.setTpEncaminhamento( linhas.getString( 2 ) );
					caminho.setTxTeste( linhas.getString( 3 ) );
					caminho.setIdProximaEtapa( etapa );
					new EncaminhamentoNegocio( conexao, caminho ).insere();
					ids.put( antigo, caminho.getIdEncaminhamento() );
					UUID proximo = linhas.getObject( 5, UUID.class );
					if( proximo != null ) proximos.put( antigo, proximo );
				}
			}
		}
		for( Map.Entry<UUID, UUID> item : proximos.entrySet() ) {
			Encaminhamento caminho = EncaminhamentoLocalizador.buscaEncaminhamento( conexao, ids.get( item.getKey() ) );
			caminho.setIdProximoEncaminhamento( ids.get( item.getValue() ) );
			new EncaminhamentoNegocio( conexao, caminho ).altera();
		}
		return ids;
	}

	private void copiarGestores( Conexao conexao, UUID origem, UUID destino ) throws Exception {

		try ( PreparedStatement consulta = conexao.getConnection().prepareStatement( "select ID_USUARIO_SISTEMA, ID_GRUPO, CD_TAG_GRUPO, CD_TAG_USUARIO, CD_TAG_VINCULO from Processos.PROTOCOLO_GESTORES_ELEGIVEIS where ID_PROTOCOLO_VERSAO = ?" ) ) {
			consulta.setObject( 1, origem );
			try ( ResultSet linhas = consulta.executeQuery() ) {
				while( linhas.next() ) {
					ProtocoloGestorElegivel regra = new ProtocoloGestorElegivel();
					regra.setIdGestorElegivel( UUID.randomUUID() );
					regra.setIdProtocoloVersao( destino );
					regra.setIdUsuarioSistema( linhas.getObject( 1, UUID.class ) );
					regra.setIdGrupo( (Integer) linhas.getObject( 2 ) );
					regra.setCdTagGrupo( linhas.getString( 3 ) );
					regra.setCdTagUsuario( linhas.getString( 4 ) );
					regra.setCdTagVinculo( linhas.getString( 5 ) );
					new ProtocoloGestorElegivelNegocio( conexao, regra ).insere();
				}
			}
		}
	}
}
