package br.com.webhook.api;

import java.util.Map;

/** Serialização de respostas próprias, sem reflexão sobre entidades ou credenciais. */
public final class Json {

    private Json() {}

    public static String escrever( Object valor ) {

        if( valor == null ) return "null";
        if( valor instanceof Boolean || valor instanceof Number ) return valor.toString();
        if( valor instanceof Map<?, ?> mapa ) {
            StringBuilder json = new StringBuilder( "{" );
            for( var entrada : mapa.entrySet() ) {
                if( json.length() > 1 ) json.append( ',' );
                json.append( AutenticacaoServlet.json( entrada.getKey().toString() ) ).append( ':' ).append( escrever( entrada.getValue() ) );
            }
            return json.append( '}' ).toString();
        }
        if( valor instanceof Iterable<?> lista ) {
            StringBuilder json = new StringBuilder( "[" );
            for( Object item : lista ) {
                if( json.length() > 1 ) json.append( ',' );
                json.append( escrever( item ) );
            }
            return json.append( ']' ).toString();
        }

        return AutenticacaoServlet.json( valor.toString() );
    }
}
