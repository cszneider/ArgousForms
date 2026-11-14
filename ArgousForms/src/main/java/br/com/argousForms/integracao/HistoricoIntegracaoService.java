package br.com.argousForms.integracao;

import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.Timestamp;
import java.util.UUID;

import org.json.JSONArray;
import org.json.JSONObject;

import br.com.argousForms.api.ArgousFormsApiException;
import br.com.argousForms.auth.AutenticacaoLocalService;
import quatro.sql.Conexao;
import quatro.sql.PoolDeConexoes;

/** Consulta metadados das chamadas sem expor parâmetros, respostas ou segredos. */
public final class HistoricoIntegracaoService {

	public JSONObject listar( AutenticacaoLocalService.Usuario usuario, String codigo, UUID idRequisicao, int pagina ) throws Exception {

		exigirDesenvolvedor( usuario );
		if( pagina < 0 || pagina > 10000 ) throw new ArgousFormsApiException( 400, "PAGINA_INVALIDA", "Informe uma página válida." );
		String codigoFiltro = codigo == null ? "" : codigo.strip();
		if( codigoFiltro.length() > 100 ) throw new ArgousFormsApiException( 400, "CODIGO_INVALIDO", "O código da consulta é muito longo." );

		String sql = "select c.ID_REQUISICAO, c.DT_INICIO, c.DT_FIM, c.ID_USUARIO_ORIGEM, u.DS_NOME, "
			+ "c.ID_PROTOCOLO, c.ID_PROCESSO, c.TP_ORIGEM, c.CD_ACAO, c.CD_CONSULTA, "
			+ "c.TP_RESULTADO, c.ID_CACHE, c.CD_ERRO, c.DS_ERRO, "
			+ "(select count(*) from Cadastro.INTEGRACAO_TENTATIVAS t where t.ID_REQUISICAO = c.ID_REQUISICAO) NR_TENTATIVAS "
			+ "from Cadastro.INTEGRACAO_CONSULTAS c "
			+ "left join Cadastro.USUARIOS_SISTEMA u on u.ID_USUARIO_SISTEMA = c.ID_USUARIO_ORIGEM "
			+ "where (?::uuid is null or c.ID_REQUISICAO = ?) and (? = '' or c.CD_CONSULTA ilike ?) "
			+ "order by c.DT_INICIO desc, c.ID_REQUISICAO desc limit 51 offset ?";
		JSONArray itens = new JSONArray();
		boolean temMais = false;
		try ( Conexao conexao = PoolDeConexoes.getConexao(); PreparedStatement consulta = conexao.getConnection().prepareStatement( sql ) ) {
			consulta.setObject( 1, idRequisicao );
			consulta.setObject( 2, idRequisicao );
			consulta.setString( 3, codigoFiltro );
			consulta.setString( 4, "%" + codigoFiltro.replace( "\\", "\\\\" ).replace( "%", "\\%" ).replace( "_", "\\_" ) + "%" );
			consulta.setInt( 5, pagina * 50 );
			try ( ResultSet linhas = consulta.executeQuery() ) {
				while( linhas.next() ) {
					if( itens.length() == 50 ) { temMais = true; break; }
					JSONObject item = new JSONObject().put( "idRequisicao", linhas.getString( 1 ) )
						.put( "inicio", instante( linhas.getTimestamp( 2 ) ) ).put( "fim", instante( linhas.getTimestamp( 3 ) ) )
						.put( "idUsuario", linhas.getString( 4 ) ).put( "nomeUsuario", linhas.getString( 5 ) )
						.put( "idProtocolo", linhas.getString( 6 ) ).put( "idProcesso", linhas.getString( 7 ) )
						.put( "origem", linhas.getString( 8 ) ).put( "acao", linhas.getString( 9 ) )
						.put( "codigo", linhas.getString( 10 ) ).put( "resultado", linhas.getString( 11 ) )
						.put( "idCache", linhas.getString( 12 ) ).put( "codigoErro", linhas.getString( 13 ) )
						.put( "descricaoErro", linhas.getString( 14 ) ).put( "numeroTentativas", linhas.getInt( 15 ) );
						itens.put( item );
				}
			}
		}
		return new JSONObject().put( "itens", itens ).put( "pagina", pagina ).put( "temMais", temMais );
	}

	public JSONObject tentativas( AutenticacaoLocalService.Usuario usuario, UUID idRequisicao ) throws Exception {

		exigirDesenvolvedor( usuario );
		String sql = "select t.ID_TENTATIVA, t.ID_WEBHOOK, t.TP_DESTINO, t.DT_INICIO, t.DT_FIM, "
			+ "t.NR_STATUS_HTTP, t.TP_RESULTADO, t.CD_ERRO, t.DS_ERRO "
			+ "from Cadastro.INTEGRACAO_TENTATIVAS t where t.ID_REQUISICAO = ? order by t.DT_INICIO, t.ID_TENTATIVA";
		JSONArray itens = new JSONArray();
		try ( Conexao conexao = PoolDeConexoes.getConexao(); PreparedStatement consulta = conexao.getConnection().prepareStatement( sql ) ) {
			consulta.setObject( 1, idRequisicao );
			try ( ResultSet linhas = consulta.executeQuery() ) {
				while( linhas.next() ) {
					itens.put( new JSONObject().put( "idTentativa", linhas.getString( 1 ) )
						.put( "idChave", linhas.getString( 2 ) ).put( "destino", linhas.getString( 3 ) )
						.put( "inicio", instante( linhas.getTimestamp( 4 ) ) ).put( "fim", instante( linhas.getTimestamp( 5 ) ) )
						.put( "statusHttp", linhas.getObject( 6 ) ).put( "resultado", linhas.getString( 7 ) )
						.put( "codigoErro", linhas.getString( 8 ) ).put( "descricaoErro", linhas.getString( 9 ) ) );
				}
			}
		}
		return new JSONObject().put( "itens", itens );
	}

	private String instante( Timestamp valor ) { return valor == null ? null : valor.toInstant().toString(); }

	private void exigirDesenvolvedor( AutenticacaoLocalService.Usuario usuario ) throws ArgousFormsApiException {

		if( !usuario.papeis().contains( "DESENVOLVEDOR" ) ) throw new ArgousFormsApiException( 403, "ACESSO_NEGADO", "O papel DESENVOLVEDOR é necessário." );
	}
}
