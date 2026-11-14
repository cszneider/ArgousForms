package br.com.argousForms.integracao;

import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.Timestamp;

import org.json.JSONArray;
import org.json.JSONObject;

import br.com.argousForms.api.ArgousFormsApiException;
import br.com.argousForms.auth.AutenticacaoLocalService;
import quatro.sql.Conexao;
import quatro.sql.PoolDeConexoes;

/** Consulta metadados das chaves. O valor secreto nunca é devolvido por esta operação. */
public final class ChavesWebhookService {

	public JSONObject listar( AutenticacaoLocalService.Usuario usuario ) throws Exception {

		if( !usuario.papeis().contains( "DESENVOLVEDOR" ) && !usuario.papeis().contains( "ADMINISTRADOR_INSTITUICAO" ) ) {
			throw new ArgousFormsApiException( 403, "ACESSO_NEGADO", "A gestão das chaves exige DESENVOLVEDOR ou ADMINISTRADOR_INSTITUICAO." );
		}

		String sql = "select ID_WEBHOOK, DS_TITULO, DT_INCLUSAO, DT_ATIVACAO, DT_VENCIMENTO, DT_INVALIDACAO "
			+ "from Cadastro.CHAVES_WEBHOOK order by DT_INCLUSAO desc";
		JSONArray itens = new JSONArray();
		try ( Conexao conexao = PoolDeConexoes.getConexao(); PreparedStatement consulta = conexao.getConnection().prepareStatement( sql ); ResultSet linhas = consulta.executeQuery() ) {
			while( linhas.next() ) {
				itens.put( new JSONObject().put( "id", linhas.getString( 1 ) ).put( "titulo", linhas.getString( 2 ) )
					.put( "inclusao", instante( linhas.getTimestamp( 3 ) ) ).put( "ativacao", instante( linhas.getTimestamp( 4 ) ) )
					.put( "vencimento", instante( linhas.getTimestamp( 5 ) ) ).put( "invalidacao", instante( linhas.getTimestamp( 6 ) ) ) );
			}
		}
		return new JSONObject().put( "itens", itens );
	}

	private String instante( Timestamp valor ) { return valor == null ? null : valor.toInstant().toString(); }
}
