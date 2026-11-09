package br.com.argousForms.processos;

import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.time.Instant;
import java.util.UUID;

import org.json.JSONArray;
import org.json.JSONObject;

import br.com.argousForms.api.ArgousFormsApiException;
import br.com.argousForms.auth.AutenticacaoLocalService;
import br.com.argousForms.model.negocio.processos.ProcessoForumNegocio;
import br.com.argousForms.model.persistencia.processos.ProcessoForum;
import quatro.sql.Conexao;
import quatro.sql.PoolDeConexoes;
import quatro.util.QtData;

/** Comentários e registros de ações do Processo. */
public final class ForumProcessoService {

	public static void registrar( Conexao conexao, UUID idProcesso, UUID idAutor, String tipo, String conteudo, JSONObject dados ) throws Exception {

		ProcessoForum registro = new ProcessoForum();
		registro.setIdMensagem( UUID.randomUUID() );
		registro.setIdProcesso( idProcesso );
		registro.setIdUsuarioAutor( idAutor );
		registro.setTpRegistro( tipo );
		registro.setTxConteudo( conteudo );
		registro.setJsDados( dados == null ? null : dados.toString() );
		registro.setDtInclusao( new QtData( Instant.now().toEpochMilli() ) );
		new ProcessoForumNegocio( conexao, registro ).insere();
	}

	public JSONObject comentar( AutenticacaoLocalService.Usuario usuario, UUID idProcesso, String conteudo ) throws Exception {

		String mensagem = conteudo == null ? "" : conteudo.trim();
		if( mensagem.isEmpty() || mensagem.length() > 10000 ) {
			throw new ArgousFormsApiException( 400, "COMENTARIO_INVALIDO", "Escreva um comentário de até 10.000 caracteres." );
		}
		try ( Conexao conexao = PoolDeConexoes.getConexao() ) {
			conexao.beginTransaction();
			try {
				if( !podeComentar( conexao, idProcesso, usuario.idUsuario() ) ) {
					throw new ArgousFormsApiException( 403, "ACESSO_NEGADO", "Você não pode comentar neste Processo." );
				}
				registrar( conexao, idProcesso, usuario.idUsuario(), "1", mensagem, null );
				conexao.commit();
				return new JSONObject().put( "idProcesso", idProcesso.toString() );
			} catch ( Exception e ) {
				if( conexao.inTransaction() ) conexao.rollback();
				throw e;
			}
		}
	}

	public boolean podeComentar( Conexao conexao, UUID idProcesso, UUID idUsuario ) throws Exception {

		String sql = "select 1 from Processos.PROCESSOS p where p.ID_PROCESSO = ? and "
			+ "(p.ID_USUARIO_INICIOU = ? or p.ID_USUARIO_GESTOR = ? "
			+ "or exists (select 1 from Processos.PROCESSO_ETAPA_RESPONSAVEIS r join Processos.PROCESSO_ETAPAS e on e.ID_PROCESSO_ETAPA = r.ID_PROCESSO_ETAPA where e.ID_PROCESSO = p.ID_PROCESSO and r.ID_USUARIO_SISTEMA = ?) "
			+ "or exists (select 1 from Processos.PROCESSO_CONVIDADOS c where c.ID_PROCESSO = p.ID_PROCESSO and c.ID_USUARIO_CONVIDADO = ? and c.TP_SITUACAO = 'A'))";
		try ( PreparedStatement consulta = conexao.getConnection().prepareStatement( sql ) ) {
			consulta.setObject( 1, idProcesso );
			for( int i = 2; i <= 5; i++ ) consulta.setObject( i, idUsuario );
			try ( ResultSet linha = consulta.executeQuery() ) { return linha.next(); }
		}
	}

	public JSONArray listar( Conexao conexao, UUID idProcesso ) throws Exception {

		JSONArray registros = new JSONArray();
		String sql = "select m.ID_MENSAGEM, m.ID_USUARIO_AUTOR, u.DS_NOME, m.TP_REGISTRO, m.TX_CONTEUDO, m.DT_INCLUSAO "
			+ "from Processos.PROCESSO_FORUM m left join Cadastro.USUARIOS_SISTEMA u on u.ID_USUARIO_SISTEMA = m.ID_USUARIO_AUTOR "
			+ "where m.ID_PROCESSO = ? order by m.DT_INCLUSAO, m.ID_MENSAGEM";
		try ( PreparedStatement consulta = conexao.getConnection().prepareStatement( sql ) ) {
			consulta.setObject( 1, idProcesso );
			try ( ResultSet linhas = consulta.executeQuery() ) {
				while( linhas.next() ) registros.put( new JSONObject()
					.put( "id", linhas.getString( "ID_MENSAGEM" ) ).put( "autor", linhas.getString( "DS_NOME" ) == null ? "Sistema" : linhas.getString( "DS_NOME" ) )
					.put( "idAutor", linhas.getString( "ID_USUARIO_AUTOR" ) == null ? JSONObject.NULL : linhas.getString( "ID_USUARIO_AUTOR" ) )
					.put( "tipo", linhas.getString( "TP_REGISTRO" ) ).put( "conteudo", linhas.getString( "TX_CONTEUDO" ) == null ? "" : linhas.getString( "TX_CONTEUDO" ) )
					.put( "data", linhas.getTimestamp( "DT_INCLUSAO" ).toInstant().toString() ) );
			}
		}
		return registros;
	}
}
