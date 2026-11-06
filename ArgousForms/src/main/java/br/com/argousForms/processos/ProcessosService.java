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
import quatro.sql.Conexao;
import quatro.sql.PoolDeConexoes;
import quatro.util.QtData;

public final class ProcessosService {

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
					.put( "inicio", linhas.getString( "DT_INICIO" ) )
					.put( "encerramento", linhas.getString( "DT_ENCERRAMENTO" ) == null ? JSONObject.NULL : linhas.getString( "DT_ENCERRAMENTO" ) ) );
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
			try ( PreparedStatement consulta = conexao.getConnection().prepareStatement( "select p.TP_SITUACAO, p.DT_INICIO, p.DT_ENCERRAMENTO, p.ID_USUARIO_INICIOU, p.ID_USUARIO_GESTOR, v.DS_TITULO, v.NR_VERSAO from Processos.PROCESSOS p join Processos.PROTOCOLO_VERSOES v on v.ID_PROTOCOLO_VERSAO = p.ID_PROTOCOLO_VERSAO where p.ID_PROCESSO = ?" ) ) {
				consulta.setObject( 1, idProcesso );
				try ( ResultSet linha = consulta.executeQuery() ) {
					if( !linha.next() ) throw new ArgousFormsApiException( 404, "PROCESSO_NAO_ENCONTRADO", "Processo não encontrado." );
					processo = new JSONObject().put( "id", idProcesso.toString() ).put( "titulo", linha.getString( "DS_TITULO" ) )
						.put( "versao", linha.getInt( "NR_VERSAO" ) ).put( "situacao", linha.getString( "TP_SITUACAO" ) )
						.put( "inicio", linha.getString( "DT_INICIO" ) ).put( "iniciador", linha.getString( "ID_USUARIO_INICIOU" ) )
						.put( "gestor", linha.getString( "ID_USUARIO_GESTOR" ) == null ? JSONObject.NULL : linha.getString( "ID_USUARIO_GESTOR" ) )
						.put( "encerramento", linha.getString( "DT_ENCERRAMENTO" ) == null ? JSONObject.NULL : linha.getString( "DT_ENCERRAMENTO" ) );
				}
			}
			JSONArray etapas = new JSONArray();
			try ( PreparedStatement consulta = conexao.getConnection().prepareStatement( "select e.ID_PROCESSO_ETAPA, pe.DS_TITULO, e.NR_PASSAGEM, e.TP_SITUACAO, e.ID_USUARIO_RESPONSAVEL, e.DT_DISPONIBILIZACAO, e.DT_ASSUMIU, e.DT_FINALIZACAO from Processos.PROCESSO_ETAPAS e join Processos.PROTOCOLOS_ETAPAS pe on pe.ID_PROTOCOLO_ETAPA = e.ID_PROTOCOLO_ETAPA where e.ID_PROCESSO = ? order by e.DT_DISPONIBILIZACAO, e.NR_PASSAGEM" ) ) {
				consulta.setObject( 1, idProcesso );
				try ( ResultSet linhas = consulta.executeQuery() ) {
					while( linhas.next() ) etapas.put( new JSONObject().put( "id", linhas.getString( "ID_PROCESSO_ETAPA" ) )
						.put( "titulo", linhas.getString( "DS_TITULO" ) ).put( "passagem", linhas.getInt( "NR_PASSAGEM" ) )
						.put( "situacao", linhas.getString( "TP_SITUACAO" ) )
						.put( "responsavel", linhas.getString( "ID_USUARIO_RESPONSAVEL" ) == null ? JSONObject.NULL : linhas.getString( "ID_USUARIO_RESPONSAVEL" ) )
						.put( "disponibilizacao", linhas.getString( "DT_DISPONIBILIZACAO" ) )
						.put( "assumiu", linhas.getString( "DT_ASSUMIU" ) == null ? JSONObject.NULL : linhas.getString( "DT_ASSUMIU" ) )
						.put( "finalizacao", linhas.getString( "DT_FINALIZACAO" ) == null ? JSONObject.NULL : linhas.getString( "DT_FINALIZACAO" ) ) );
				}
			}
			return processo.put( "etapas", etapas );
		}
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
				boolean minha = usuario.idUsuario().toString().equals( responsavel );
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
