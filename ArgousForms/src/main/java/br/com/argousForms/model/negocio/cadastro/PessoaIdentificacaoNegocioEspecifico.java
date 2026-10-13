package br.com.argousForms.model.negocio.cadastro;

import br.com.argousForms.model.persistencia.cadastro.PessoaIdentificacao;
import br.com.argousForms.pessoas.RegexIdentificacao;
import quatro.negocio.ErroDeNegocio;
import quatro.negocio.NegocioEspecificoImpl;
import quatro.persistencia.TabelaBasica;
import quatro.sql.Conexao;
import quatro.sql.QtSQLException;
import quatro.sql.Query;

public class PessoaIdentificacaoNegocioEspecifico extends NegocioEspecificoImpl {

	@Override
	public void antesDeInserir( Conexao cnx, TabelaBasica registro ) throws QtSQLException, ErroDeNegocio {
		checaRegrasDeNegocio( cnx, (PessoaIdentificacao) registro );
	}

	@Override
	public void antesDeAlterar( Conexao cnx, TabelaBasica registro ) throws QtSQLException, ErroDeNegocio {
		checaRegrasDeNegocio( cnx, (PessoaIdentificacao) registro );
	}

	private void checaRegrasDeNegocio( Conexao cnx, PessoaIdentificacao identificacao ) throws QtSQLException, ErroDeNegocio {

		if( identificacao.getIdTipoIdentificacao() == null ) return;
		if( identificacao.getCdIdentificacao() == null || identificacao.getCdIdentificacao().isEmpty() ) {
			throw new ErroDeNegocio( "Informe o número de identificação.", "CD_IDENTIFICACAO" );
		}

		try ( Query query = new Query( cnx ) ) {
			query.setSQL( "select CD_REGEX from Cadastro.TIPOS_IDENTIFICACAO where ID_TIPO_IDENTIFICACAO = :idTipo" );
			query.setParameter( "idTipo", identificacao.getIdTipoIdentificacao() );
			query.executeQuery();
			if( query.isEmpty() ) return;

			String expressao = query.getString( "CD_REGEX" );
			if( !RegexIdentificacao.corresponde( expressao, identificacao.getCdIdentificacao() ) ) {
				throw new ErroDeNegocio( "O número não corresponde ao formato do tipo de identificação.", "CD_IDENTIFICACAO" );
			}
		}
	}
}
