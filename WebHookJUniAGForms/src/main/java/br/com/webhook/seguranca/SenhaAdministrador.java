package br.com.webhook.seguranca;

import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Base64;

import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.PBEKeySpec;

public final class SenhaAdministrador {

    private static final SecureRandom ALEATORIO = new SecureRandom();
    private static final String HASH_AUSENTE = "pbkdf2-sha256$600000$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";

    private SenhaAdministrador() {}

    public static String gerarHash( char[] senha ) throws Exception {

        byte[] salt = new byte[ 16 ];
        ALEATORIO.nextBytes( salt );

        return "pbkdf2-sha256$600000$" + Base64.getEncoder().encodeToString( salt ) + "$" + Base64.getEncoder().encodeToString( derivar( senha, salt, 600_000 ) );
    }

    public static boolean verificar( char[] senha, String armazenado ) throws Exception {

        String[] partes = ( armazenado == null ? HASH_AUSENTE : armazenado ).split( "\\$", -1 );
        try {
            if( partes.length != 4 || !"pbkdf2-sha256".equals( partes[ 0 ] ) ) return false;
            int iteracoes = Integer.parseInt( partes[ 1 ] );
            byte[] salt = Base64.getDecoder().decode( partes[ 2 ] );
            byte[] esperado = Base64.getDecoder().decode( partes[ 3 ] );
            if( iteracoes < 1 || iteracoes > 2_000_000 || salt.length != 16 || esperado.length != 32 ) return false;

            boolean igual = MessageDigest.isEqual( esperado, derivar( senha, salt, iteracoes ) );
            return armazenado != null && igual;
        } catch ( IllegalArgumentException erro ) {
            return false;
        }
    }

    public static boolean atendePolitica( char[] senha ) {

        if( senha.length < 8 || senha.length > 1024 ) return false;
        boolean maiuscula = false;
        boolean minuscula = false;
        boolean numero = false;
        boolean simbolo = false;
        for( char caractere : senha ) {
            maiuscula |= Character.isUpperCase( caractere );
            minuscula |= Character.isLowerCase( caractere );
            numero |= Character.isDigit( caractere );
            simbolo |= !Character.isLetterOrDigit( caractere );
        }

        return ( maiuscula ? 1 : 0 ) + ( minuscula ? 1 : 0 ) + ( numero ? 1 : 0 ) + ( simbolo ? 1 : 0 ) >= 3;
    }

    private static byte[] derivar( char[] senha, byte[] salt, int iteracoes ) throws Exception {

        PBEKeySpec especificacao = new PBEKeySpec( senha, salt, iteracoes, 256 );
        try {
            return SecretKeyFactory.getInstance( "PBKDF2WithHmacSHA256" ).generateSecret( especificacao ).getEncoded();
        } finally {
            especificacao.clearPassword();
        }
    }
}
