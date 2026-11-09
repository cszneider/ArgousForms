package br.com.argousForms.processos;

import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

import org.json.JSONArray;
import org.json.JSONObject;

import br.com.argousForms.api.ArgousFormsApiException;
import br.com.argousForms.auth.AutenticacaoLocalService;
import br.com.argousForms.model.negocio.processos.ProcessoEtapaEncaminhamentoNegocio;
import br.com.argousForms.model.negocio.processos.ProcessoEtapaNegocio;
import br.com.argousForms.model.negocio.processos.ProcessoNegocio;
import br.com.argousForms.model.persistencia.processos.Processo;
import br.com.argousForms.model.persistencia.processos.ProcessoEtapa;
import br.com.argousForms.model.persistencia.processos.ProcessoEtapaEncaminhamento;
import br.com.argousForms.model.persistencia.processos.ProcessoLocalizador;
import quatro.sql.Conexao;
import quatro.sql.PoolDeConexoes;
import quatro.util.QtData;

public final class ProcessosService {

	public JSONObject concluir( AutenticacaoLocalService.Usuario usuario, UUID idProcesso ) throws Exception {

		try ( Conexao conexao = PoolDeConexoes.getConexao() ) {
			conexao.beginTransaction();
			try {
				try ( PreparedStatement consulta = conexao.getConnection().prepareStatement(
					"select ID_USUARIO_GESTOR, TP_SITUACAO from Processos.PROCESSOS where ID_PROCESSO = ? for update" ) ) {
					consulta.setObject( 1, idProcesso );
					try ( ResultSet linha = consulta.executeQuery() ) {
						if( !linha.next() ) throw new ArgousFormsApiException( 404, "PROCESSO_NAO_ENCONTRADO", "Processo não encontrado." );
						if( !usuario.idUsuario().equals( linha.getObject( "ID_USUARIO_GESTOR", UUID.class ) ) ) {
							throw new ArgousFormsApiException( 403, "ACESSO_NEGADO", "Somente o gestor atual pode concluir o Processo." );
						}
						if( !"A".equals( linha.getString( "TP_SITUACAO" ) ) ) {
							throw new ArgousFormsApiException( 409, "PROCESSO_NAO_AGUARDA_CONCLUSAO", "O Processo não está aguardando conclusão." );
						}
					}
				}
				try ( PreparedStatement consulta = conexao.getConnection().prepareStatement(
					"select 1 from Processos.PROCESSO_ETAPAS where ID_PROCESSO = ? and TP_SITUACAO <> 'F'" ) ) {
					consulta.setObject( 1, idProcesso );
					try ( ResultSet linha = consulta.executeQuery() ) {
						if( linha.next() ) throw new ArgousFormsApiException( 409, "ETAPAS_PENDENTES", "Há etapas pendentes neste Processo." );
					}
				}
				Processo processo = ProcessoLocalizador.buscaProcesso( conexao, idProcesso );
				processo.setTpSituacao( "F" );
				processo.setDtEncerramento( new QtData( Instant.now().toEpochMilli() ) );
				new ProcessoNegocio( conexao, processo ).altera();
				ForumProcessoService.registrar( conexao, idProcesso, usuario.idUsuario(), "A", "Processo concluído pelo gestor.", null );
				conexao.commit();
				return new JSONObject().put( "idProcesso", idProcesso.toString() ).put( "situacao", "F" );
			} catch ( Exception e ) {
				if( conexao.inTransaction() ) conexao.rollback();
				throw e;
			}
		}
	}

	public JSONObject iniciar( AutenticacaoLocalService.Usuario usuario, UUID idVersao, UUID idGestorInformado ) throws Exception {

		exigirEditor( usuario );
		try ( Conexao conexao = PoolDeConexoes.getConexao() ) {
			conexao.beginTransaction();
			try {
				UUID idEtapa = exigirInicioElegivel( conexao, idVersao, usuario.idUsuario() );
				UUID idGestor = elegivel( conexao, "Processos.PROTOCOLO_GESTORES_ELEGIVEIS", "ID_PROTOCOLO_VERSAO", idVersao, usuario.idUsuario() )
					? usuario.idUsuario() : idGestorInformado;
				if( idGestor == null || !usuarioAtivo( conexao, idGestor ) || !elegivel( conexao, "Processos.PROTOCOLO_GESTORES_ELEGIVEIS", "ID_PROTOCOLO_VERSAO", idVersao, idGestor ) ) {
					throw new ArgousFormsApiException( 409, "GESTOR_INDISPONIVEL", "Escolha um gestor elegível e ativo para este Processo." );
				}

				QtData agora = new QtData( Instant.now().toEpochMilli() );
				Processo processo = new Processo();
				processo.setIdProcesso( UUID.randomUUID() );
				processo.setIdProtocoloVersao( idVersao );
				processo.setIdUsuarioIniciou( usuario.idUsuario() );
				processo.setIdUsuarioGestor( idGestor );
				processo.setTpSituacao( "I" );
				processo.setDtInicio( agora );
				new ProcessoNegocio( conexao, processo ).insere();

				ProcessoEtapa etapa = new ProcessoEtapa();
				etapa.setIdProcessoEtapa( UUID.randomUUID() );
				etapa.setIdProcesso( processo.getIdProcesso() );
				etapa.setIdProtocoloEtapa( idEtapa );
				etapa.setNrPassagem( 1 );
				etapa.setTpSituacao( "D" );
				etapa.setDtDisponibilizacao( agora );
				new ProcessoEtapaNegocio( conexao, etapa ).insere();

				ProcessoEtapaEncaminhamento entrada = new ProcessoEtapaEncaminhamento();
				entrada.setIdProcessoEtapaEncaminhamento( UUID.randomUUID() );
				entrada.setIdProcesso( processo.getIdProcesso() );
				entrada.setIdProtocoloEtapaDestino( idEtapa );
				entrada.setIdProcessoEtapa( etapa.getIdProcessoEtapa() );
				entrada.setNrPassagemDestino( 1 );
				entrada.setTpMovimento( "E" );
				entrada.setDtInclusao( agora );
				new ProcessoEtapaEncaminhamentoNegocio( conexao, entrada ).insere();
				ForumProcessoService.registrar( conexao, processo.getIdProcesso(), usuario.idUsuario(), "A", "Processo iniciado.",
					new JSONObject().put( "idEtapa", etapa.getIdProcessoEtapa().toString() ) );

				conexao.commit();
				return new JSONObject().put( "idProcesso", processo.getIdProcesso().toString() ).put( "idEtapa", etapa.getIdProcessoEtapa().toString() );
			} catch ( Exception e ) {
				if( conexao.inTransaction() ) conexao.rollback();
				throw e;
			}
		}
	}

	private boolean usuarioAtivo( Conexao conexao, UUID idUsuario ) throws Exception {

		try ( PreparedStatement consulta = conexao.getConnection().prepareStatement( "select 1 from Cadastro.USUARIOS_SISTEMA where ID_USUARIO_SISTEMA = ? and DT_EXCLUSAO is null" ) ) {
			consulta.setObject( 1, idUsuario );
			try ( ResultSet linhas = consulta.executeQuery() ) { return linhas.next(); }
		}
	}

	public JSONObject disponiveisParaIniciar( AutenticacaoLocalService.Usuario usuario ) throws Exception {

		exigirEditor( usuario );
		JSONArray protocolos = new JSONArray();
		String sql = "select p.ID_PROTOCOLO, v.ID_PROTOCOLO_VERSAO, v.NR_VERSAO, v.DS_TITULO, v.DS_DESCRICAO, e.ID_PROTOCOLO_ETAPA, e.DS_TITULO as ETAPA_TITULO, f.ID_FORMULARIO, f.DS_TITULO as FORMULARIO_TITULO "
			+ "from Processos.PROTOCOLOS p join Processos.PROTOCOLO_VERSOES v on v.ID_PROTOCOLO = p.ID_PROTOCOLO "
			+ "join Processos.PROTOCOLOS_ETAPAS e on e.ID_PROTOCOLO_VERSAO = v.ID_PROTOCOLO_VERSAO "
			+ "join Processos.FORMULARIOS f on f.ID_FORMULARIO = e.ID_FORMULARIO "
			+ "where p.SN_ATIVO and v.TP_SITUACAO = 'P' and v.NR_VERSAO = (select max(v2.NR_VERSAO) from Processos.PROTOCOLO_VERSOES v2 where v2.ID_PROTOCOLO = p.ID_PROTOCOLO and v2.TP_SITUACAO = 'P') "
			+ "and not exists (select 1 from Processos.ENCAMINHAMENTOS a where a.ID_PROTOCOLO_VERSAO = v.ID_PROTOCOLO_VERSAO and a.ID_PROXIMA_ETAPA = e.ID_PROTOCOLO_ETAPA) "
			+ "order by v.DS_TITULO";
		try ( Conexao conexao = PoolDeConexoes.getConexao(); PreparedStatement consulta = conexao.getConnection().prepareStatement( sql ); ResultSet linhas = consulta.executeQuery() ) {
			while( linhas.next() ) {
				UUID idEtapa = linhas.getObject( "ID_PROTOCOLO_ETAPA", UUID.class );
				if( !elegivel( conexao, idEtapa, usuario.idUsuario() ) ) continue;
				protocolos.put( new JSONObject().put( "idProtocolo", linhas.getString( "ID_PROTOCOLO" ) )
					.put( "idVersao", linhas.getString( "ID_PROTOCOLO_VERSAO" ) ).put( "numeroVersao", linhas.getInt( "NR_VERSAO" ) )
					.put( "titulo", linhas.getString( "DS_TITULO" ) ).put( "descricao", linhas.getString( "DS_DESCRICAO" ) == null ? "" : linhas.getString( "DS_DESCRICAO" ) )
					.put( "idEtapa", idEtapa.toString() ).put( "etapaTitulo", linhas.getString( "ETAPA_TITULO" ) )
					.put( "formularioTitulo", linhas.getString( "FORMULARIO_TITULO" ) )
					.put( "campos", camposFormulario( conexao, linhas.getObject( "ID_FORMULARIO", UUID.class ), linhas.getObject( "ID_PROTOCOLO_VERSAO", UUID.class ) ) ) );
			}
		}
		return new JSONObject().put( "protocolos", protocolos );
	}

	public JSONObject gestoresElegiveis( AutenticacaoLocalService.Usuario usuario, UUID idVersao ) throws Exception {

		exigirEditor( usuario );
		JSONArray gestores = new JSONArray();
		try ( Conexao conexao = PoolDeConexoes.getConexao() ) {
			exigirInicioElegivel( conexao, idVersao, usuario.idUsuario() );
			try ( PreparedStatement consulta = conexao.getConnection().prepareStatement( "select ID_USUARIO_SISTEMA, DS_NOME from Cadastro.USUARIOS_SISTEMA where DT_EXCLUSAO is null order by DS_NOME" ); ResultSet linhas = consulta.executeQuery() ) {
				while( linhas.next() ) {
					UUID idUsuario = linhas.getObject( 1, UUID.class );
					if( elegivel( conexao, "Processos.PROTOCOLO_GESTORES_ELEGIVEIS", "ID_PROTOCOLO_VERSAO", idVersao, idUsuario ) ) {
						gestores.put( new JSONObject().put( "id", idUsuario.toString() ).put( "nome", linhas.getString( 2 ) ) );
					}
				}
			}
		}
		return new JSONObject().put( "gestores", gestores );
	}

	private UUID exigirInicioElegivel( Conexao conexao, UUID idVersao, UUID idUsuario ) throws Exception {

		String sql = "select e.ID_PROTOCOLO_ETAPA from Processos.PROTOCOLO_VERSOES v "
			+ "join Processos.PROTOCOLOS p on p.ID_PROTOCOLO = v.ID_PROTOCOLO "
			+ "join Processos.PROTOCOLOS_ETAPAS e on e.ID_PROTOCOLO_VERSAO = v.ID_PROTOCOLO_VERSAO "
			+ "where v.ID_PROTOCOLO_VERSAO = ? and v.TP_SITUACAO = 'P' and p.SN_ATIVO "
			+ "and v.NR_VERSAO = (select max(v2.NR_VERSAO) from Processos.PROTOCOLO_VERSOES v2 where v2.ID_PROTOCOLO = v.ID_PROTOCOLO and v2.TP_SITUACAO = 'P') "
			+ "and not exists (select 1 from Processos.ENCAMINHAMENTOS a where a.ID_PROTOCOLO_VERSAO = v.ID_PROTOCOLO_VERSAO and a.ID_PROXIMA_ETAPA = e.ID_PROTOCOLO_ETAPA)";
		try ( PreparedStatement consulta = conexao.getConnection().prepareStatement( sql ) ) {
			consulta.setObject( 1, idVersao );
			try ( ResultSet linha = consulta.executeQuery() ) {
				while( linha.next() ) {
					UUID idEtapa = linha.getObject( 1, UUID.class );
					if( elegivel( conexao, idEtapa, idUsuario ) ) return idEtapa;
				}
			}
		}
		throw new ArgousFormsApiException( 403, "INICIO_INDISPONIVEL", "Você não pode iniciar este Protocolo." );
	}

	private JSONArray camposFormulario( Conexao conexao, UUID idFormulario, UUID idVersao ) throws Exception {

		JSONArray campos = new JSONArray();
		String sql = "select fv.ID_VARIAVEL, vv.DS_NOME, x.CD_VARIAVEL, x.TP_DADO, fv.TP_ACESSO, fv.SN_OBRIGATORIA, fv.TP_APRESENTACAO "
			+ "from Processos.FORMULARIO_VARIAVEIS fv join Processos.PROTOCOLO_VARIAVEIS x on x.ID_VARIAVEL = fv.ID_VARIAVEL "
			+ "join Processos.PROTOCOLO_VERSAO_VARIAVEIS pv on pv.ID_PROTOCOLO_VERSAO = ? and pv.ID_VARIAVEL = x.ID_VARIAVEL "
			+ "join Processos.PROTOCOLO_VARIAVEL_VERSOES vv on vv.ID_VARIAVEL = x.ID_VARIAVEL and vv.NR_VERSAO = pv.NR_VERSAO "
			+ "where fv.ID_FORMULARIO = ? order by fv.NR_ORDEM";
		try ( PreparedStatement consulta = conexao.getConnection().prepareStatement( sql ) ) {
			consulta.setObject( 1, idVersao );
			consulta.setObject( 2, idFormulario );
			try ( ResultSet linhas = consulta.executeQuery() ) {
				while( linhas.next() ) campos.put( new JSONObject().put( "id", linhas.getString( "ID_VARIAVEL" ) )
					.put( "nome", linhas.getString( "DS_NOME" ) ).put( "codigo", linhas.getString( "CD_VARIAVEL" ) )
					.put( "tipo", linhas.getString( "TP_DADO" ) ).put( "acesso", linhas.getString( "TP_ACESSO" ) )
					.put( "obrigatorio", linhas.getBoolean( "SN_OBRIGATORIA" ) ).put( "apresentacao", linhas.getString( "TP_APRESENTACAO" ) ) );
			}
		}
		return campos;
	}

	public JSONObject meusProcessos( AutenticacaoLocalService.Usuario usuario ) throws Exception {

		JSONArray processos = new JSONArray();
		String sql = "select p.ID_PROCESSO, p.ID_USUARIO_GESTOR, p.TP_SITUACAO, p.DT_INICIO, p.DT_ENCERRAMENTO, v.DS_TITULO, v.NR_VERSAO "
			+ "from Processos.PROCESSOS p join Processos.PROTOCOLO_VERSOES v on v.ID_PROTOCOLO_VERSAO = p.ID_PROTOCOLO_VERSAO "
			+ "where p.ID_USUARIO_INICIOU = ? or p.ID_USUARIO_GESTOR = ? "
			+ "or exists (select 1 from Processos.PROCESSO_ETAPA_RESPONSAVEIS r join Processos.PROCESSO_ETAPAS e on e.ID_PROCESSO_ETAPA = r.ID_PROCESSO_ETAPA where e.ID_PROCESSO = p.ID_PROCESSO and r.ID_USUARIO_SISTEMA = ?) "
			+ "or exists (select 1 from Processos.PROCESSO_FORUM m where m.ID_PROCESSO = p.ID_PROCESSO and m.ID_USUARIO_AUTOR = ?) "
			+ "or exists (select 1 from Processos.PROCESSO_CONVIDADOS c where c.ID_PROCESSO = p.ID_PROCESSO and c.ID_USUARIO_CONVIDADO = ? and c.TP_SITUACAO = 'A') "
			+ "order by p.DT_INICIO desc";
		try ( Conexao conexao = PoolDeConexoes.getConexao(); PreparedStatement consulta = conexao.getConnection().prepareStatement( sql ) ) {
			for( int i = 1; i <= 5; i++ ) consulta.setObject( i, usuario.idUsuario() );
			try ( ResultSet linhas = consulta.executeQuery() ) {
				while( linhas.next() ) processos.put( new JSONObject().put( "id", linhas.getString( "ID_PROCESSO" ) )
					.put( "titulo", linhas.getString( "DS_TITULO" ) ).put( "versao", linhas.getInt( "NR_VERSAO" ) )
					.put( "situacao", linhas.getString( "TP_SITUACAO" ) ).put( "gestorAtual", usuario.idUsuario().toString().equals( linhas.getString( "ID_USUARIO_GESTOR" ) ) )
					.put( "inicio", linhas.getTimestamp( "DT_INICIO" ).toInstant().toString() )
					.put( "encerramento", linhas.getTimestamp( "DT_ENCERRAMENTO" ) == null ? JSONObject.NULL : linhas.getTimestamp( "DT_ENCERRAMENTO" ).toInstant().toString() ) );
			}
		}
		return new JSONObject().put( "processos", processos );
	}

	public JSONObject consultar( AutenticacaoLocalService.Usuario usuario, UUID idProcesso ) throws Exception {

		boolean participante = false;
		JSONArray meus = meusProcessos( usuario ).getJSONArray( "processos" );
		for( int i = 0; i < meus.length(); i++ ) {
			if( idProcesso.toString().equals( meus.getJSONObject( i ).getString( "id" ) ) ) { participante = true; break; }
		}
		if( !participante ) throw new ArgousFormsApiException( 403, "ACESSO_NEGADO", "Você não participa deste Processo." );
		try ( Conexao conexao = PoolDeConexoes.getConexao() ) {
			JSONObject processo;
			UUID idVersaoProtocolo;
			String sqlProcesso = "select p.ID_PROTOCOLO_VERSAO, p.TP_SITUACAO, p.DT_INICIO, p.DT_ENCERRAMENTO, p.ID_USUARIO_INICIOU, p.ID_USUARIO_GESTOR, "
				+ "v.DS_TITULO, v.NR_VERSAO, iniciador.DS_NOME as NOME_INICIADOR, gestor.DS_NOME as NOME_GESTOR "
				+ "from Processos.PROCESSOS p join Processos.PROTOCOLO_VERSOES v on v.ID_PROTOCOLO_VERSAO = p.ID_PROTOCOLO_VERSAO "
				+ "left join Cadastro.USUARIOS_SISTEMA iniciador on iniciador.ID_USUARIO_SISTEMA = p.ID_USUARIO_INICIOU "
				+ "left join Cadastro.USUARIOS_SISTEMA gestor on gestor.ID_USUARIO_SISTEMA = p.ID_USUARIO_GESTOR where p.ID_PROCESSO = ?";
			try ( PreparedStatement consulta = conexao.getConnection().prepareStatement( sqlProcesso ) ) {
				consulta.setObject( 1, idProcesso );
				try ( ResultSet linha = consulta.executeQuery() ) {
					if( !linha.next() ) throw new ArgousFormsApiException( 404, "PROCESSO_NAO_ENCONTRADO", "Processo não encontrado." );
					idVersaoProtocolo = linha.getObject( "ID_PROTOCOLO_VERSAO", UUID.class );
					processo = new JSONObject().put( "id", idProcesso.toString() ).put( "titulo", linha.getString( "DS_TITULO" ) )
						.put( "versao", linha.getInt( "NR_VERSAO" ) ).put( "situacao", linha.getString( "TP_SITUACAO" ) )
						.put( "podeConcluir", "A".equals( linha.getString( "TP_SITUACAO" ) ) && usuario.idUsuario().equals( linha.getObject( "ID_USUARIO_GESTOR", UUID.class ) ) )
						.put( "inicio", linha.getTimestamp( "DT_INICIO" ).toInstant().toString() ).put( "iniciador", linha.getString( "ID_USUARIO_INICIOU" ) )
						.put( "nomeIniciador", linha.getString( "NOME_INICIADOR" ) == null ? JSONObject.NULL : linha.getString( "NOME_INICIADOR" ) )
						.put( "gestor", linha.getString( "ID_USUARIO_GESTOR" ) == null ? JSONObject.NULL : linha.getString( "ID_USUARIO_GESTOR" ) )
						.put( "nomeGestor", linha.getString( "NOME_GESTOR" ) == null ? JSONObject.NULL : linha.getString( "NOME_GESTOR" ) )
						.put( "encerramento", linha.getTimestamp( "DT_ENCERRAMENTO" ) == null ? JSONObject.NULL : linha.getTimestamp( "DT_ENCERRAMENTO" ).toInstant().toString() );
				}
			}
			JSONArray etapas = new JSONArray();
			String sqlEtapas = "select e.ID_PROCESSO_ETAPA, e.ID_PROTOCOLO_ETAPA, pe.ID_FORMULARIO, pe.DS_TITULO, e.NR_PASSAGEM, e.TP_SITUACAO, "
				+ "e.ID_USUARIO_RESPONSAVEL, responsavel.DS_NOME as NOME_RESPONSAVEL, e.DT_DISPONIBILIZACAO, e.DT_ASSUMIU, e.DT_FINALIZACAO "
				+ "from Processos.PROCESSO_ETAPAS e join Processos.PROTOCOLOS_ETAPAS pe on pe.ID_PROTOCOLO_ETAPA = e.ID_PROTOCOLO_ETAPA "
				+ "left join Cadastro.USUARIOS_SISTEMA responsavel on responsavel.ID_USUARIO_SISTEMA = e.ID_USUARIO_RESPONSAVEL "
				+ "where e.ID_PROCESSO = ? order by e.DT_DISPONIBILIZACAO, e.NR_PASSAGEM";
			try ( PreparedStatement consulta = conexao.getConnection().prepareStatement( sqlEtapas ) ) {
				consulta.setObject( 1, idProcesso );
				try ( ResultSet linhas = consulta.executeQuery() ) {
					while( linhas.next() ) {
						UUID idEtapa = linhas.getObject( "ID_PROCESSO_ETAPA", UUID.class );
						boolean podeVerValores = usuario.idUsuario().toString().equals( processo.optString( "gestor" ) )
							|| participouDaEtapa( conexao, idEtapa, usuario.idUsuario() );
						JSONObject etapa = new JSONObject().put( "id", idEtapa.toString() )
						.put( "titulo", linhas.getString( "DS_TITULO" ) ).put( "passagem", linhas.getInt( "NR_PASSAGEM" ) )
						.put( "situacao", linhas.getString( "TP_SITUACAO" ) )
						.put( "podeVerValores", podeVerValores )
						.put( "podeAbrirFormulario", usuario.idUsuario().toString().equals( linhas.getString( "ID_USUARIO_RESPONSAVEL" ) )
							|| ( "D".equals( linhas.getString( "TP_SITUACAO" ) ) && elegivel( conexao, linhas.getObject( "ID_PROTOCOLO_ETAPA", UUID.class ), usuario.idUsuario() ) ) )
						.put( "responsavel", linhas.getString( "ID_USUARIO_RESPONSAVEL" ) == null ? JSONObject.NULL : linhas.getString( "ID_USUARIO_RESPONSAVEL" ) )
						.put( "nomeResponsavel", linhas.getString( "NOME_RESPONSAVEL" ) == null ? JSONObject.NULL : linhas.getString( "NOME_RESPONSAVEL" ) )
						.put( "disponibilizacao", linhas.getString( "DT_DISPONIBILIZACAO" ) )
						.put( "assumiu", linhas.getString( "DT_ASSUMIU" ) == null ? JSONObject.NULL : linhas.getString( "DT_ASSUMIU" ) )
						.put( "finalizacao", linhas.getString( "DT_FINALIZACAO" ) == null ? JSONObject.NULL : linhas.getString( "DT_FINALIZACAO" ) );
						if( podeVerValores && "F".equals( linhas.getString( "TP_SITUACAO" ) ) ) {
							etapa.put( "valores", valoresFinalizados( conexao, idEtapa, linhas.getObject( "ID_FORMULARIO", UUID.class ), idVersaoProtocolo ) );
						}
						etapas.put( etapa );
					}
				}
			}
			JSONArray documentos = new JSONArray();
			String sqlDocumentos = "select d.ID_ARQUIVO_VERSAO, a.ID_ARQUIVO, a.DS_TITULO, a.DS_NOME_ARQUIVO "
				+ "from Processos.PROCESSO_DOCUMENTO d join Docs.ARQUIVO_VERSOES av on av.ID_ARQUIVO_VERSAO = d.ID_ARQUIVO_VERSAO "
				+ "join Docs.ARQUIVOS a on a.ID_ARQUIVO = av.ID_ARQUIVO "
				+ "where d.ID_PROCESSO = ? and d.TP_SITUACAO = 'P' order by d.DT_GERACAO, d.NR_GERACAO";
			try ( PreparedStatement consulta = conexao.getConnection().prepareStatement( sqlDocumentos ) ) {
				consulta.setObject( 1, idProcesso );
				try ( ResultSet linhas = consulta.executeQuery() ) {
					while( linhas.next() ) documentos.put( new JSONObject().put( "idArquivoVersao", linhas.getString( "ID_ARQUIVO_VERSAO" ) )
						.put( "idArquivo", linhas.getString( "ID_ARQUIVO" ) ).put( "titulo", linhas.getString( "DS_TITULO" ) )
						.put( "nome", linhas.getString( "DS_NOME_ARQUIVO" ) ) );
				}
			}
			ForumProcessoService forum = new ForumProcessoService();
			return processo.put( "etapas", etapas ).put( "documentos", documentos ).put( "forum", forum.listar( conexao, idProcesso ) )
				.put( "podeComentar", forum.podeComentar( conexao, idProcesso, usuario.idUsuario() ) );
		}
	}

	private JSONArray valoresFinalizados( Conexao conexao, UUID idEtapa, UUID idFormulario, UUID idVersao ) throws Exception {

		JSONArray campos = new JSONArray();
		String sql = "select x.CD_VARIAVEL, x.TP_DADO, vv.DS_NOME, vv.JS_DEFINICAO, "
			+ "v.VL_TEXTO, v.VL_INTEIRO, v.VL_DECIMAL, v.CD_MOEDA, v.CD_VALOR_MONETARIO, v.VL_BOOLEANO, v.VL_OPCAO, v.VL_DATA, v.VL_HORA, v.VL_DATA_HORA "
			+ "from Processos.FORMULARIO_VARIAVEIS fv join Processos.PROTOCOLO_VARIAVEIS x on x.ID_VARIAVEL = fv.ID_VARIAVEL "
			+ "join Processos.PROTOCOLO_VERSAO_VARIAVEIS pv on pv.ID_PROTOCOLO_VERSAO = ? and pv.ID_VARIAVEL = x.ID_VARIAVEL "
			+ "join Processos.PROTOCOLO_VARIAVEL_VERSOES vv on vv.ID_VARIAVEL = x.ID_VARIAVEL and vv.NR_VERSAO = pv.NR_VERSAO "
			+ "left join Processos.PROCESSO_VARIAVEL_VALORES v on v.ID_PROCESSO_ETAPA = ? and v.ID_VARIAVEL = x.ID_VARIAVEL "
			+ "where fv.ID_FORMULARIO = ? order by fv.NR_ORDEM";
		try ( PreparedStatement consulta = conexao.getConnection().prepareStatement( sql ) ) {
			consulta.setObject( 1, idVersao );
			consulta.setObject( 2, idEtapa );
			consulta.setObject( 3, idFormulario );
			try ( ResultSet linhas = consulta.executeQuery() ) {
				while( linhas.next() ) {
					String tipo = linhas.getString( "TP_DADO" );
					String valor = switch( tipo ) {
						case "S" -> linhas.getString( "VL_TEXTO" );
						case "I" -> linhas.getString( "VL_INTEIRO" );
						case "R" -> linhas.getString( "VL_DECIMAL" );
						case "M" -> linhas.getString( "CD_MOEDA" );
						case "V" -> linhas.getString( "CD_VALOR_MONETARIO" ) == null ? null : linhas.getString( "CD_MOEDA" ) + " " + linhas.getString( "CD_VALOR_MONETARIO" );
						case "B" -> linhas.getObject( "VL_BOOLEANO" ) == null ? null : linhas.getBoolean( "VL_BOOLEANO" ) ? "Sim" : "Não";
						case "O" -> linhas.getString( "VL_OPCAO" );
						case "D" -> linhas.getString( "VL_DATA" );
						case "H" -> linhas.getString( "VL_HORA" );
						case "T" -> linhas.getTimestamp( "VL_DATA_HORA" ) == null ? null : linhas.getTimestamp( "VL_DATA_HORA" ).toInstant().toString();
						default -> null;
					};
					campos.put( new JSONObject().put( "codigo", linhas.getString( "CD_VARIAVEL" ) ).put( "nome", linhas.getString( "DS_NOME" ) )
						.put( "tipo", tipo ).put( "valor", valor == null ? JSONObject.NULL : valor )
						.put( "definicao", new JSONObject( linhas.getString( "JS_DEFINICAO" ) ) ) );
				}
			}
		}
		return campos;
	}

	public JSONObject minhasTarefas( AutenticacaoLocalService.Usuario usuario ) throws Exception {

		Map<String, JSONObject> tarefas = new LinkedHashMap<>();
		JSONArray vinculados = meusProcessos( usuario ).getJSONArray( "processos" );
		for( int i = 0; i < vinculados.length(); i++ ) {
			JSONObject processo = vinculados.getJSONObject( i );
			String situacao = processo.getString( "situacao" );
			tarefas.put( processo.getString( "id" ), new JSONObject().put( "idProcesso", processo.getString( "id" ) )
				.put( "titulo", processo.getString( "titulo" ) ).put( "situacao", situacao )
				.put( "categoria", "F".equals( situacao ) || "C".equals( situacao ) ? "encerrados"
					: "A".equals( situacao ) && processo.getBoolean( "gestorAtual" ) ? "aguardando" : "emAndamento" )
				.put( "etapas", new JSONArray() ) );
		}
		String sql = "select p.ID_PROCESSO, p.TP_SITUACAO as PROCESSO_SITUACAO, v.DS_TITULO, e.ID_PROCESSO_ETAPA, e.ID_PROTOCOLO_ETAPA, e.TP_SITUACAO as ETAPA_SITUACAO, e.ID_USUARIO_RESPONSAVEL, pe.DS_TITULO as ETAPA_TITULO "
			+ "from Processos.PROCESSO_ETAPAS e join Processos.PROCESSOS p on p.ID_PROCESSO = e.ID_PROCESSO "
			+ "join Processos.PROTOCOLO_VERSOES v on v.ID_PROTOCOLO_VERSAO = p.ID_PROTOCOLO_VERSAO "
			+ "join Processos.PROTOCOLOS_ETAPAS pe on pe.ID_PROTOCOLO_ETAPA = e.ID_PROTOCOLO_ETAPA "
			+ "order by e.DT_DISPONIBILIZACAO desc";
		try ( Conexao conexao = PoolDeConexoes.getConexao(); PreparedStatement consulta = conexao.getConnection().prepareStatement( sql ); ResultSet linhas = consulta.executeQuery() ) {
			while( linhas.next() ) {
				UUID idProcesso = linhas.getObject( "ID_PROCESSO", UUID.class );
				UUID idEtapa = linhas.getObject( "ID_PROCESSO_ETAPA", UUID.class );
				String situacao = linhas.getString( "PROCESSO_SITUACAO" );
				String responsavel = linhas.getString( "ID_USUARIO_RESPONSAVEL" );
				boolean minha = usuario.idUsuario().toString().equals( responsavel ) && !"F".equals( linhas.getString( "ETAPA_SITUACAO" ) );
				boolean historico = participouDaEtapa( conexao, idEtapa, usuario.idUsuario() );
				boolean disponivel = "D".equals( linhas.getString( "ETAPA_SITUACAO" ) ) && responsavel == null
					&& elegivel( conexao, linhas.getObject( "ID_PROTOCOLO_ETAPA", UUID.class ), usuario.idUsuario() );
				if( !minha && !historico && !disponivel ) continue;
				JSONObject tarefa = tarefas.get( idProcesso.toString() );
				if( tarefa == null ) {
					tarefa = new JSONObject().put( "idProcesso", idProcesso.toString() ).put( "titulo", linhas.getString( "DS_TITULO" ) )
						.put( "situacao", situacao ).put( "categoria", "emAndamento" ).put( "etapas", new JSONArray() );
					tarefas.put( idProcesso.toString(), tarefa );
				}
				if( "F".equals( situacao ) || "C".equals( situacao ) ) tarefa.put( "categoria", "encerrados" );
				else if( minha ) tarefa.put( "categoria", "aguardando" );
				else if( disponivel && !"aguardando".equals( tarefa.getString( "categoria" ) ) ) tarefa.put( "categoria", "disponiveis" );
				tarefa.getJSONArray( "etapas" ).put( new JSONObject().put( "id", idEtapa.toString() )
					.put( "titulo", linhas.getString( "ETAPA_TITULO" ) ).put( "responsavel", minha ).put( "disponivel", disponivel ) );
			}
		}
		return new JSONObject().put( "tarefas", new JSONArray( tarefas.values() ) );
	}

	private boolean participouDaEtapa( Conexao conexao, UUID idEtapa, UUID idUsuario ) throws Exception {

		try ( PreparedStatement consulta = conexao.getConnection().prepareStatement( "select 1 from Processos.PROCESSO_ETAPA_RESPONSAVEIS where ID_PROCESSO_ETAPA = ? and ID_USUARIO_SISTEMA = ?" ) ) {
			consulta.setObject( 1, idEtapa );
			consulta.setObject( 2, idUsuario );
			try ( ResultSet linhas = consulta.executeQuery() ) { return linhas.next(); }
		}
	}

	boolean elegivelEtapa( Conexao conexao, UUID idEtapa, UUID idUsuario ) throws Exception {

		return elegivel( conexao, idEtapa, idUsuario );
	}

	private boolean elegivel( Conexao conexao, UUID idEtapa, UUID idUsuario ) throws Exception {

		return elegivel( conexao, "Processos.PROTOCOLO_ETAPA_DESTINATARIOS", "ID_PROTOCOLO_ETAPA", idEtapa, idUsuario );
	}

	private boolean elegivel( Conexao conexao, String tabela, String coluna, UUID id, UUID idUsuario ) throws Exception {

		String sql = "select 1 from " + tabela + " d where d." + coluna + " = ? "
			+ "and (d.ID_USUARIO_SISTEMA is null or d.ID_USUARIO_SISTEMA = ?) "
			+ "and (d.ID_GRUPO is null or exists (select 1 from Cadastro.USUARIO_GRUPOS ug join Cadastro.GRUPOS g on g.ID_GRUPO = ug.ID_GRUPO where ug.ID_USUARIO_SISTEMA = ? and ug.ID_GRUPO = d.ID_GRUPO and ug.SN_ATIVO and g.SN_ATIVO)) "
			+ "and (d.CD_TAG_USUARIO is null or exists (select 1 from Cadastro.USUARIO_TAGS ut join Cadastro.TAGS t on t.CD_TAG = ut.CD_TAG where ut.ID_USUARIO_SISTEMA = ? and ut.CD_TAG = d.CD_TAG_USUARIO and ut.SN_ATIVA and t.SN_ATIVA and t.SN_USUARIO)) "
			+ "and (d.CD_TAG_GRUPO is null or exists (select 1 from Cadastro.USUARIO_GRUPOS ug join Cadastro.GRUPO_TAGS gt on gt.ID_GRUPO = ug.ID_GRUPO join Cadastro.GRUPOS g on g.ID_GRUPO = ug.ID_GRUPO join Cadastro.TAGS t on t.CD_TAG = gt.CD_TAG where ug.ID_USUARIO_SISTEMA = ? and ug.SN_ATIVO and g.SN_ATIVO and (d.ID_GRUPO is null or d.ID_GRUPO = ug.ID_GRUPO) and gt.CD_TAG = d.CD_TAG_GRUPO and gt.SN_ATIVA and t.SN_ATIVA and t.SN_GRUPO)) "
			+ "and (d.CD_TAG_VINCULO is null or exists (select 1 from Cadastro.VINCULO_TAGS vt join Cadastro.USUARIO_GRUPOS ug on ug.ID_USUARIO_SISTEMA = vt.ID_USUARIO_SISTEMA and ug.ID_GRUPO = vt.ID_GRUPO join Cadastro.TAGS t on t.CD_TAG = vt.CD_TAG where vt.ID_USUARIO_SISTEMA = ? and (d.ID_GRUPO is null or d.ID_GRUPO = vt.ID_GRUPO) and vt.CD_TAG = d.CD_TAG_VINCULO and vt.SN_ATIVO and ug.SN_ATIVO and t.SN_ATIVA and t.SN_VINCULO)) limit 1";
		try ( PreparedStatement consulta = conexao.getConnection().prepareStatement( sql ) ) {
			consulta.setObject( 1, id );
			for( int i = 2; i <= 6; i++ ) consulta.setObject( i, idUsuario );
			try ( ResultSet linhas = consulta.executeQuery() ) { return linhas.next(); }
		}
	}

	private void exigirEditor( AutenticacaoLocalService.Usuario usuario ) throws ArgousFormsApiException {

		if( !usuario.papeis().contains( "EDITOR_DE_DOCUMENTOS" ) ) throw new ArgousFormsApiException( 403, "ACESSO_NEGADO", "Seu usuário não pode iniciar Processos." );
	}
}
