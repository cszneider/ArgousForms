package br.com.argousForms.organizacao;

import java.sql.PreparedStatement;
import java.sql.SQLException;

import br.com.argousForms.model.negocio.cadastro.TagNegocio;
import br.com.argousForms.model.persistencia.cadastro.Tag;
import quatro.negocio.ErroDeNegocio;
import quatro.sql.Conexao;
import quatro.sql.QtSQLException;
import quatro.util.QtData;

final class TagNegocioSeguro extends TagNegocio {

	TagNegocioSeguro( Conexao conexao, Tag tag ) throws QtSQLException {
		super( conexao, tag );
	}

	@Override
	public void altera() throws QtSQLException, ErroDeNegocio {

		if( !antesDeAlterar() ) throw new ErroDeNegocio( getMsgErro() );
		Tag tag = (Tag) getTabelaBasica();
		String sql = "update Cadastro.TAGS set DS_TAG = ?, SN_GRUPO = ?, SN_USUARIO = ?, SN_VINCULO = ?, SN_ATIVA = ?, DT_ALTERACAO = ? where CD_TAG = ?";
		try ( PreparedStatement comando = getConexao().getConnection().prepareStatement( sql ) ) {
			comando.setString( 1, tag.getDsTag() );
			comando.setBoolean( 2, tag.isSnGrupo() );
			comando.setBoolean( 3, tag.isSnUsuario() );
			comando.setBoolean( 4, tag.isSnVinculo() );
			comando.setBoolean( 5, tag.isSnAtiva() );
			comando.setTimestamp( 6, QtData.getQtDataAsTimestamp( tag.getDtAlteracao() ) );
			comando.setString( 7, tag.getCdTag() );
			if( comando.executeUpdate() != 1 ) throw new QtSQLException( "Não foi possível alterar a tag." );
		} catch ( SQLException e ) {
			throw new QtSQLException( e );
		}
		if( !aposAlterar( getConexao() ) ) throw new ErroDeNegocio( getMsgErro() );
	}

	@Override
	public void exclui() throws QtSQLException, ErroDeNegocio {

		if( !antesDeExcluir() ) throw new ErroDeNegocio( getMsgErro() );
		Tag tag = (Tag) getTabelaBasica();
		try ( PreparedStatement comando = getConexao().getConnection().prepareStatement( "delete from Cadastro.TAGS where CD_TAG = ?" ) ) {
			comando.setString( 1, tag.getCdTag() );
			if( comando.executeUpdate() != 1 ) throw new QtSQLException( "Não foi possível excluir a tag." );
		} catch ( SQLException e ) {
			throw new QtSQLException( e );
		}
		if( !aposExcluir( getConexao() ) ) throw new ErroDeNegocio( getMsgErro() );
	}
}
