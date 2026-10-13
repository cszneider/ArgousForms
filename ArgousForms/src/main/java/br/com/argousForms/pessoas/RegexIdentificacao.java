package br.com.argousForms.pessoas;

import java.util.regex.Pattern;

/** Expressões de formato que têm a mesma interpretação em Java e JavaScript. */
public final class RegexIdentificacao {

	private static final int TAMANHO_MAXIMO = 50;
	private static final int REPETICOES_MAXIMAS = 70;
	private static final int PROFUNDIDADE_MAXIMA = 8;

	private RegexIdentificacao() {}

	public static boolean ehCompativel( String expressao ) {

		if( expressao == null || expressao.length() == 0 || expressao.length() > TAMANHO_MAXIMO ) return false;

		String corpo = expressao;
		if( expressao.startsWith( "^" ) || expressao.endsWith( "$" ) ) {
			if( !expressao.startsWith( "^" ) || !expressao.endsWith( "$" ) ) return false;
			corpo = expressao.substring( 1, expressao.length() - 1 );
		}

		if( corpo.isEmpty() ) return false;

		try {
			new Analisador( corpo ).analisar();
			return !Pattern.compile( corpo ).matcher( "" ).matches();
		} catch ( IllegalArgumentException e ) {
			return false;
		}
	}

	public static boolean corresponde( String expressao, String identificacao ) {

		if( identificacao == null || identificacao.isEmpty() || !ehCompativel( expressao ) ) return false;
		String corpo = expressao.startsWith( "^" ) ? expressao.substring( 1, expressao.length() - 1 ) : expressao;
		return Pattern.compile( corpo ).matcher( identificacao ).matches();
	}

	private static final class Analisador {

		private final String texto;
		private int posicao;

		private Analisador( String texto ) {
			this.texto = texto;
		}

		private void analisar() {

			alternativas( 0 );
			if( posicao != texto.length() ) rejeitar();
		}

		private void alternativas( int profundidade ) {

			sequencia( profundidade );
			while( atual() == '|' ) {
				posicao++;
				sequencia( profundidade );
			}
		}

		private void sequencia( int profundidade ) {

			int inicio = posicao;
			while( posicao < texto.length() && atual() != ')' && atual() != '|' ) {
				boolean grupo = atomo( profundidade );
				if( grupo && (atual() == '?' || atual() == '{') ) rejeitar();
				if( !grupo ) quantificador();
			}
			if( posicao == inicio ) rejeitar();
		}

		private boolean atomo( int profundidade ) {

			char caractere = atual();
			if( asciiAlfanumerico( caractere ) ) {
				posicao++;
				return false;
			}
			if( caractere == '[' ) {
				classe();
				return false;
			}
			if( caractere != '(' || profundidade >= PROFUNDIDADE_MAXIMA ) rejeitar();

			posicao++;
			if( atual() == '?' ) {
				posicao++;
				if( atual() != ':' ) rejeitar();
				posicao++;
			}
			alternativas( profundidade + 1 );
			if( atual() != ')' ) rejeitar();
			posicao++;
			return true;
		}

		private void classe() {

			posicao++;
			int elementos = 0;
			while( atual() != ']' ) {
				char inicio = atual();
				if( !asciiAlfanumerico( inicio ) ) rejeitar();
				posicao++;
				if( atual() == '-' ) {
					posicao++;
					char fim = atual();
					if( !mesmaFaixa( inicio, fim ) || fim < inicio ) rejeitar();
					posicao++;
				}
				elementos++;
			}
			if( elementos == 0 ) rejeitar();
			posicao++;
		}

		private void quantificador() {

			if( atual() == '?' ) {
				posicao++;
				return;
			}
			if( atual() != '{' ) return;

			posicao++;
			int minimo = numero();
			int maximo = minimo;
			if( atual() == ',' ) {
				posicao++;
				maximo = numero();
			}
			if( atual() != '}' || minimo > maximo || maximo > REPETICOES_MAXIMAS ) rejeitar();
			posicao++;
		}

		private int numero() {

			int inicio = posicao;
			int valor = 0;
			while( atual() >= '0' && atual() <= '9' ) {
				valor = valor * 10 + atual() - '0';
				if( valor > REPETICOES_MAXIMAS ) rejeitar();
				posicao++;
			}
			if( inicio == posicao ) rejeitar();
			return valor;
		}

		private char atual() {
			return posicao < texto.length() ? texto.charAt( posicao ) : '\0';
		}

		private static boolean asciiAlfanumerico( char valor ) {
			return valor >= '0' && valor <= '9' || valor >= 'A' && valor <= 'Z' || valor >= 'a' && valor <= 'z';
		}

		private static boolean mesmaFaixa( char inicio, char fim ) {
			return inicio >= '0' && inicio <= '9' && fim >= '0' && fim <= '9'
					|| inicio >= 'A' && inicio <= 'Z' && fim >= 'A' && fim <= 'Z'
					|| inicio >= 'a' && inicio <= 'z' && fim >= 'a' && fim <= 'z';
		}

		private static void rejeitar() {
			throw new IllegalArgumentException( "Expressão fora da sintaxe permitida." );
		}
	}
}
