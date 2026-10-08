package br.com.argousForms.model.negocio.cadastro;

import br.com.argousForms.model.persistencia.cadastro.ConfirmacaoEmail;
import quatro.negocio.ErroDeNegocio;
import quatro.negocio.NegocioEspecificoImpl;
import quatro.persistencia.TabelaBasica;
import quatro.sql.Conexao;
import quatro.sql.QtSQLException;

public class ConfirmacaoEmailNegocioEspecifico extends NegocioEspecificoImpl {

	public static final String HASH_AGUARDANDO = "AGUARDANDO";

	@Override
	public void antesDeInserir( Conexao cnx, TabelaBasica registro ) throws QtSQLException, ErroDeNegocio {

		ConfirmacaoEmail confirmacao = (ConfirmacaoEmail) registro;
		if( !HASH_AGUARDANDO.equals( confirmacao.getCdHashToken() ) ) checaRegrasDeNegocio( confirmacao );
	}

	@Override
	public void antesDeAlterar( Conexao cnx, TabelaBasica registro ) throws QtSQLException, ErroDeNegocio {

		checaRegrasDeNegocio( (ConfirmacaoEmail) registro );
	}

	private void checaRegrasDeNegocio( ConfirmacaoEmail confEmail ) throws ErroDeNegocio {

		if( confEmail.getCdHashToken() == null || !confEmail.getCdHashToken().matches( "[0-9a-fA-F]{64}" ) ) {
			throw new ErroDeNegocio( "O hash de confirmação deve conter 64 caracteres hexadecimais.", "CD_HASH_TOKEN" );
		}
	}
}
