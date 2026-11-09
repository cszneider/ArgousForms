package br.com.argousForms.processos;

import java.math.BigDecimal;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.OffsetTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.logging.Level;
import java.util.logging.Logger;

import javax.servlet.ServletContext;

import org.json.JSONArray;
import org.json.JSONObject;

import br.com.argousForms.api.ArgousFormsApiException;
import br.com.argousForms.auth.AutenticacaoLocalService;
import br.com.argousForms.documentos.MongoArmazenamento;
import br.com.argousForms.model.negocio.processos.ProcessoEtapaNegocio;
import br.com.argousForms.model.negocio.processos.ProcessoEtapaEncaminhamentoNegocio;
import br.com.argousForms.model.negocio.processos.ProcessoEtapaResponsavelNegocio;
import br.com.argousForms.model.negocio.processos.ProcessoNegocio;
import br.com.argousForms.model.negocio.processos.ProcessoVariavelAtualNegocio;
import br.com.argousForms.model.negocio.processos.ProcessoVariavelValorNegocio;
import br.com.argousForms.model.persistencia.processos.ProcessoEtapa;
import br.com.argousForms.model.persistencia.processos.ProcessoEtapaEncaminhamento;
import br.com.argousForms.model.persistencia.processos.ProcessoEtapaLocalizador;
import br.com.argousForms.model.persistencia.processos.ProcessoEtapaResponsavel;
import br.com.argousForms.model.persistencia.processos.ProcessoEtapaResponsavelLocalizador;
import br.com.argousForms.model.persistencia.processos.Processo;
import br.com.argousForms.model.persistencia.processos.ProcessoLocalizador;
import br.com.argousForms.model.persistencia.processos.ProcessoVariavelAtual;
import br.com.argousForms.model.persistencia.processos.ProcessoVariavelValor;
import br.com.argousForms.model.persistencia.processos.ProcessoVariavelValorLocalizador;
import br.com.argousForms.protocolos.DefinicaoVariavelTexto;
import quatro.sql.Conexao;
import quatro.sql.PoolDeConexoes;
import quatro.util.QtData;

public final class PreenchimentoEtapaService {

	private static final Logger LOG = Logger.getLogger( PreenchimentoEtapaService.class.getName() );
	private final ProcessosService processos = new ProcessosService();

	public JSONObject consultar( AutenticacaoLocalService.Usuario usuario, UUID idEtapa ) throws Exception {

		try ( Conexao conexao = PoolDeConexoes.getConexao() ) {
			JSONObject etapa = etapa( conexao, idEtapa );
			boolean responsavel = usuario.idUsuario().toString().equals( etapa.optString( "responsavel" ) );
			boolean disponivel = elegivel( conexao, usuario, etapa );
			if( !responsavel && !disponivel ) throw new ArgousFormsApiException( 403, "ETAPA_SEM_ACESSO", "Esta etapa não está disponível para seu usuário." );
			return etapa.put( "podeAssumir", disponivel ).put( "podeEditar", responsavel && ( "I".equals( etapa.getString( "situacao" ) ) || "P".equals( etapa.getString( "situacao" ) ) || "S".equals( etapa.getString( "situacao" ) ) ) );
		}
	}

	public JSONObject assumir( AutenticacaoLocalService.Usuario usuario, UUID idEtapa ) throws Exception {

		try ( Conexao conexao = PoolDeConexoes.getConexao() ) {
			conexao.beginTransaction();
			try {
				bloquearEtapa( conexao, idEtapa );
				JSONObject dados = etapa( conexao, idEtapa );
				if( !elegivel( conexao, usuario, dados ) ) throw new ArgousFormsApiException( 409, "ETAPA_INDISPONIVEL", "A etapa já foi assumida ou você não é elegível." );

				QtData agora = new QtData( Instant.now().toEpochMilli() );
				ProcessoEtapa etapa = ProcessoEtapaLocalizador.buscaProcessoEtapa( conexao, idEtapa );
				etapa.setIdUsuarioResponsavel( usuario.idUsuario() );
				etapa.setDtAssumiu( agora );
				etapa.setTpSituacao( "I" );
				new ProcessoEtapaNegocio( conexao, etapa ).altera();

				ProcessoEtapaResponsavel historico = new ProcessoEtapaResponsavel();
				historico.setIdEtapaResponsavel( UUID.randomUUID() );
				historico.setIdProcessoEtapa( idEtapa );
				historico.setIdUsuarioSistema( usuario.idUsuario() );
				historico.setDtInicio( agora );
				new ProcessoEtapaResponsavelNegocio( conexao, historico ).insere();
				ForumProcessoService.registrar( conexao, UUID.fromString( dados.getString( "idProcesso" ) ), usuario.idUsuario(), "A",
					"Etapa assumida: " + dados.getString( "titulo" ) + ".", new JSONObject().put( "idEtapa", idEtapa.toString() ) );
				conexao.commit();
				return new JSONObject().put( "idEtapa", idEtapa.toString() );
			} catch ( Exception e ) {
				if( conexao.inTransaction() ) conexao.rollback();
				throw e;
			}
		}
	}
	
	public JSONObject salvarParcial( AutenticacaoLocalService.Usuario usuario, UUID idEtapa, JSONObject valores ) throws Exception {

		return gravar( usuario, idEtapa, valores, false );
	}

	public JSONObject salvarCompleto( AutenticacaoLocalService.Usuario usuario, UUID idEtapa, JSONObject valores ) throws Exception {

		return gravar( usuario, idEtapa, valores, true );
	}

	public JSONObject finalizar( AutenticacaoLocalService.Usuario usuario, ServletContext contexto, UUID idEtapa ) throws Exception {

		try ( Conexao conexao = PoolDeConexoes.getConexao() ) {
			conexao.beginTransaction();
			MongoArmazenamento mongo = null;
			List<UUID> enviados = new ArrayList<>();
			boolean commitTentado = false;
			try {
				bloquearEtapa( conexao, idEtapa );
				JSONObject dados = etapa( conexao, idEtapa );
				if( !"S".equals( dados.getString( "situacao" ) ) || !usuario.idUsuario().toString().equals( dados.optString( "responsavel" ) ) ) {
					throw new ArgousFormsApiException( 409, "ETAPA_NAO_SALVA", "Salve a etapa completa antes de finalizá-la." );
				}
				UUID idProcesso = UUID.fromString( dados.getString( "idProcesso" ) );
				UUID idDestino = destinoSimples( conexao, dados );
				JSONArray documentos = documentosConfigurados( conexao, UUID.fromString( dados.getString( "idProtocoloEtapa" ) ) );
				if( documentos.length() > 0 ) {
					mongo = new MongoArmazenamento( contexto );
					mongo.verificar();
					new DocumentoPdfProcessoService().gerar( conexao, mongo, usuario.idUsuario(), idProcesso, idEtapa,
						UUID.fromString( dados.getString( "idVersao" ) ), documentos, enviados );
				}
				QtData agora = new QtData( Instant.now().toEpochMilli() );

				ProcessoEtapa etapa = ProcessoEtapaLocalizador.buscaProcessoEtapa( conexao, idEtapa );
				etapa.setTpSituacao( "F" );
				etapa.setDtFinalizacao( agora );
				etapa.setIdUsuarioResponsavel( null );
				new ProcessoEtapaNegocio( conexao, etapa ).altera();
				encerrarResponsabilidade( conexao, idEtapa, agora );

				Processo processo = ProcessoLocalizador.buscaProcesso( conexao, idProcesso );
				if( idDestino == null ) {
					if( possuiOutraEtapaAberta( conexao, idProcesso, idEtapa ) ) throw fluxoAindaNaoExecutavel();
					processo.setTpSituacao( "A" );
				} else {
					ProcessoEtapa proxima = new ProcessoEtapa();
					proxima.setIdProcessoEtapa( UUID.randomUUID() );
					proxima.setIdProcesso( idProcesso );
					proxima.setIdProtocoloEtapa( idDestino );
					proxima.setNrPassagem( 1 );
					proxima.setTpSituacao( "D" );
					proxima.setDtDisponibilizacao( agora );
					new ProcessoEtapaNegocio( conexao, proxima ).insere();

					ProcessoEtapaEncaminhamento passagem = new ProcessoEtapaEncaminhamento();
					passagem.setIdProcessoEtapaEncaminhamento( UUID.randomUUID() );
					passagem.setIdProcesso( idProcesso );
					passagem.setIdProcessoEtapaOrigem( idEtapa );
					passagem.setIdEncaminhamento( UUID.fromString( dados.getString( "idEncaminhamento" ) ) );
					passagem.setIdProtocoloEtapaDestino( idDestino );
					passagem.setIdProcessoEtapa( proxima.getIdProcessoEtapa() );
					passagem.setNrPassagemDestino( 1 );
					passagem.setTpMovimento( "E" );
					passagem.setDtInclusao( agora );
					new ProcessoEtapaEncaminhamentoNegocio( conexao, passagem ).insere();
					processo.setTpSituacao( "E" );
				}
				new ProcessoNegocio( conexao, processo ).altera();
				ForumProcessoService.registrar( conexao, idProcesso, usuario.idUsuario(), "T", "Etapa finalizada: " + dados.getString( "titulo" ) + ".",
					new JSONObject().put( "idEtapa", idEtapa.toString() ).put( "idEtapaDestino", idDestino == null ? JSONObject.NULL : idDestino.toString() ) );
				commitTentado = true;
				conexao.commit();
				return new JSONObject().put( "idProcesso", idProcesso.toString() ).put( "situacao", idDestino == null ? "A" : "E" );
			} catch ( Exception e ) {
				if( conexao.inTransaction() ) {
					try { conexao.rollback(); }
					catch ( Exception falhaRollback ) { e.addSuppressed( falhaRollback ); }
				}
				if( mongo != null ) {
					for( UUID idVersao : enviados ) {
						Boolean persistido = commitTentado ? metadadoPersistido( idVersao ) : false;
						if( Boolean.FALSE.equals( persistido ) ) {
							try { mongo.excluir( idVersao ); }
							catch ( Exception limpeza ) { LOG.log( Level.SEVERE, "Falha ao compensar PDF idArquivoVersao=" + idVersao, limpeza ); }
						} else if( persistido == null ) LOG.severe( "Resultado da transação desconhecido; reconciliar idArquivoVersao=" + idVersao );
					}
				}
				throw e;
			} finally {
				if( mongo != null ) mongo.close();
			}
		}
	}

	private JSONArray documentosConfigurados( Conexao conexao, UUID idProtocoloEtapa ) throws Exception {

		try ( PreparedStatement consulta = conexao.getConnection().prepareStatement(
			"select JS_GERACAO_DOCUMENTOS from Processos.PROTOCOLOS_ETAPAS where ID_PROTOCOLO_ETAPA = ?" ) ) {
			consulta.setObject( 1, idProtocoloEtapa );
			try ( ResultSet linha = consulta.executeQuery() ) {
				if( !linha.next() ) throw new ArgousFormsApiException( 404, "ETAPA_NAO_ENCONTRADA", "Etapa não encontrada." );
				String configuracao = linha.getString( 1 );
				if( configuracao == null || configuracao.isBlank() ) return new JSONArray();
				JSONArray documentos = new JSONObject( configuracao ).optJSONArray( "aoFinalizar" );
				if( documentos == null ) throw new ArgousFormsApiException( 409, "GERACAO_INVALIDA", "A configuração dos documentos desta etapa é inválida." );
				return documentos;
			}
		}
	}

	private Boolean metadadoPersistido( UUID idVersao ) {

		try ( Conexao verificacao = PoolDeConexoes.getConexao() ) {
			try ( PreparedStatement consulta = verificacao.getConnection().prepareStatement(
				"select 1 from Docs.ARQUIVO_VERSOES where ID_ARQUIVO_VERSAO = ?" ) ) {
				consulta.setObject( 1, idVersao );
				try ( ResultSet linha = consulta.executeQuery() ) { return linha.next(); }
			}
		} catch ( Exception e ) {
			LOG.log( Level.SEVERE, "Falha ao conferir PDF idArquivoVersao=" + idVersao, e );
			return null;
		}
	}

	private UUID destinoSimples( Conexao conexao, JSONObject dados ) throws Exception {

		String sql = "select pe.TX_SCRIPT_INICIALIZACAO, pe.TX_SCRIPT_FINALIZACAO, pe.JS_GERACAO_DOCUMENTOS, pe.ID_ENCAMINHAMENTO, "
			+ "v.TX_SCRIPT_INICIALIZACAO as SCRIPT_PROCESSO from Processos.PROTOCOLOS_ETAPAS pe "
			+ "join Processos.PROTOCOLO_VERSOES v on v.ID_PROTOCOLO_VERSAO = pe.ID_PROTOCOLO_VERSAO where pe.ID_PROTOCOLO_ETAPA = ?";
		try ( PreparedStatement consulta = conexao.getConnection().prepareStatement( sql ) ) {
			consulta.setObject( 1, UUID.fromString( dados.getString( "idProtocoloEtapa" ) ) );
			try ( ResultSet linha = consulta.executeQuery() ) {
				linha.next();
				if( possuiTexto( linha.getString( "TX_SCRIPT_INICIALIZACAO" ) ) || possuiTexto( linha.getString( "TX_SCRIPT_FINALIZACAO" ) ) || possuiTexto( linha.getString( "SCRIPT_PROCESSO" ) ) ) {
					throw fluxoAindaNaoExecutavel();
				}
				UUID idEncaminhamento = linha.getObject( "ID_ENCAMINHAMENTO", UUID.class );
				if( idEncaminhamento == null ) return null;
				dados.put( "idEncaminhamento", idEncaminhamento.toString() );
			}
		}
		try ( PreparedStatement consulta = conexao.getConnection().prepareStatement( "select a.TP_ENCAMINHAMENTO, a.ID_PROXIMA_ETAPA, a.ID_PROXIMO_ENCAMINHAMENTO, e.TX_SCRIPT_INICIALIZACAO from Processos.ENCAMINHAMENTOS a join Processos.PROTOCOLOS_ETAPAS e on e.ID_PROTOCOLO_ETAPA = a.ID_PROXIMA_ETAPA where a.ID_ENCAMINHAMENTO = ?" ) ) {
			consulta.setObject( 1, UUID.fromString( dados.getString( "idEncaminhamento" ) ) );
			try ( ResultSet linha = consulta.executeQuery() ) {
				if( !linha.next() || !"E".equals( linha.getString( "TP_ENCAMINHAMENTO" ) ) || linha.getObject( "ID_PROXIMO_ENCAMINHAMENTO" ) != null || possuiTexto( linha.getString( "TX_SCRIPT_INICIALIZACAO" ) ) ) throw fluxoAindaNaoExecutavel();
				UUID idDestino = linha.getObject( "ID_PROXIMA_ETAPA", UUID.class );
				try ( PreparedStatement contagem = conexao.getConnection().prepareStatement( "select count(*) from Processos.ENCAMINHAMENTOS where ID_PROTOCOLO_VERSAO = ? and ID_PROXIMA_ETAPA = ?" ) ) {
					contagem.setObject( 1, UUID.fromString( dados.getString( "idVersao" ) ) );
					contagem.setObject( 2, idDestino );
					try ( ResultSet total = contagem.executeQuery() ) {
						total.next();
						if( total.getInt( 1 ) != 1 ) throw fluxoAindaNaoExecutavel();
					}
				}
				return idDestino;
			}
		}
	}

	private void encerrarResponsabilidade( Conexao conexao, UUID idEtapa, QtData agora ) throws Exception {

		try ( PreparedStatement consulta = conexao.getConnection().prepareStatement( "select ID_ETAPA_RESPONSAVEL from Processos.PROCESSO_ETAPA_RESPONSAVEIS where ID_PROCESSO_ETAPA = ? and DT_FIM is null" ) ) {
			consulta.setObject( 1, idEtapa );
			try ( ResultSet linha = consulta.executeQuery() ) {
				if( !linha.next() ) throw new ArgousFormsApiException( 409, "RESPONSABILIDADE_AUSENTE", "A etapa não possui responsabilidade vigente." );
				ProcessoEtapaResponsavel historico = ProcessoEtapaResponsavelLocalizador.buscaProcessoEtapaResponsavel( conexao, linha.getObject( 1, UUID.class ) );
				historico.setDtFim( agora );
				historico.setTpFim( "9" );
				new ProcessoEtapaResponsavelNegocio( conexao, historico ).altera();
			}
		}
	}

	private boolean possuiOutraEtapaAberta( Conexao conexao, UUID idProcesso, UUID idEtapa ) throws Exception {

		try ( PreparedStatement consulta = conexao.getConnection().prepareStatement( "select 1 from Processos.PROCESSO_ETAPAS where ID_PROCESSO = ? and ID_PROCESSO_ETAPA <> ? and TP_SITUACAO <> 'F'" ) ) {
			consulta.setObject( 1, idProcesso );
			consulta.setObject( 2, idEtapa );
			try ( ResultSet linha = consulta.executeQuery() ) { return linha.next(); }
		}
	}

	private boolean possuiTexto( String valor ) {

		return valor != null && !valor.isBlank();
	}

	private ArgousFormsApiException fluxoAindaNaoExecutavel() {

		return new ArgousFormsApiException( 409, "FLUXO_AINDA_NAO_EXECUTAVEL", "Esta etapa depende de scripts ou encaminhamentos ainda não disponíveis na execução." );
	}

	private JSONObject gravar( AutenticacaoLocalService.Usuario usuario, UUID idEtapa, JSONObject valores, boolean completo ) throws Exception {

		if( valores == null ) throw new ArgousFormsApiException( 400, "VALORES_INVALIDOS", "Informe os valores do formulário." );
		try ( Conexao conexao = PoolDeConexoes.getConexao() ) {
			conexao.beginTransaction();
			try {
				bloquearEtapa( conexao, idEtapa );
				JSONObject dados = etapa( conexao, idEtapa );
				if( !usuario.idUsuario().toString().equals( dados.optString( "responsavel" ) ) || !( "I".equals( dados.getString( "situacao" ) ) || "P".equals( dados.getString( "situacao" ) ) || "S".equals( dados.getString( "situacao" ) ) ) ) {
					throw new ArgousFormsApiException( 403, "ETAPA_SEM_ACESSO", "Assuma a etapa antes de salvar seu formulário." );
				}
				Map<String, JSONObject> campos = new HashMap<>();
				JSONArray formulario = dados.getJSONArray( "campos" );
				for( int i = 0; i < formulario.length(); i++ ) campos.put( formulario.getJSONObject( i ).getString( "id" ), formulario.getJSONObject( i ) );

				Iterator<?> chaves = valores.keys();
				while( chaves.hasNext() ) {
					String chave = (String) chaves.next();
					JSONObject campo = campos.get( chave );
					if( campo == null || !"E".equals( campo.getString( "acesso" ) ) ) throw new ArgousFormsApiException( 400, "CAMPO_INVALIDO", "O formulário não permite alterar um dos campos enviados." );
					UUID idVariavel = UUID.fromString( chave );
					ProcessoVariavelValor valor = ProcessoVariavelValorLocalizador.buscaProcessoVariavelValor( conexao, idEtapa, idVariavel );
					boolean novo = valor == null;
					if( novo ) {
						valor = new ProcessoVariavelValor();
						valor.setIdProcessoEtapa( idEtapa );
						valor.setIdVariavel( idVariavel );
					}
					Object informado = valores.opt( chave );
					if( completo && "S".equals( campo.getString( "tipo" ) ) && informado instanceof String texto && !texto.isEmpty() ) {
						informado = DefinicaoVariavelTexto.normalizarValor( texto, campo.getJSONObject( "definicao" ) );
					}
					preencher( valor, campo.getString( "tipo" ), informado );
					valor.setDtUltimaGravacao( new QtData( Instant.now().toEpochMilli() ) );
					valor.setIdUsuarioUltimaGravacao( usuario.idUsuario() );
					if( novo ) new ProcessoVariavelValorNegocio( conexao, valor ).insere();
					else new ProcessoVariavelValorNegocio( conexao, valor ).altera();

					ProcessoVariavelAtual atual = new ProcessoVariavelAtual();
					atual.setIdProcesso( UUID.fromString( dados.getString( "idProcesso" ) ) );
					atual.setIdVariavel( idVariavel );
					atual.setIdProcessoEtapa( idEtapa );
					try ( PreparedStatement consulta = conexao.getConnection().prepareStatement( "select 1 from Processos.PROCESSO_VARIAVEIS_ATUAIS where ID_PROCESSO = ? and ID_VARIAVEL = ?" ) ) {
						consulta.setObject( 1, atual.getIdProcesso() );
						consulta.setObject( 2, idVariavel );
						try ( ResultSet linha = consulta.executeQuery() ) {
							if( linha.next() ) new ProcessoVariavelAtualNegocio( conexao, atual ).altera();
							else new ProcessoVariavelAtualNegocio( conexao, atual ).insere();
						}
					}
				}
				if( completo ) validarObrigatorios( formulario, valores );
				ProcessoEtapa etapa = ProcessoEtapaLocalizador.buscaProcessoEtapa( conexao, idEtapa );
				etapa.setTpSituacao( completo ? "S" : "P" );
				new ProcessoEtapaNegocio( conexao, etapa ).altera();
				conexao.commit();
				return new JSONObject().put( "idEtapa", idEtapa.toString() ).put( "situacao", completo ? "S" : "P" );
			} catch ( Exception e ) {
				if( conexao.inTransaction() ) conexao.rollback();
				throw e;
			}
		}
	}

	private void validarObrigatorios( JSONArray formulario, JSONObject valores ) throws Exception {

		for( int i = 0; i < formulario.length(); i++ ) {
			JSONObject campo = formulario.getJSONObject( i );
			if( !campo.getBoolean( "obrigatorio" ) || !"E".equals( campo.getString( "acesso" ) ) ) continue;
			Object informado = valores.opt( campo.getString( "id" ) );
			if( informado == null || JSONObject.NULL.equals( informado ) || informado instanceof String texto && texto.isBlank()
				|| "V".equals( campo.getString( "tipo" ) ) && ( !(informado instanceof JSONObject monetario)
					|| monetario.optString( "moeda", "" ).isBlank() || monetario.optString( "valor", "" ).isBlank() ) ) {
				throw new ArgousFormsApiException( 400, "CAMPO_OBRIGATORIO", "Preencha o campo obrigatório: " + campo.getString( "nome" ) + "." );
			}
		}
	}

	private JSONObject etapa( Conexao conexao, UUID idEtapa ) throws Exception {

		String sql = "select e.ID_PROCESSO, e.ID_PROTOCOLO_ETAPA, e.ID_USUARIO_RESPONSAVEL, e.TP_SITUACAO, pe.DS_TITULO, pe.ID_FORMULARIO, p.ID_PROTOCOLO_VERSAO "
			+ "from Processos.PROCESSO_ETAPAS e join Processos.PROTOCOLOS_ETAPAS pe on pe.ID_PROTOCOLO_ETAPA = e.ID_PROTOCOLO_ETAPA "
			+ "join Processos.PROCESSOS p on p.ID_PROCESSO = e.ID_PROCESSO where e.ID_PROCESSO_ETAPA = ?";
		try ( PreparedStatement consulta = conexao.getConnection().prepareStatement( sql ) ) {
			consulta.setObject( 1, idEtapa );
			try ( ResultSet linha = consulta.executeQuery() ) {
				if( !linha.next() ) throw new ArgousFormsApiException( 404, "ETAPA_NAO_ENCONTRADA", "Etapa não encontrada." );
				JSONObject dados = new JSONObject().put( "id", idEtapa.toString() ).put( "idProcesso", linha.getString( "ID_PROCESSO" ) )
					.put( "idProtocoloEtapa", linha.getString( "ID_PROTOCOLO_ETAPA" ) ).put( "titulo", linha.getString( "DS_TITULO" ) )
					.put( "responsavel", linha.getString( "ID_USUARIO_RESPONSAVEL" ) == null ? "" : linha.getString( "ID_USUARIO_RESPONSAVEL" ) )
					.put( "situacao", linha.getString( "TP_SITUACAO" ) ).put( "idVersao", linha.getString( "ID_PROTOCOLO_VERSAO" ) );
				UUID idFormulario = linha.getObject( "ID_FORMULARIO", UUID.class );
				UUID idVersao = linha.getObject( "ID_PROTOCOLO_VERSAO", UUID.class );
				dados.put( "campos", campos( conexao, idEtapa, UUID.fromString( dados.getString( "idProcesso" ) ), idFormulario, idVersao ) );
				return dados;
			}
		}
	}

	private JSONArray campos( Conexao conexao, UUID idEtapa, UUID idProcesso, UUID idFormulario, UUID idVersao ) throws Exception {

		JSONArray campos = new JSONArray();
		String sql = "select fv.ID_VARIAVEL, fv.TP_ACESSO, fv.SN_OBRIGATORIA, x.CD_VARIAVEL, x.TP_DADO, vv.DS_NOME, vv.JS_DEFINICAO, "
			+ "v.VL_TEXTO, v.VL_INTEIRO, v.VL_DECIMAL, v.CD_MOEDA, v.CD_VALOR_MONETARIO, v.VL_BOOLEANO, v.VL_OPCAO, v.VL_DATA, v.VL_HORA, v.VL_DATA_HORA "
			+ "from Processos.FORMULARIO_VARIAVEIS fv join Processos.PROTOCOLO_VARIAVEIS x on x.ID_VARIAVEL = fv.ID_VARIAVEL "
			+ "join Processos.PROTOCOLO_VERSAO_VARIAVEIS pv on pv.ID_PROTOCOLO_VERSAO = ? and pv.ID_VARIAVEL = x.ID_VARIAVEL "
			+ "join Processos.PROTOCOLO_VARIAVEL_VERSOES vv on vv.ID_VARIAVEL = x.ID_VARIAVEL and vv.NR_VERSAO = pv.NR_VERSAO "
			+ "left join Processos.PROCESSO_VARIAVEL_VALORES localv on localv.ID_PROCESSO_ETAPA = ? and localv.ID_VARIAVEL = x.ID_VARIAVEL "
			+ "left join Processos.PROCESSO_VARIAVEIS_ATUAIS atual on atual.ID_PROCESSO = ? and atual.ID_VARIAVEL = x.ID_VARIAVEL "
			+ "left join Processos.PROCESSO_VARIAVEL_VALORES v on v.ID_PROCESSO_ETAPA = coalesce(localv.ID_PROCESSO_ETAPA, atual.ID_PROCESSO_ETAPA) and v.ID_VARIAVEL = x.ID_VARIAVEL "
			+ "where fv.ID_FORMULARIO = ? order by fv.NR_ORDEM";
		try ( PreparedStatement consulta = conexao.getConnection().prepareStatement( sql ) ) {
			consulta.setObject( 1, idVersao );
			consulta.setObject( 2, idEtapa );
			consulta.setObject( 3, idProcesso );
			consulta.setObject( 4, idFormulario );
			try ( ResultSet linha = consulta.executeQuery() ) {
				while( linha.next() ) {
					String tipo = linha.getString( "TP_DADO" );
					Object valor = switch( tipo ) {
						case "S" -> linha.getString( "VL_TEXTO" );
						case "I" -> linha.getObject( "VL_INTEIRO" );
						case "R" -> linha.getObject( "VL_DECIMAL" );
						case "M" -> linha.getString( "CD_MOEDA" );
						case "V" -> linha.getObject( "CD_VALOR_MONETARIO" );
						case "B" -> linha.getObject( "VL_BOOLEANO" );
						case "O" -> linha.getString( "VL_OPCAO" );
						case "D" -> linha.getString( "VL_DATA" );
						case "H" -> linha.getString( "VL_HORA" );
						case "T" -> linha.getTimestamp( "VL_DATA_HORA" ) == null ? null : linha.getTimestamp( "VL_DATA_HORA" ).toInstant().toString();
						default -> null;
					};
					campos.put( new JSONObject().put( "id", linha.getString( "ID_VARIAVEL" ) ).put( "codigo", linha.getString( "CD_VARIAVEL" ) )
						.put( "nome", linha.getString( "DS_NOME" ) ).put( "tipo", tipo ).put( "acesso", linha.getString( "TP_ACESSO" ) )
						.put( "obrigatorio", linha.getBoolean( "SN_OBRIGATORIA" ) )
						.put( "definicao", new JSONObject( linha.getString( "JS_DEFINICAO" ) ) ).put( "valor", valor == null ? JSONObject.NULL : valor )
						.put( "moeda", linha.getString( "CD_MOEDA" ) == null ? "" : linha.getString( "CD_MOEDA" ) ) );
				}
			}
		}
		return campos;
	}

	private void preencher( ProcessoVariavelValor valor, String tipo, Object informado ) throws Exception {

		if( "V".equals( tipo ) && informado instanceof JSONObject monetario
			&& monetario.optString( "moeda", "" ).isBlank() && monetario.optString( "valor", "" ).isBlank() ) informado = null;
		if( informado == null || JSONObject.NULL.equals( informado ) || "".equals( informado ) ) {
			valor.setVlTexto( null );
			valor.setVlInteiro( null );
			valor.setVlDecimal( null );
			valor.setCdMoeda( null );
			valor.setCdValorMonetario( null );
			valor.setVlBooleano( null );
			valor.setVlOpcao( null );
			valor.setVlData( null );
			valor.setVlHora( null );
			valor.setVlDataHora( null );
			return;
		}
		try {
			switch( tipo ) {
				case "S" -> valor.setVlTexto( informado.toString() );
				case "I" -> valor.setVlInteiro( Long.valueOf( informado.toString() ) );
				case "R" -> valor.setVlDecimal( new BigDecimal( informado.toString() ) );
				case "M" -> valor.setCdMoeda( moeda( informado.toString() ) );
				case "V" -> {
					JSONObject monetario = (JSONObject) informado;
					valor.setCdMoeda( moeda( monetario.getString( "moeda" ) ) );
					valor.setCdValorMonetario( new BigDecimal( monetario.get( "valor" ).toString() ) );
				}
				case "B" -> valor.setVlBooleano( (Boolean) informado );
				case "O" -> valor.setVlOpcao( informado.toString() );
				case "D" -> valor.setVlData( new QtData( LocalDate.parse( informado.toString() ).atStartOfDay( ZoneOffset.UTC ).toInstant().toEpochMilli() ) );
				case "H" -> valor.setVlHora( OffsetTime.parse( informado.toString() ) );
				case "T" -> valor.setVlDataHora( new QtData( OffsetDateTime.parse( informado.toString() ).toInstant().toEpochMilli() ) );
				default -> throw new IllegalArgumentException();
			}
		} catch ( RuntimeException e ) {
			throw new ArgousFormsApiException( 400, "VALOR_INVALIDO", "Um dos valores não corresponde ao tipo da variável." );
		}
	}

	private String moeda( String codigo ) {

		if( !codigo.matches( "[A-Z]{3}" ) ) throw new IllegalArgumentException();
		return codigo;
	}

	private void bloquearEtapa( Conexao conexao, UUID idEtapa ) throws Exception {

		try ( PreparedStatement consulta = conexao.getConnection().prepareStatement( "select ID_PROCESSO_ETAPA from Processos.PROCESSO_ETAPAS where ID_PROCESSO_ETAPA = ? for update" ) ) {
			consulta.setObject( 1, idEtapa );
			try ( ResultSet linha = consulta.executeQuery() ) {
				if( !linha.next() ) throw new ArgousFormsApiException( 404, "ETAPA_NAO_ENCONTRADA", "Etapa não encontrada." );
			}
		}
	}

	private boolean elegivel( Conexao conexao, AutenticacaoLocalService.Usuario usuario, JSONObject etapa ) throws Exception {

		if( !"D".equals( etapa.getString( "situacao" ) ) || !etapa.getString( "responsavel" ).isEmpty() ) return false;
		return processos.elegivelEtapa( conexao, UUID.fromString( etapa.getString( "idProtocoloEtapa" ) ), usuario.idUsuario() );
	}
}
