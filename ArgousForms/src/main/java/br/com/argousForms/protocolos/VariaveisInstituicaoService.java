package br.com.argousForms.protocolos;

import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.time.Instant;

import org.json.JSONArray;
import org.json.JSONObject;

import br.com.argousForms.api.ArgousFormsApiException;
import br.com.argousForms.auth.AutenticacaoLocalService;
import br.com.argousForms.model.negocio.cadastro.VariavelInstituicaoNegocio;
import br.com.argousForms.model.persistencia.cadastro.VariavelInstituicao;
import br.com.argousForms.model.persistencia.cadastro.VariavelInstituicaoLocalizador;
import quatro.sql.Conexao;
import quatro.sql.PoolDeConexoes;
import quatro.sql.Query;
import quatro.util.QtData;

public final class VariaveisInstituicaoService {

	public JSONObject listar( AutenticacaoLocalService.Usuario usuario ) throws Exception {

		if( !usuario.papeis().contains( "MODELADOR" ) && !usuario.papeis().contains( "CRIADOR_DE_PROTOCOLOS" ) ) {
			throw new ArgousFormsApiException( 403, "SEM_PERMISSAO", "Seu usuário não pode consultar variáveis da instituição." );
		}
		JSONArray variaveis = new JSONArray();
		try ( Conexao conexao = PoolDeConexoes.getConexao(); Query query = new Query( conexao ) ) {
			query.setSQL( "select ID_ATRIBUTO, ID_ATRIBUTO_PAI, CD_NOME_TECNICO, TP_ATRIBUTO, VL_ATRIBUTO, DT_INVALIDACAO " +
				"from Cadastro.VARIAVEIS_INSTITUICAO order by ID_ATRIBUTO_PAI nulls first, CD_NOME_TECNICO" );
			query.executeQuery();
			if( !query.isEmpty() ) do {
				variaveis.put( new JSONObject()
					.put( "idAtributo", query.getInt( "ID_ATRIBUTO" ) )
					.put( "idAtributoPai", query.getString( "ID_ATRIBUTO_PAI" ) == null ? JSONObject.NULL : query.getInt( "ID_ATRIBUTO_PAI" ) )
					.put( "codigo", query.getString( "CD_NOME_TECNICO" ) )
					.put( "tipo", query.getString( "TP_ATRIBUTO" ) )
					.put( "valor", query.getString( "VL_ATRIBUTO" ) == null ? JSONObject.NULL : query.getString( "VL_ATRIBUTO" ) )
					.put( "ativo", query.getString( "DT_INVALIDACAO" ) == null ) );
			} while ( query.next() );
		}
		return new JSONObject().put( "variaveis", variaveis );
	}

	public JSONObject salvar( AutenticacaoLocalService.Usuario usuario, Integer id, Integer idPai, String codigoInformado,
		String tipoInformado, String valorInformado ) throws Exception {

		exigirModelador( usuario );
		String codigo = codigoInformado == null ? "" : codigoInformado.strip();
		String tipo = tipoInformado == null ? "" : tipoInformado.strip();
		String valor = valorInformado == null ? "" : valorInformado.strip();
		if( codigo.isEmpty() || codigo.length() > 21 ) throw new ArgousFormsApiException( 400, "CODIGO_INVALIDO", "Informe um nome técnico de até 21 caracteres." );
		if( !"G".equals( tipo ) && !"V".equals( tipo ) ) throw new ArgousFormsApiException( 400, "TIPO_INVALIDO", "Escolha Grupo ou Valor." );
		if( "G".equals( tipo ) && !valor.isEmpty() ) throw new ArgousFormsApiException( 400, "VALOR_INVALIDO", "Um grupo não pode possuir valor." );
		if( "V".equals( tipo ) && ( valor.isEmpty() || valor.length() > 255 ) ) {
			throw new ArgousFormsApiException( 400, "VALOR_INVALIDO", "Informe um valor de até 255 caracteres." );
		}

		try ( Conexao conexao = PoolDeConexoes.getConexao() ) {
			conexao.beginTransaction();
			try {
				QtData agora = new QtData( Instant.now().toEpochMilli() );
				VariavelInstituicao variavel = id == null ? new VariavelInstituicao() : carregar( conexao, id );
				if( idPai != null ) {
					VariavelInstituicao pai = carregar( conexao, idPai );
					if( !"G".equals( pai.getTpAtributo() ) || pai.getDtInvalidacao() != null ) {
						throw new ArgousFormsApiException( 400, "GRUPO_INVALIDO", "Escolha um grupo ativo como destino." );
					}
					if( idPai.equals( id ) ) throw new ArgousFormsApiException( 400, "CICLO_INVALIDO", "Um grupo não pode ser seu próprio pai." );
				}
				if( id != null && ( !igual( variavel.getIdAtributoPai(), idPai ) || !variavel.getTpAtributo().equals( tipo ) ) ) {
					throw new ArgousFormsApiException( 400, "ESTRUTURA_IMUTAVEL", "O grupo pai e o tipo não podem ser alterados." );
				}
				if( variavel.getDtInvalidacao() != null ) throw new ArgousFormsApiException( 400, "VARIAVEL_INATIVA", "Reative a variável antes de editá-la." );
				String sql = "select ID_ATRIBUTO from Cadastro.VARIAVEIS_INSTITUICAO where ID_ATRIBUTO_PAI is not distinct from ? " +
					"and lower(CD_NOME_TECNICO) = lower(?) and ID_ATRIBUTO <> ?";
				try ( PreparedStatement consulta = conexao.getConnection().prepareStatement( sql ) ) {
					consulta.setObject( 1, idPai );
					consulta.setString( 2, codigo );
					consulta.setInt( 3, id == null ? -1 : id );
					try ( ResultSet resultado = consulta.executeQuery() ) {
						if( resultado.next() ) throw new ArgousFormsApiException( 409, "CODIGO_EXISTENTE", "Já existe uma variável com esse nome no mesmo grupo." );
					}
				}
				variavel.setIdAtributoPai( idPai );
				variavel.setCdNomeTecnico( codigo );
				variavel.setTpAtributo( tipo );
				variavel.setVlAtributo( "V".equals( tipo ) ? valor : null );
				variavel.setDtAlteracao( agora );
				if( id == null ) {
					variavel.setDtInclusao( agora );
					new VariavelInstituicaoNegocio( conexao, variavel ).insere();
				} else new VariavelInstituicaoNegocio( conexao, variavel ).altera();
				conexao.commit();
				return new JSONObject().put( "idAtributo", variavel.getIdAtributo() );
			} catch ( Exception e ) {
				if( conexao.inTransaction() ) conexao.rollback();
				throw e;
			}
		}
	}

	public JSONObject definirAtiva( AutenticacaoLocalService.Usuario usuario, int id, boolean ativa ) throws Exception {

		exigirModelador( usuario );
		try ( Conexao conexao = PoolDeConexoes.getConexao() ) {
			conexao.beginTransaction();
			try {
				VariavelInstituicao variavel = carregar( conexao, id );
				if( !ativa ) {
					try ( Query query = new Query( conexao ) ) {
						query.setSQL( "select ID_ATRIBUTO from Cadastro.VARIAVEIS_INSTITUICAO where ID_ATRIBUTO_PAI = :id and DT_INVALIDACAO is null" );
						query.setParameter( "id", id );
						query.executeQuery();
						if( !query.isEmpty() ) throw new ArgousFormsApiException( 409, "GRUPO_EM_USO", "Inative primeiro as variáveis contidas neste grupo." );
					}
				} else if( variavel.getIdAtributoPai() != null && carregar( conexao, variavel.getIdAtributoPai() ).getDtInvalidacao() != null ) {
					throw new ArgousFormsApiException( 409, "GRUPO_INATIVO", "Reative primeiro o grupo pai." );
				}
				variavel.setDtInvalidacao( ativa ? null : new QtData( Instant.now().toEpochMilli() ) );
				variavel.setDtAlteracao( new QtData( Instant.now().toEpochMilli() ) );
				new VariavelInstituicaoNegocio( conexao, variavel ).altera();
				conexao.commit();
				return new JSONObject().put( "idAtributo", id ).put( "ativo", ativa );
			} catch ( Exception e ) {
				if( conexao.inTransaction() ) conexao.rollback();
				throw e;
			}
		}
	}

	private VariavelInstituicao carregar( Conexao conexao, int id ) throws Exception {

		VariavelInstituicao variavel = VariavelInstituicaoLocalizador.buscaVariavelInstituicao( conexao, id );
		if( variavel == null ) throw new ArgousFormsApiException( 404, "VARIAVEL_NAO_ENCONTRADA", "Variável da instituição não encontrada." );
		return variavel;
	}

	private void exigirModelador( AutenticacaoLocalService.Usuario usuario ) throws ArgousFormsApiException {

		if( !usuario.papeis().contains( "MODELADOR" ) ) {
			throw new ArgousFormsApiException( 403, "SEM_PERMISSAO", "O papel MODELADOR é necessário para administrar variáveis da instituição." );
		}
	}

	private boolean igual( Object primeiro, Object segundo ) { return primeiro == null ? segundo == null : primeiro.equals( segundo ); }
}
