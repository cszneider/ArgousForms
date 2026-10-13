package br.com.argousForms.model.negocio.cadastro;

import java.util.Objects;

import br.com.argousForms.model.persistencia.cadastro.TipoIdentificacao;
import br.com.argousForms.pessoas.RegexIdentificacao;
import quatro.negocio.ErroDeNegocio;
import quatro.negocio.NegocioEspecificoImpl;
import quatro.persistencia.TabelaBasica;
import quatro.sql.Conexao;
import quatro.sql.QtSQLException;
import quatro.sql.Query;

public class TipoIdentificacaoNegocioEspecifico extends NegocioEspecificoImpl {

	@Override
	public void antesDeInserir( Conexao cnx, TabelaBasica registro ) throws QtSQLException, ErroDeNegocio {
		checaRegrasDeNegocio( (TipoIdentificacao) registro );
	}

	@Override
	public void antesDeAlterar( Conexao cnx, TabelaBasica registro ) throws QtSQLException, ErroDeNegocio {

		TipoIdentificacao tipo = (TipoIdentificacao) registro;
		checaRegrasDeNegocio( tipo );
		checaIdentificacoesExistentes( cnx, tipo );
	}

	private void checaRegrasDeNegocio( TipoIdentificacao tipo ) throws ErroDeNegocio {

		if( !RegexIdentificacao.ehCompativel( tipo.getCdRegex() ) ) {
			throw new ErroDeNegocio( "A expressão de identificação deve usar somente a sintaxe compatível com Java e JavaScript e não pode aceitar valor vazio.", "CD_REGEX" );
		}
	}

	private void checaIdentificacoesExistentes( Conexao cnx, TipoIdentificacao tipo ) throws QtSQLException, ErroDeNegocio {

		if( tipo.getIdTipoIdentificacao() == null ) return;

		try ( Query query = new Query( cnx ) ) {
			query.setSQL( "select CD_REGEX from Cadastro.TIPOS_IDENTIFICACAO where ID_TIPO_IDENTIFICACAO = :idTipo" );
			query.setParameter( "idTipo", tipo.getIdTipoIdentificacao() );
			query.executeQuery();
			if( query.isEmpty() || Objects.equals( query.getString( "CD_REGEX" ), tipo.getCdRegex() ) ) return;
		}

		try ( Query query = new Query( cnx ) ) {
			query.setSQL( "select CD_IDENTIFICACAO from Cadastro.PESSOA_IDENTIFICACOES where ID_TIPO_IDENTIFICACAO = :idTipo" );
			query.setParameter( "idTipo", tipo.getIdTipoIdentificacao() );
			query.executeQuery();
			if( query.isEmpty() ) return;

			do {
				if( !RegexIdentificacao.corresponde( tipo.getCdRegex(), query.getString( "CD_IDENTIFICACAO" ) ) ) {
					throw new ErroDeNegocio( "A nova expressão não aceita todas as identificações já cadastradas para este tipo.", "CD_REGEX" );
				}
			} while ( query.next() );
		}
	}
}
