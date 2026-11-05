package br.com.argousForms.protocolos;

import java.text.Normalizer;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.regex.Pattern;
import java.util.regex.PatternSyntaxException;

import org.json.JSONException;
import org.json.JSONObject;

import br.com.argousForms.api.ArgousFormsApiException;

/** Regras da definição de uma variável textual, compartilhadas por todos os seus formulários. */
public final class DefinicaoVariavelTexto {

	private static final String POSICOES = "aAdD09#*";

	private DefinicaoVariavelTexto() {}

	public static JSONObject validar( String tipo, JSONObject definicao ) throws ArgousFormsApiException, JSONException {

		JSONObject resultado = definicao == null ? new JSONObject() : definicao;
		if( resultado.has( "origem" ) ) {
			JSONObject origem = resultado.optJSONObject( "origem" );
			if( origem == null ) throw invalida( "A origem da variável deve ser um objeto." );
			String tipoOrigem = origem.optString( "tipo", "" );
			switch( tipoOrigem ) {
				case "MANUAL" -> { }
				case "SISTEMA" -> {
					String codigo = origem.optString( "codigo", "" );
					boolean conhecida = VariaveisSistema.definicoes().stream().anyMatch( item -> item.codigo().equals( codigo ) && item.tipoDado().equals( tipo ) );
					if( !conhecida ) throw invalida( "Escolha uma variável de sistema compatível com o tipo de dado." );
				}
				case "INSTITUICAO" -> {
					if( !"S".equals( tipo ) || !(origem.opt( "idAtributo" ) instanceof Integer id) || id <= 0 ) {
						throw invalida( "Escolha uma variável textual da instituição." );
					}
				}
				case "INTEGRACAO" -> {
					String codigo = origem.optString( "codigo", "" );
					if( !codigo.matches( "[A-Za-z][A-Za-z0-9_.-]{0,99}" ) ) {
						throw invalida( "Informe um código de integração de até 100 caracteres." );
					}
				}
				default -> throw invalida( "Escolha uma origem válida para a variável." );
			}
		}
		if( resultado.has( "scriptAoSairDoCampo" ) ) {
			Object script = resultado.opt( "scriptAoSairDoCampo" );
			if( !(script instanceof String texto) || texto.length() > 20000 || texto.indexOf( '\0' ) >= 0 ) {
				throw invalida( "O script ao sair do campo deve ter até 20000 caracteres e não pode conter caracteres nulos." );
			}
		}
		if( resultado.has( "valorExemplo" ) ) {
			Object exemplo = resultado.opt( "valorExemplo" );
			if( !(exemplo instanceof String valor) || valor.length() > 500 || valor.codePoints().anyMatch( DefinicaoVariavelTexto::caractereInvalido ) ) {
				throw invalida( "O valor exemplo deve ter até 500 caracteres e não pode conter quebras de linha ou caracteres de controle." );
			}
			resultado.put( "valorExemplo", Normalizer.normalize( valor, Normalizer.Form.NFC ) );
		}
		if( !resultado.has( "texto" ) ) return resultado;
		if( !"S".equals( tipo ) || !(resultado.opt( "texto" ) instanceof JSONObject texto) ) {
			throw invalida( "Regras de texto exigem uma variável do tipo Texto." );
		}

		int minimo = inteiro( texto, "tamanhoMinimo" );
		int maximo = inteiro( texto, "tamanhoMaximo" );
		if( maximo > 0 && minimo > maximo ) throw invalida( "O tamanho mínimo não pode superar o máximo." );
		boolean zeros = texto.optBoolean( "preencherZerosEsquerda", false );
		if( texto.has( "preencherZerosEsquerda" ) && !(texto.opt( "preencherZerosEsquerda" ) instanceof Boolean) ) {
			throw invalida( "A opção de preencher zeros deve ser verdadeira ou falsa." );
		}

		String mascara = texto.optString( "mascara", "" );
		if( texto.has( "mascara" ) && !(texto.opt( "mascara" ) instanceof String) ) throw invalida( "A máscara deve ser um texto." );
		if( mascara.length() > 500 ) throw invalida( "A máscara pode ter até 500 caracteres." );
		int capacidade = 0;
		int obrigatorias = 0;
		boolean opcional = false;
		for( int i = 0; i < mascara.length(); i++ ) {
			char atual = mascara.charAt( i );
			if( atual == '\\' ) {
				if( ++i == mascara.length() ) throw invalida( "A máscara termina com uma barra de escape incompleta." );
				continue;
			}
			if( Character.isISOControl( atual ) || Character.getType( atual ) == Character.FORMAT ) {
				throw invalida( "A máscara não pode conter caracteres de controle." );
			}
			if( POSICOES.indexOf( atual ) < 0 ) continue;
			capacidade++;
			boolean exigida = "AD9*".indexOf( atual ) >= 0;
			if( exigida ) obrigatorias++;
			else opcional = true;
			if( opcional && exigida && !zeros ) throw invalida( "Posições opcionais devem ficar após as obrigatórias." );
			if( zeros && atual != '0' && atual != '9' ) throw invalida( "Preenchimento com zeros exige máscara somente com posições numéricas." );
			if( zeros && !exigida && obrigatorias > 0 ) throw invalida( "Na máscara com zeros à esquerda, posições opcionais devem vir antes das obrigatórias." );
		}
		if( zeros && (capacidade == 0 || obrigatorias == 0) ) throw invalida( "Preenchimento com zeros exige máscara numérica com ao menos uma posição obrigatória." );
		if( capacidade > 0 && (minimo > capacidade || maximo > 0 && maximo < obrigatorias) ) {
			throw invalida( "Os limites de tamanho são incompatíveis com a máscara." );
		}
		if( zeros && (minimo > capacidade || maximo > 0 && maximo < capacidade) ) {
			throw invalida( "O tamanho preenchido com zeros deve caber nos limites informados." );
		}

		String regex = texto.optString( "regex", "" );
		if( texto.has( "regex" ) && !(texto.opt( "regex" ) instanceof String) ) throw invalida( "A expressão regular deve ser um texto." );
		validarRegex( regex );
		if( resultado.has( "valorExemplo" ) && !resultado.getString( "valorExemplo" ).isEmpty() ) {
			resultado.put( "valorExemplo", normalizarExemplo( resultado.getString( "valorExemplo" ), mascara, zeros, minimo, maximo, regex ) );
		}
		return resultado;
	}

	private static String normalizarExemplo( String valor, String mascara, boolean zeros, int minimo, int maximo, String regex ) throws ArgousFormsApiException {

		String resultado = valor;
		List<Parte> partes = partesDaMascara( mascara );
		if( !mascara.isEmpty() && zeros ) {
			Set<Integer> literais = new HashSet<>();
			int capacidade = 0;
			for( Parte parte : partes ) {
				if( parte.tipo() == 0 ) literais.add( parte.literal() );
				else capacidade++;
			}
			StringBuilder digitos = new StringBuilder();
			valor.codePoints().filter( codigo -> !literais.contains( codigo ) ).forEach( digitos::appendCodePoint );
			if( !digitos.toString().matches( "[0-9]+" ) || digitos.length() > capacidade ) {
				throw invalida( "O valor exemplo não corresponde à máscara." );
			}
			resultado = "0".repeat( capacidade - digitos.length() ) + digitos;
		} else if( !mascara.isEmpty() ) {
			int[] entrada = valor.codePoints().toArray();
			StringBuilder dados = new StringBuilder();
			int indice = 0;
			for( Parte parte : partes ) {
				if( parte.tipo() == 0 ) {
					if( indice < entrada.length && entrada[ indice ] == parte.literal() ) indice++;
				} else if( indice < entrada.length && aceita( parte.tipo(), entrada[ indice ] ) ) {
					dados.appendCodePoint( entrada[ indice++ ] );
				} else if( "AD9*".indexOf( parte.tipo() ) >= 0 ) {
					throw invalida( "O valor exemplo não corresponde à máscara." );
				}
			}
			if( indice != entrada.length ) throw invalida( "O valor exemplo não corresponde à máscara." );
			resultado = dados.toString();
		}

		int tamanho = resultado.codePointCount( 0, resultado.length() );
		if( tamanho < minimo || maximo > 0 && tamanho > maximo ) {
			throw invalida( "O valor exemplo não atende aos limites de tamanho da variável." );
		}
		if( !regex.isEmpty() && !Pattern.compile( regex ).matcher( resultado ).matches() ) {
			throw invalida( "O valor exemplo não corresponde à expressão regular da variável." );
		}
		return resultado;
	}

	private static List<Parte> partesDaMascara( String mascara ) {

		List<Parte> partes = new ArrayList<>();
		int[] caracteres = mascara.codePoints().toArray();
		for( int i = 0; i < caracteres.length; i++ ) {
			int atual = caracteres[ i ];
			if( atual == '\\' && i + 1 < caracteres.length ) partes.add( new Parte( 0, caracteres[ ++i ] ) );
			else if( POSICOES.indexOf( atual ) >= 0 ) partes.add( new Parte( atual, 0 ) );
			else partes.add( new Parte( 0, atual ) );
		}
		return partes;
	}

	private static boolean aceita( int tipo, int codigo ) {

		if( tipo == 'a' || tipo == 'A' ) return Character.isLetter( codigo );
		if( tipo == 'd' || tipo == 'D' ) return Character.isLetter( codigo ) || codigo >= '0' && codigo <= '9';
		if( tipo == '0' || tipo == '9' ) return codigo >= '0' && codigo <= '9';
		return !caractereInvalido( codigo );
	}

	private static boolean caractereInvalido( int codigo ) {
		int categoria = Character.getType( codigo );
		return Character.isISOControl( codigo ) || categoria == Character.FORMAT || categoria == Character.LINE_SEPARATOR || categoria == Character.PARAGRAPH_SEPARATOR;
	}

	private record Parte( int tipo, int literal ) {}

	private static int inteiro( JSONObject texto, String chave ) throws ArgousFormsApiException {

		if( !texto.has( chave ) ) return 0;
		Object valor = texto.opt( chave );
		if( !(valor instanceof Integer numero) || numero < 0 || numero > 10000 ) {
			throw invalida( "Os limites de tamanho devem ser inteiros entre 0 e 10000." );
		}
		return numero;
	}

	private static void validarRegex( String regex ) throws ArgousFormsApiException {

		if( regex.isEmpty() ) return;
		if( regex.length() > 200 || regex.indexOf( '(' ) >= 0 || regex.indexOf( ')' ) >= 0 || regex.indexOf( '|' ) >= 0
				|| regex.indexOf( '/' ) >= 0 || regex.indexOf( '\n' ) >= 0 || regex.indexOf( '\r' ) >= 0 ) {
			throw invalida( "A expressão regular usa recursos fora da sintaxe portátil permitida." );
		}
		for( int i = 0; i < regex.length(); i++ ) {
			char atual = regex.charAt( i );
			if( atual == '\\' ) {
				if( ++i == regex.length() || ".+*?[]{}\\^$-".indexOf( regex.charAt( i ) ) < 0 ) {
					throw invalida( "A expressão regular contém uma sequência de escape não permitida." );
				}
			} else if( !(atual >= 'a' && atual <= 'z' || atual >= 'A' && atual <= 'Z' || atual >= '0' && atual <= '9'
					|| "@._%+-[]{},?*^$".indexOf( atual ) >= 0) ) {
				throw invalida( "A expressão regular usa caracteres fora da sintaxe portátil permitida." );
			}
		}
		try {
			Pattern.compile( regex );
		} catch ( PatternSyntaxException e ) {
			throw invalida( "A expressão regular não é válida." );
		}
	}

	private static ArgousFormsApiException invalida( String mensagem ) {
		return new ArgousFormsApiException( 400, "DEFINICAO_VARIAVEL_INVALIDA", mensagem );
	}
}
