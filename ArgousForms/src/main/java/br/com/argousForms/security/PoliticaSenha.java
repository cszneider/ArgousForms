package br.com.argousForms.security;

import java.util.regex.Pattern;

public final class PoliticaSenha {

	private static final Pattern MAIUSCULA = Pattern.compile( "\\p{Lu}" );
	private static final Pattern MINUSCULA = Pattern.compile( "\\p{Ll}" );
	private static final Pattern NUMERAL = Pattern.compile( "\\p{Nd}" );
	private static final Pattern SIMBOLO = Pattern.compile( "[\\p{P}\\p{S}]" );

	private PoliticaSenha() {}

	public static boolean atende( String senha ) {

		if( senha == null || senha.length() < 8 || senha.length() > 1024 ) return false;

		int categorias = 0;
		if( MAIUSCULA.matcher( senha ).find() ) categorias++;
		if( MINUSCULA.matcher( senha ).find() ) categorias++;
		if( NUMERAL.matcher( senha ).find() ) categorias++;
		if( SIMBOLO.matcher( senha ).find() ) categorias++;
		return categorias >= 3;
	}
}
