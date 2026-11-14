package br.com.argousForms.processos;

import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.time.Instant;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;

import org.json.JSONArray;
import org.json.JSONObject;

import br.com.argousForms.api.ArgousFormsApiException;
import br.com.argousForms.auth.AutenticacaoLocalService;
import br.com.argousForms.model.negocio.notificacoes.EventoNegocio;
import br.com.argousForms.model.negocio.notificacoes.NotificacaoNegocio;
import br.com.argousForms.model.negocio.processos.ProcessoEtapaNegocio;
import br.com.argousForms.model.negocio.processos.ProcessoEtapaResponsavelNegocio;
import br.com.argousForms.model.persistencia.notificacoes.Evento;
import br.com.argousForms.model.persistencia.notificacoes.Notificacao;
import br.com.argousForms.model.persistencia.notificacoes.NotificacaoLocalizador;
import br.com.argousForms.model.persistencia.processos.ProcessoEtapa;
import br.com.argousForms.model.persistencia.processos.ProcessoEtapaLocalizador;
import br.com.argousForms.model.persistencia.processos.ProcessoEtapaResponsavel;
import br.com.argousForms.model.persistencia.processos.ProcessoEtapaResponsavelLocalizador;
import quatro.sql.Conexao;
import quatro.sql.PoolDeConexoes;
import quatro.util.QtData;

public final class NotificacoesService {

	public void etapaDisponivel( Conexao conexao, UUID idProcesso, UUID idEtapa, UUID idProtocoloEtapa, UUID idVersao, UUID ator, String titulo ) throws Exception {

		Set<UUID> destinatarios = new HashSet<>();
		String sql = "select ID_USUARIO_SISTEMA from Cadastro.USUARIOS_SISTEMA where DT_EXCLUSAO is null";
		try ( PreparedStatement consulta = conexao.getConnection().prepareStatement( sql ); ResultSet linhas = consulta.executeQuery() ) {
			ProcessosService processos = new ProcessosService();
			while( linhas.next() ) {
				UUID idUsuario = linhas.getObject( 1, UUID.class );
				if( processos.elegivelEtapa( conexao, idProtocoloEtapa, idUsuario ) ) destinatarios.add( idUsuario );
			}
		}
		Evento evento = evento( conexao, "ETAPA_DISPONIVEL", idProcesso, idEtapa, idVersao, ator, "Etapa disponível: " + titulo,
			"Uma etapa está aguardando que alguém a assuma.", "ETAPA_DISPONIVEL:" + idEtapa );
		for( UUID destinatario : destinatarios ) entregar( conexao, evento.getIdEvento(), destinatario, "A" );
	}

	public void etapaAssumida( Conexao conexao, UUID idEtapa, UUID idProcesso, UUID ator, String titulo ) throws Exception {

		String nomeAtor = nomeUsuario( conexao, ator );
		String sql = "select n.ID_NOTIFICACAO, n.ID_USUARIO_DESTINO from Notificacoes.NOTIFICACOES n "
			+ "join Notificacoes.EVENTOS e on e.ID_EVENTO = n.ID_EVENTO "
			+ "where e.ID_PROCESSO_ETAPA = ? and e.CD_TIPO = 'ETAPA_DISPONIVEL' and n.TP_SITUACAO = 'P' for update of n";
		try ( PreparedStatement consulta = conexao.getConnection().prepareStatement( sql ) ) {
			consulta.setObject( 1, idEtapa );
			try ( ResultSet linhas = consulta.executeQuery() ) {
				while( linhas.next() ) {
					Notificacao notificacao = NotificacaoLocalizador.buscaNotificacao( conexao, linhas.getObject( 1, UUID.class ) );
					boolean assumiu = ator.equals( linhas.getObject( 2, UUID.class ) );
					notificacao.setTpSituacao( assumiu ? "A" : "E" );
					notificacao.setDtEncerramento( new QtData( Instant.now().toEpochMilli() ) );
					notificacao.setIdUsuarioAtendeu( ator );
					notificacao.setDsResultado( assumiu ? "Etapa assumida por você." : "Etapa assumida por " + nomeAtor + "." );
					new NotificacaoNegocio( conexao, notificacao ).altera();
				}
			}
		}
		Evento evento = evento( conexao, "ETAPA_ASSUMIDA", idProcesso, idEtapa, null, ator, "Etapa assumida: " + titulo,
			"A etapa foi assumida por um participante.", "ETAPA_ASSUMIDA:" + idEtapa );
		entregar( conexao, evento.getIdEvento(), ator, "I" );
	}

	public void aguardaConclusao( Conexao conexao, UUID idProcesso, UUID idEtapa, UUID gestor, UUID ator ) throws Exception {

		Evento evento = evento( conexao, "PROCESSO_AGUARDA_CONCLUSAO", idProcesso, idEtapa, null, ator,
			"Processo aguardando conclusão", "Confira o processo e conclua quando estiver pronto.", "PROCESSO_AGUARDA_CONCLUSAO:" + idProcesso );
		entregar( conexao, evento.getIdEvento(), gestor, "A" );
	}

	public void processoConcluido( Conexao conexao, UUID idProcesso, UUID gestor ) throws Exception {

		String sql = "select n.ID_NOTIFICACAO from Notificacoes.NOTIFICACOES n join Notificacoes.EVENTOS e "
			+ "on e.ID_EVENTO = n.ID_EVENTO where e.ID_PROCESSO = ? and e.CD_TIPO = 'PROCESSO_AGUARDA_CONCLUSAO' "
			+ "and n.TP_SITUACAO = 'P' for update of n";
		try ( PreparedStatement consulta = conexao.getConnection().prepareStatement( sql ) ) {
			consulta.setObject( 1, idProcesso );
			try ( ResultSet linhas = consulta.executeQuery() ) {
				while( linhas.next() ) {
					Notificacao notificacao = NotificacaoLocalizador.buscaNotificacao( conexao, linhas.getObject( 1, UUID.class ) );
					notificacao.setTpSituacao( "A" );
					notificacao.setDtEncerramento( new QtData( Instant.now().toEpochMilli() ) );
					notificacao.setIdUsuarioAtendeu( gestor );
					notificacao.setDsResultado( "Processo concluído." );
					new NotificacaoNegocio( conexao, notificacao ).altera();
				}
			}
		}
		Set<UUID> participantes = new HashSet<>();
		String envolvidos = "select ID_USUARIO_INICIOU from Processos.PROCESSOS where ID_PROCESSO = ? "
			+ "union select r.ID_USUARIO_SISTEMA from Processos.PROCESSO_ETAPA_RESPONSAVEIS r "
			+ "join Processos.PROCESSO_ETAPAS e on e.ID_PROCESSO_ETAPA = r.ID_PROCESSO_ETAPA where e.ID_PROCESSO = ?";
		try ( PreparedStatement consulta = conexao.getConnection().prepareStatement( envolvidos ) ) {
			consulta.setObject( 1, idProcesso );
			consulta.setObject( 2, idProcesso );
			try ( ResultSet linhas = consulta.executeQuery() ) {
				while( linhas.next() ) {
					UUID idUsuario = linhas.getObject( 1, UUID.class );
					if( !gestor.equals( idUsuario ) ) participantes.add( idUsuario );
				}
			}
		}
		if( participantes.isEmpty() ) return;
		Evento evento = evento( conexao, "PROCESSO_CONCLUIDO", idProcesso, null, null, gestor,
			"Processo concluído", "Um processo do qual você participou foi concluído.", "PROCESSO_CONCLUIDO:" + idProcesso );
		for( UUID participante : participantes ) entregar( conexao, evento.getIdEvento(), participante, "I" );
	}

	public JSONObject listar( AutenticacaoLocalService.Usuario usuario, int limiteInformado ) throws Exception {

		reconciliarElegibilidade( usuario );
		reconciliarResponsaveis( usuario );
		int limite = Math.max( 1, Math.min( limiteInformado, 100 ) );
		JSONArray itens = new JSONArray();
		int naoLidas;
		String sql = "select n.ID_NOTIFICACAO, n.TP_NATUREZA, n.TP_SITUACAO, n.DT_ENTREGA, n.DT_VISUALIZACAO, "
			+ "n.DT_ENCERRAMENTO, n.DS_RESULTADO, n.ID_USUARIO_ATENDEU, e.CD_TIPO, e.DS_TITULO, e.DS_RESUMO, "
			+ "e.ID_PROCESSO, e.ID_PROCESSO_ETAPA from Notificacoes.NOTIFICACOES n join Notificacoes.EVENTOS e "
			+ "on e.ID_EVENTO = n.ID_EVENTO where n.ID_USUARIO_DESTINO = ? order by n.DT_ENTREGA desc limit ?";
		try ( Conexao conexao = PoolDeConexoes.getConexao(); PreparedStatement consulta = conexao.getConnection().prepareStatement( sql ) ) {
			try ( PreparedStatement contador = conexao.getConnection().prepareStatement(
				"select count(*) from Notificacoes.NOTIFICACOES where ID_USUARIO_DESTINO = ? and DT_VISUALIZACAO is null" ) ) {
				contador.setObject( 1, usuario.idUsuario() );
				try ( ResultSet linha = contador.executeQuery() ) { linha.next(); naoLidas = linha.getInt( 1 ); }
			}
			consulta.setObject( 1, usuario.idUsuario() );
			consulta.setInt( 2, limite );
			try ( ResultSet linhas = consulta.executeQuery() ) {
				while( linhas.next() ) {
					itens.put( new JSONObject().put( "id", linhas.getString( "ID_NOTIFICACAO" ) )
						.put( "tipo", linhas.getString( "CD_TIPO" ) ).put( "titulo", linhas.getString( "DS_TITULO" ) )
						.put( "resumo", linhas.getString( "DS_RESUMO" ) == null ? "" : linhas.getString( "DS_RESUMO" ) )
						.put( "natureza", linhas.getString( "TP_NATUREZA" ) ).put( "situacao", linhas.getString( "TP_SITUACAO" ) )
						.put( "entrega", linhas.getTimestamp( "DT_ENTREGA" ).toInstant().toString() )
						.put( "visualizacao", instante( linhas, "DT_VISUALIZACAO" ) ).put( "encerramento", instante( linhas, "DT_ENCERRAMENTO" ) )
						.put( "resultado", linhas.getString( "DS_RESULTADO" ) == null ? "" : linhas.getString( "DS_RESULTADO" ) )
						.put( "idUsuarioAtendeu", linhas.getString( "ID_USUARIO_ATENDEU" ) == null ? JSONObject.NULL : linhas.getString( "ID_USUARIO_ATENDEU" ) )
						.put( "idProcesso", linhas.getString( "ID_PROCESSO" ) == null ? JSONObject.NULL : linhas.getString( "ID_PROCESSO" ) )
						.put( "idEtapa", linhas.getString( "ID_PROCESSO_ETAPA" ) == null ? JSONObject.NULL : linhas.getString( "ID_PROCESSO_ETAPA" ) ) );
				}
			}
		}
		return new JSONObject().put( "notificacoes", itens ).put( "naoLidas", naoLidas );
	}

	private void reconciliarResponsaveis( AutenticacaoLocalService.Usuario gestor ) throws Exception {

		try ( Conexao conexao = PoolDeConexoes.getConexao() ) {
			conexao.beginTransaction();
			try {
				String sql = "select e.ID_PROCESSO_ETAPA, e.ID_PROCESSO, e.ID_PROTOCOLO_ETAPA, e.ID_USUARIO_RESPONSAVEL, "
					+ "r.ID_ETAPA_RESPONSAVEL from Processos.PROCESSO_ETAPAS e "
					+ "join Processos.PROCESSOS p on p.ID_PROCESSO = e.ID_PROCESSO "
					+ "join Processos.PROCESSO_ETAPA_RESPONSAVEIS r on r.ID_PROCESSO_ETAPA = e.ID_PROCESSO_ETAPA and r.DT_FIM is null "
					+ "where p.ID_USUARIO_GESTOR = ? and e.TP_SITUACAO in ('I', 'P', 'S') "
					+ "and e.ID_USUARIO_RESPONSAVEL is not null for update of e";
				try ( PreparedStatement consulta = conexao.getConnection().prepareStatement( sql ) ) {
					consulta.setObject( 1, gestor.idUsuario() );
					try ( ResultSet linhas = consulta.executeQuery() ) {
						ProcessosService processos = new ProcessosService();
						while( linhas.next() ) {
							UUID responsavel = linhas.getObject( "ID_USUARIO_RESPONSAVEL", UUID.class );
							if( usuarioAtivo( conexao, responsavel ) && processos.elegivelEtapa( conexao,
								linhas.getObject( "ID_PROTOCOLO_ETAPA", UUID.class ), responsavel ) ) continue;
							String chave = "RESPONSAVEL_VINCULO_PERDIDO:" + linhas.getString( "ID_ETAPA_RESPONSAVEL" ) + ":" + gestor.idUsuario();
							if( eventoExiste( conexao, chave ) ) continue;
							Evento evento = evento( conexao, "RESPONSAVEL_VINCULO_PERDIDO", linhas.getObject( "ID_PROCESSO", UUID.class ),
								linhas.getObject( "ID_PROCESSO_ETAPA", UUID.class ), null, responsavel, "Responsável perdeu o vínculo com a tarefa",
								"Decida se o responsável permanece ou se a etapa volta a ficar disponível.", chave );
							entregar( conexao, evento.getIdEvento(), gestor.idUsuario(), "A" );
						}
					}
				}
				conexao.commit();
			} catch ( Exception e ) {
				if( conexao.inTransaction() ) conexao.rollback();
				throw e;
			}
		}
	}

	public JSONObject decidirResponsavel( AutenticacaoLocalService.Usuario gestor, UUID idNotificacao, boolean manter ) throws Exception {

		try ( Conexao conexao = PoolDeConexoes.getConexao() ) {
			conexao.beginTransaction();
			try {
				String sql = "select e.ID_PROCESSO_ETAPA, e.CD_CHAVE_EVENTO, n.ID_USUARIO_DESTINO, n.TP_SITUACAO "
					+ "from Notificacoes.NOTIFICACOES n join Notificacoes.EVENTOS e on e.ID_EVENTO = n.ID_EVENTO "
					+ "where n.ID_NOTIFICACAO = ? and e.CD_TIPO = 'RESPONSAVEL_VINCULO_PERDIDO' for update of n";
				UUID idEtapa;
				UUID idResponsabilidade;
				try ( PreparedStatement consulta = conexao.getConnection().prepareStatement( sql ) ) {
					consulta.setObject( 1, idNotificacao );
					try ( ResultSet linha = consulta.executeQuery() ) {
						if( !linha.next() ) throw new ArgousFormsApiException( 404, "NOTIFICACAO_NAO_ENCONTRADA", "Decisão não encontrada." );
						if( !gestor.idUsuario().equals( linha.getObject( "ID_USUARIO_DESTINO", UUID.class ) ) ) throw new ArgousFormsApiException( 403, "ACESSO_NEGADO", "Decisão de outro gestor." );
						if( !"P".equals( linha.getString( "TP_SITUACAO" ) ) ) throw new ArgousFormsApiException( 409, "DECISAO_JA_REGISTRADA", "Esta decisão já foi registrada." );
						idEtapa = linha.getObject( "ID_PROCESSO_ETAPA", UUID.class );
						int inicio = "RESPONSAVEL_VINCULO_PERDIDO:".length();
						idResponsabilidade = UUID.fromString( linha.getString( "CD_CHAVE_EVENTO" ).substring( inicio, inicio + 36 ) );
					}
				}
				try ( PreparedStatement consulta = conexao.getConnection().prepareStatement(
					"select e.ID_USUARIO_RESPONSAVEL from Processos.PROCESSO_ETAPAS e join Processos.PROCESSOS p "
						+ "on p.ID_PROCESSO = e.ID_PROCESSO where e.ID_PROCESSO_ETAPA = ? and p.ID_USUARIO_GESTOR = ? "
						+ "and e.TP_SITUACAO in ('I', 'P', 'S') for update of e" ) ) {
					consulta.setObject( 1, idEtapa );
					consulta.setObject( 2, gestor.idUsuario() );
					try ( ResultSet linha = consulta.executeQuery() ) {
						if( !linha.next() || linha.getObject( 1 ) == null ) throw new ArgousFormsApiException( 409, "RESPONSABILIDADE_MUDOU", "A responsabilidade da etapa mudou." );
					}
				}
				ProcessoEtapaResponsavel historico = ProcessoEtapaResponsavelLocalizador.buscaProcessoEtapaResponsavel( conexao, idResponsabilidade );
				if( historico.getDtFim() != null || !idEtapa.equals( historico.getIdProcessoEtapa() ) ) throw new ArgousFormsApiException( 409, "RESPONSABILIDADE_MUDOU", "A responsabilidade da etapa mudou." );
				if( manter && !usuarioAtivo( conexao, historico.getIdUsuarioSistema() ) ) {
					throw new ArgousFormsApiException( 409, "CONTA_INATIVA", "A conta do responsável está excluída. Redisponibilize a etapa." );
				}
				QtData agora = new QtData( Instant.now().toEpochMilli() );
				if( !manter ) {
					ProcessoEtapa etapa = ProcessoEtapaLocalizador.buscaProcessoEtapa( conexao, idEtapa );
					if( !historico.getIdUsuarioSistema().equals( etapa.getIdUsuarioResponsavel() ) ) throw new ArgousFormsApiException( 409, "RESPONSABILIDADE_MUDOU", "A responsabilidade da etapa mudou." );
					etapa.setIdUsuarioResponsavel( null );
					etapa.setDtAssumiu( null );
					etapa.setTpSituacao( "D" );
					etapa.setDtDisponibilizacao( agora );
					new ProcessoEtapaNegocio( conexao, etapa ).altera();
					historico.setDtFim( agora );
					historico.setTpFim( "5" );
					historico.setDsObservacoes( "Responsabilidade encerrada por decisão do gestor após perda de vínculo." );
					new ProcessoEtapaResponsavelNegocio( conexao, historico ).altera();
				}
				Notificacao notificacao = NotificacaoLocalizador.buscaNotificacao( conexao, idNotificacao );
				notificacao.setTpSituacao( "A" );
				notificacao.setDtEncerramento( agora );
				notificacao.setIdUsuarioAtendeu( gestor.idUsuario() );
				notificacao.setDsResultado( manter ? "O gestor manteve o responsável." : "O gestor redisponibilizou a etapa." );
				new NotificacaoNegocio( conexao, notificacao ).altera();
				conexao.commit();
				return new JSONObject().put( "idNotificacao", idNotificacao.toString() ).put( "manteve", manter );
			} catch ( Exception e ) {
				if( conexao.inTransaction() ) conexao.rollback();
				throw e;
			}
		}
	}

	private boolean eventoExiste( Conexao conexao, String chave ) throws Exception {

		try ( PreparedStatement consulta = conexao.getConnection().prepareStatement( "select 1 from Notificacoes.EVENTOS where CD_CHAVE_EVENTO = ?" ) ) {
			consulta.setString( 1, chave );
			try ( ResultSet linha = consulta.executeQuery() ) { return linha.next(); }
		}
	}

	private boolean usuarioAtivo( Conexao conexao, UUID idUsuario ) throws Exception {

		try ( PreparedStatement consulta = conexao.getConnection().prepareStatement(
			"select 1 from Cadastro.USUARIOS_SISTEMA where ID_USUARIO_SISTEMA = ? and DT_EXCLUSAO is null" ) ) {
			consulta.setObject( 1, idUsuario );
			try ( ResultSet linha = consulta.executeQuery() ) { return linha.next(); }
		}
	}

	private void reconciliarElegibilidade( AutenticacaoLocalService.Usuario usuario ) throws Exception {

		try ( Conexao conexao = PoolDeConexoes.getConexao() ) {
			conexao.beginTransaction();
			try {
				String sql = "select e.ID_EVENTO, p.ID_PROTOCOLO_ETAPA, n.ID_NOTIFICACAO "
					+ "from Notificacoes.EVENTOS e join Processos.PROCESSO_ETAPAS p "
					+ "on p.ID_PROCESSO_ETAPA = e.ID_PROCESSO_ETAPA "
					+ "left join Notificacoes.NOTIFICACOES n on n.ID_EVENTO = e.ID_EVENTO "
					+ "and n.ID_USUARIO_DESTINO = ? and n.TP_SITUACAO = 'P' "
					+ "where e.CD_TIPO = 'ETAPA_DISPONIVEL' and p.TP_SITUACAO = 'D' "
					+ "and p.ID_USUARIO_RESPONSAVEL is null for update of p";
				try ( PreparedStatement consulta = conexao.getConnection().prepareStatement( sql ) ) {
					consulta.setObject( 1, usuario.idUsuario() );
					try ( ResultSet linhas = consulta.executeQuery() ) {
						ProcessosService processos = new ProcessosService();
						while( linhas.next() ) {
							boolean elegivel = processos.elegivelEtapa( conexao, linhas.getObject( "ID_PROTOCOLO_ETAPA", UUID.class ), usuario.idUsuario() );
							UUID idNotificacao = linhas.getObject( "ID_NOTIFICACAO", UUID.class );
							if( elegivel && idNotificacao == null ) entregar( conexao, linhas.getObject( "ID_EVENTO", UUID.class ), usuario.idUsuario(), "A" );
							if( !elegivel && idNotificacao != null ) {
								Notificacao notificacao = NotificacaoLocalizador.buscaNotificacao( conexao, idNotificacao );
								notificacao.setTpSituacao( "E" );
								notificacao.setDtEncerramento( new QtData( Instant.now().toEpochMilli() ) );
								notificacao.setDsResultado( "Você deixou de ser elegível para esta etapa." );
								new NotificacaoNegocio( conexao, notificacao ).altera();
							}
						}
					}
				}
				conexao.commit();
			} catch ( Exception e ) {
				if( conexao.inTransaction() ) conexao.rollback();
				throw e;
			}
		}
	}

	public JSONObject marcarLida( AutenticacaoLocalService.Usuario usuario, UUID idNotificacao ) throws Exception {

		try ( Conexao conexao = PoolDeConexoes.getConexao() ) {
			conexao.beginTransaction();
			try {
				String sql = "select ID_USUARIO_DESTINO from Notificacoes.NOTIFICACOES where ID_NOTIFICACAO = ? for update";
				try ( PreparedStatement consulta = conexao.getConnection().prepareStatement( sql ) ) {
					consulta.setObject( 1, idNotificacao );
					try ( ResultSet linhas = consulta.executeQuery() ) {
						if( !linhas.next() ) throw new ArgousFormsApiException( 404, "NOTIFICACAO_NAO_ENCONTRADA", "Notificação não encontrada." );
						if( !usuario.idUsuario().equals( linhas.getObject( 1, UUID.class ) ) ) throw new ArgousFormsApiException( 403, "ACESSO_NEGADO", "Notificação de outro usuário." );
					}
				}
				Notificacao notificacao = NotificacaoLocalizador.buscaNotificacao( conexao, idNotificacao );
				if( notificacao.getDtVisualizacao() == null ) {
					notificacao.setDtVisualizacao( new QtData( Instant.now().toEpochMilli() ) );
					new NotificacaoNegocio( conexao, notificacao ).altera();
				}
				conexao.commit();
				return new JSONObject().put( "id", idNotificacao.toString() ).put( "lida", true );
			} catch ( Exception e ) {
				if( conexao.inTransaction() ) conexao.rollback();
				throw e;
			}
		}
	}

	private Evento evento( Conexao conexao, String tipo, UUID idProcesso, UUID idEtapa, UUID idVersao, UUID ator,
		String titulo, String resumo, String chave ) throws Exception {

		Evento evento = new Evento();
		evento.setIdEvento( UUID.randomUUID() );
		evento.setCdTipo( tipo );
		evento.setIdProcesso( idProcesso );
		evento.setIdProcessoEtapa( idEtapa );
		evento.setIdProtocoloVersao( idVersao );
		evento.setIdUsuarioAtor( ator );
		evento.setDtEvento( new QtData( Instant.now().toEpochMilli() ) );
		evento.setDsTitulo( titulo );
		evento.setDsResumo( resumo );
		evento.setCdChaveEvento( chave );
		new EventoNegocio( conexao, evento ).insere();
		return evento;
	}

	private void entregar( Conexao conexao, UUID idEvento, UUID usuario, String natureza ) throws Exception {

		Notificacao notificacao = new Notificacao();
		notificacao.setIdNotificacao( UUID.randomUUID() );
		notificacao.setIdEvento( idEvento );
		notificacao.setIdUsuarioDestino( usuario );
		notificacao.setTpNatureza( natureza );
		notificacao.setTpSituacao( "A".equals( natureza ) ? "P" : "I" );
		notificacao.setDtEntrega( new QtData( Instant.now().toEpochMilli() ) );
		new NotificacaoNegocio( conexao, notificacao ).insere();
	}

	private Object instante( ResultSet linhas, String campo ) throws Exception {

		return linhas.getTimestamp( campo ) == null ? JSONObject.NULL : linhas.getTimestamp( campo ).toInstant().toString();
	}

	private String nomeUsuario( Conexao conexao, UUID idUsuario ) throws Exception {

		try ( PreparedStatement consulta = conexao.getConnection().prepareStatement(
			"select DS_NOME from Cadastro.USUARIOS_SISTEMA where ID_USUARIO_SISTEMA = ?" ) ) {
			consulta.setObject( 1, idUsuario );
			try ( ResultSet linha = consulta.executeQuery() ) { return linha.next() ? linha.getString( 1 ) : "outro participante"; }
		}
	}
}
