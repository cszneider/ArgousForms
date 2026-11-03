package br.com.argousForms.organizacao;

import java.sql.PreparedStatement;
import java.sql.SQLException;

import br.com.argousForms.model.negocio.cadastro.VinculoTagNegocio;
import br.com.argousForms.model.persistencia.cadastro.VinculoTag;
import quatro.negocio.ErroDeNegocio;
import quatro.sql.Conexao;
import quatro.sql.QtSQLException;
import quatro.util.QtData;

final class VinculoTagNegocioSeguro extends VinculoTagNegocio {

	VinculoTagNegocioSeguro( Conexao conexao, VinculoTag vinculo ) throws QtSQLException {
		super( conexao, vinculo );
	}

	@Override
	public void altera() throws QtSQLException, ErroDeNegocio {

		if( !antesDeAlterar() ) throw new ErroDeNegocio( getMsgErro() );
		VinculoTag vinculo = (VinculoTag) getTabelaBasica();
		String sql = "update Cadastro.VINCULO_TAGS set SN_ATIVO = ?, DT_ALTERACAO = ? where ID_USUARIO_SISTEMA = ? and ID_GRUPO = ? and CD_TAG = ?";
		try ( PreparedStatement comando = getConexao().getConnection().prepareStatement( sql ) ) {
			comando.setBoolean( 1, vinculo.isSnAtivo() );
			comando.setTimestamp( 2, QtData.getQtDataAsTimestamp( vinculo.getDtAlteracao() ) );
			comando.setObject( 3, vinculo.getIdUsuarioSistema() );
			comando.setInt( 4, vinculo.getIdGrupo() );
			comando.setString( 5, vinculo.getCdTag() );
			if( comando.executeUpdate() != 1 ) throw new QtSQLException( "Não foi possível alterar a tag do vínculo." );
		} catch ( SQLException e ) {
			throw new QtSQLException( e );
		}
		if( !aposAlterar( getConexao() ) ) throw new ErroDeNegocio( getMsgErro() );
	}

	@Override
	public void exclui() throws QtSQLException, ErroDeNegocio {

		if( !antesDeExcluir() ) throw new ErroDeNegocio( getMsgErro() );
		VinculoTag vinculo = (VinculoTag) getTabelaBasica();
		try ( PreparedStatement comando = getConexao().getConnection().prepareStatement( "delete from Cadastro.VINCULO_TAGS where ID_USUARIO_SISTEMA = ? and ID_GRUPO = ? and CD_TAG = ?" ) ) {
			comando.setObject( 1, vinculo.getIdUsuarioSistema() );
			comando.setInt( 2, vinculo.getIdGrupo() );
			comando.setString( 3, vinculo.getCdTag() );
			if( comando.executeUpdate() != 1 ) throw new QtSQLException( "Não foi possível excluir a tag do vínculo." );
		} catch ( SQLException e ) {
			throw new QtSQLException( e );
		}
		if( !aposExcluir( getConexao() ) ) throw new ErroDeNegocio( getMsgErro() );
	}
}
