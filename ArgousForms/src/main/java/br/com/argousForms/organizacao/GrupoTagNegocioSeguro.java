package br.com.argousForms.organizacao;

import java.sql.PreparedStatement;
import java.sql.SQLException;

import br.com.argousForms.model.negocio.cadastro.GrupoTagNegocio;
import br.com.argousForms.model.persistencia.cadastro.GrupoTag;
import quatro.negocio.ErroDeNegocio;
import quatro.sql.Conexao;
import quatro.sql.QtSQLException;
import quatro.util.QtData;

/**
 * Atualiza o vínculo por igualdade exata. O persistor gerado usa LIKE para CD_TAG.
 */
final class GrupoTagNegocioSeguro extends GrupoTagNegocio {

	GrupoTagNegocioSeguro( Conexao conexao, GrupoTag vinculo ) throws QtSQLException {
		super( conexao, vinculo );
	}

	@Override
	public void altera() throws QtSQLException, ErroDeNegocio {

		if( !antesDeAlterar() ) throw new ErroDeNegocio( getMsgErro() );
		GrupoTag vinculo = (GrupoTag) getTabelaBasica();
		String sql = "update Cadastro.GRUPO_TAGS set SN_ATIVA = ?, DT_ALTERACAO = ? where ID_GRUPO = ? and CD_TAG = ?";
		try ( PreparedStatement comando = getConexao().getConnection().prepareStatement( sql ) ) {
			comando.setBoolean( 1, vinculo.isSnAtiva() );
			comando.setTimestamp( 2, QtData.getQtDataAsTimestamp( vinculo.getDtAlteracao() ) );
			comando.setInt( 3, vinculo.getIdGrupo() );
			comando.setString( 4, vinculo.getCdTag() );
			if( comando.executeUpdate() != 1 ) throw new QtSQLException( "Não foi possível alterar o vínculo da tag com o grupo." );
		} catch ( SQLException e ) {
			throw new QtSQLException( e );
		}
		if( !aposAlterar( getConexao() ) ) throw new ErroDeNegocio( getMsgErro() );
	}
}
