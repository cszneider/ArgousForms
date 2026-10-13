package br.com.argousForms.pessoas;

import java.util.HashMap;
import java.util.Map;

import org.json.JSONArray;
import org.json.JSONObject;

import quatro.sql.Conexao;
import quatro.sql.PoolDeConexoes;
import quatro.sql.Query;

public final class PessoasUsuariosService {

	public JSONObject listar() throws Exception {

		JSONArray pessoas = new JSONArray();
		JSONArray usuarios = new JSONArray();
		Map<String, JSONObject> usuariosPorId = new HashMap<>();
		try ( Conexao conexao = PoolDeConexoes.getConexao() ) {
			try ( Query query = new Query( conexao ) ) {
				query.setSQL( "select p.ID_PESSOA, p.DS_NOME_PESSOA, p.DS_NOME_SOCIAL, p.DS_END_EMAIL, p.DS_TELEFONE "
					+ "from Cadastro.PESSOAS p where p.DT_EXCLUSAO is null "
					+ "and not exists (select 1 from Cadastro.USUARIOS_SISTEMA u where u.ID_PESSOA = p.ID_PESSOA and u.DT_EXCLUSAO is null) "
					+ "order by p.DS_NOME_PESSOA, p.ID_PESSOA" );
				query.executeQuery();
				if( !query.isEmpty() ) {
					do {
						JSONObject pessoa = new JSONObject();
						pessoa.put( "idPessoa", query.getString( "ID_PESSOA" ) );
						pessoa.put( "nome", query.getString( "DS_NOME_PESSOA" ) );
						pessoa.put( "nomeSocial", query.getString( "DS_NOME_SOCIAL" ) );
						pessoa.put( "email", query.getString( "DS_END_EMAIL" ) );
						pessoa.put( "telefone", query.getString( "DS_TELEFONE" ) );
						pessoas.put( pessoa );
					} while ( query.next() );
				}
			}
			try ( Query query = new Query( conexao ) ) {
				query.setSQL( "select ID_USUARIO_SISTEMA, ID_PESSOA, DS_NOME, DS_EMAIL from Cadastro.USUARIOS_SISTEMA "
					+ "where DT_EXCLUSAO is null order by DS_NOME, ID_USUARIO_SISTEMA" );
				query.executeQuery();
				if( !query.isEmpty() ) {
					do {
						JSONObject usuario = new JSONObject();
						String id = query.getString( "ID_USUARIO_SISTEMA" );
						usuario.put( "idUsuario", id );
						usuario.put( "idPessoa", query.getString( "ID_PESSOA" ) );
						usuario.put( "nome", query.getString( "DS_NOME" ) );
						usuario.put( "email", query.getString( "DS_EMAIL" ) );
						usuario.put( "perfis", new JSONArray() );
						usuarios.put( usuario );
						usuariosPorId.put( id, usuario );
					} while ( query.next() );
				}
			}
			try ( Query query = new Query( conexao ) ) {
				query.setSQL( "select up.ID_USUARIO_SISTEMA, p.CD_PERFIL from Cadastro.USUARIO_PERFIS up "
					+ "join Cadastro.PERFIS p on p.ID_PERFIL = up.ID_PERFIL "
					+ "where up.DT_REVOGACAO is null and (up.DT_INICIO_VIGENCIA is null or up.DT_INICIO_VIGENCIA <= CURRENT_TIMESTAMP) "
					+ "and (up.DT_FIM_VIGENCIA is null or up.DT_FIM_VIGENCIA > CURRENT_TIMESTAMP) "
					+ "and p.SN_ATIVO = true and p.DT_EXCLUSAO is null order by up.ID_USUARIO_SISTEMA, p.CD_PERFIL" );
				query.executeQuery();
				if( !query.isEmpty() ) {
					do {
						JSONObject usuario = usuariosPorId.get( query.getString( "ID_USUARIO_SISTEMA" ) );
						if( usuario != null ) usuario.getJSONArray( "perfis" ).put( query.getString( "CD_PERFIL" ) );
					} while ( query.next() );
				}
			}
		}
		return new JSONObject().put( "pessoas", pessoas ).put( "usuarios", usuarios );
	}
}
