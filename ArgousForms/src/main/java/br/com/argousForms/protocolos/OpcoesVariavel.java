package br.com.argousForms.protocolos;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

import org.json.JSONArray;
import org.json.JSONObject;

import br.com.argousForms.api.ArgousFormsApiException;

public final class OpcoesVariavel {

	private OpcoesVariavel() {}

	public static JSONArray lista( JSONObject definicao ) {

		JSONArray opcoes = definicao == null ? null : definicao.optJSONArray( "opcoes" );
		return opcoes == null ? new JSONArray() : opcoes;
	}

	public static void validar( JSONObject definicao, JSONObject anterior, boolean publicada ) throws ArgousFormsApiException {

		JSONArray opcoes = lista( definicao );
		Set<String> codigos = new HashSet<>();
		for( int indice = 0; indice < opcoes.length(); indice++ ) {
			JSONObject opcao = opcoes.optJSONObject( indice );
			String codigo = opcao == null ? "" : opcao.optString( "codigo", "" );
			String rotulo = opcao == null ? "" : opcao.optString( "rotulo", "" ).strip();
			if( !codigo.matches( "[A-Za-z0-9_-]{1,40}" ) || rotulo.isEmpty() || !codigos.add( codigo ) ) {
				throw new ArgousFormsApiException( 400, "OPCOES_INVALIDAS", "Cada opção precisa de código único e rótulo não vazio." );
			}
		}
		if( !publicada ) return;
		for( int indice = 0; indice < lista( anterior ).length(); indice++ ) {
			String codigo = lista( anterior ).optJSONObject( indice ).optString( "codigo" );
			if( !codigos.contains( codigo ) ) throw new ArgousFormsApiException( 409, "CODIGO_OPCAO_IMUTAVEL", "Uma opção publicada pode ser desativada, mas não removida nem ter seu código alterado." );
		}
	}

	public static boolean ativa( JSONObject definicao, String codigo ) {

		JSONArray opcoes = lista( definicao );
		for( int indice = 0; indice < opcoes.length(); indice++ ) {
			JSONObject opcao = opcoes.optJSONObject( indice );
			if( opcao != null && codigo.equals( opcao.optString( "codigo" ) ) ) return opcao.optBoolean( "ativa", true );
		}
		return false;
	}

	public static String rotulo( JSONObject definicao, String codigo ) {

		JSONArray opcoes = lista( definicao );
		for( int indice = 0; indice < opcoes.length(); indice++ ) {
			JSONObject opcao = opcoes.optJSONObject( indice );
			if( opcao != null && codigo.equals( opcao.optString( "codigo" ) ) ) return opcao.optString( "rotulo", codigo );
		}
		return codigo;
	}

	public static String rotulos( JSONObject definicao, List<String> codigos ) {

		List<String> ordenados = new ArrayList<>();
		JSONArray opcoes = lista( definicao );
		for( int indice = 0; indice < opcoes.length(); indice++ ) {
			String codigo = opcoes.optJSONObject( indice ).optString( "codigo" );
			if( codigos.contains( codigo ) ) ordenados.add( rotulo( definicao, codigo ) );
		}
		for( String codigo : codigos ) {
			boolean encontrado = false;
			for( int indice = 0; indice < opcoes.length(); indice++ ) {
				if( codigo.equals( opcoes.optJSONObject( indice ).optString( "codigo" ) ) ) encontrado = true;
			}
			if( !encontrado ) ordenados.add( codigo );
		}
		return String.join( ", ", ordenados );
	}
}
