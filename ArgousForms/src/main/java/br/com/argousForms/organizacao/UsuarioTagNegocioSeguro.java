package br.com.argousForms.organizacao;

import java.sql.PreparedStatement;
import java.sql.SQLException;

import br.com.argousForms.model.negocio.cadastro.UsuarioTagNegocio;
import br.com.argousForms.model.persistencia.cadastro.UsuarioTag;
import quatro.negocio.ErroDeNegocio;
import quatro.sql.Conexao;
import quatro.sql.QtSQLException;
import quatro.util.QtData;

final class UsuarioTagNegocioSeguro extends UsuarioTagNegocio {

	UsuarioTagNegocioSeguro( Conexao conexao, UsuarioTag vinculo ) throws QtSQLException {
		super( conexao, vinculo );
	}

	@Override
	public void altera() throws QtSQLException, ErroDeNegocio {

		if( !antesDeAlterar() ) throw new ErroDeNegocio( getMsgErro() );
		UsuarioTag vinculo = (UsuarioTag) getTabelaBasica();
		String sql = "update Cadastro.USUARIO_TAGS set SN_ATIVA = ?, DT_ALTERACAO = ? where ID_USUARIO_SISTEMA = ? and CD_TAG = ?";
		try ( PreparedStatement comando = getConexao().getConnection().prepareStatement( sql ) ) {
			comando.setBoolean( 1, vinculo.isSnAtiva() );
			comando.setTimestamp( 2, QtData.getQtDataAsTimestamp( vinculo.getDtAlteracao() ) );
			comando.setObject( 3, vinculo.getIdUsuarioSistema() );
			comando.setString( 4, vinculo.getCdTag() );
			if( comando.executeUpdate() != 1 ) throw new QtSQLException( "Não foi possível alterar a tag do usuário." );
		} catch ( SQLException e ) {
			throw new QtSQLException( e );
		}
		if( !aposAlterar( getConexao() ) ) throw new ErroDeNegocio( getMsgErro() );
	}

	@Override
	public void exclui() throws QtSQLException, ErroDeNegocio {

		if( !antesDeExcluir() ) throw new ErroDeNegocio( getMsgErro() );
		UsuarioTag vinculo = (UsuarioTag) getTabelaBasica();
		try ( PreparedStatement comando = getConexao().getConnection().prepareStatement( "delete from Cadastro.USUARIO_TAGS where ID_USUARIO_SISTEMA = ? and CD_TAG = ?" ) ) {
			comando.setObject( 1, vinculo.getIdUsuarioSistema() );
			comando.setString( 2, vinculo.getCdTag() );
			if( comando.executeUpdate() != 1 ) throw new QtSQLException( "Não foi possível excluir a tag do usuário." );
		} catch ( SQLException e ) {
			throw new QtSQLException( e );
		}
		if( !aposExcluir( getConexao() ) ) throw new ErroDeNegocio( getMsgErro() );
	}
}
