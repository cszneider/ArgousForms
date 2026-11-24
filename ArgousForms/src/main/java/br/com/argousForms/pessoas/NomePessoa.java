package br.com.argousForms.pessoas;

/** Fonte única do nome mostrado para pessoas e usuários. */
public final class NomePessoa {

	private NomePessoa() {}

	public static String exibir( String nomeSocial, String nome ) {

		return nomeSocial == null || nomeSocial.isBlank() ? nome : nomeSocial;
	}

	public static String sql( String alias ) {

		if( !alias.matches( "[A-Za-z][A-Za-z0-9_]*" ) ) throw new IllegalArgumentException( "Alias SQL inválido." );
		return "coalesce(nullif(btrim(" + alias + ".DS_NOME_SOCIAL), ''), " + alias + ".DS_NOME_PESSOA)";
	}
}
