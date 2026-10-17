package br.com.argousForms.security;

public final class PoliticaSenhaVerificacao {

	public static void main( String[] args ) {

		aceita( "Abcdefg1" );
		aceita( "abcdef1!" );
		aceita( "ABCDEFG1!" );
		aceita( "Ábcdefg1" );
		rejeita( "Ab1!" );
		rejeita( "abcdefgh" );
		rejeita( "Abcdefg " );
		rejeita( "A".repeat( 1025 ) + "a1!" );
	}

	private static void aceita( String senha ) {

		if( !PoliticaSenha.atende( senha ) ) throw new AssertionError( "Senha válida foi rejeitada." );
	}

	private static void rejeita( String senha ) {

		if( PoliticaSenha.atende( senha ) ) throw new AssertionError( "Senha inválida foi aceita." );
	}
}
