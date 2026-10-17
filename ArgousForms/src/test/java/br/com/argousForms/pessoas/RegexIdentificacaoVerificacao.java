package br.com.argousForms.pessoas;

public final class RegexIdentificacaoVerificacao {

	public static void main( String[] args ) {

		aceita( "^[0-9]{11}$" );
		aceita( "[A-Z]{2}[0-9]{6}[A-Z]?" );
		aceita( "(?:[0-9]{8}[A-Z]|[XYZ][0-9]{7}[A-Z])" );

		for( String expressao : new String[] { "(?<=A)B", "(A)\\1", "\\p{L}{3}", "(?i)abc", "[A-Z&&[^IO]]", "A++", "(?>AB)", "\\d{11}", "[A-Z]{1,}", "[A-Z]{71}", "[A-Z]{3,2}", "A|", "[A-z]", "^ABC", "ABC$", "", "A?" } ) {
			if( RegexIdentificacao.ehCompativel( expressao ) ) throw new AssertionError( "Aceitou expressão proibida: " + expressao );
		}
		if( RegexIdentificacao.ehCompativel( "A".repeat( 51 ) ) ) throw new AssertionError( "Aceitou expressão maior que a coluna." );

		confere( "(A|AB)", "AB", true );
		confere( "(A|AB)", "A", true );
		confere( "(A|AB)", "AB\n", false );
		confere( "^[0-9]{11}$", "12345678901", true );
		confere( "^[0-9]{11}$", "123.456.789-01", false );
	}

	private static void aceita( String expressao ) {
		if( !RegexIdentificacao.ehCompativel( expressao ) ) throw new AssertionError( "Rejeitou expressão válida: " + expressao );
	}

	private static void confere( String expressao, String valor, boolean esperado ) {
		if( RegexIdentificacao.corresponde( expressao, valor ) != esperado ) throw new AssertionError( "Resultado incorreto para: " + expressao + " / " + valor );
	}
}
