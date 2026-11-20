package br.com.argousForms.security;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;

/**
 * Utilitário para gerar o hash SHA-1 de um texto.
 */
public final class Sha1Util {

    private static final char[] HEX = "0123456789abcdef".toCharArray();

    private Sha1Util() {
        // classe utilitária: não deve ser instanciada
    }

    /**
     * Retorna o SHA-1 do texto informado, em hexadecimal minúsculo (40 caracteres).
     * O texto é convertido para bytes em UTF-8, o mesmo resultado de
     * {@code echo -n "texto" | shasum -a 1} no terminal.
     *
     * @param texto texto de entrada (não pode ser nulo)
     * @return hash SHA-1 em hexadecimal
     */
    public static String sha1(String texto) {
        if (texto == null) {
            throw new IllegalArgumentException("O texto não pode ser nulo");
        }
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-1");
            byte[] hash = md.digest(texto.getBytes(StandardCharsets.UTF_8));
            return paraHex(hash);
        } catch (NoSuchAlgorithmException e) {
            // SHA-1 é obrigatório em toda implementação Java; não deve ocorrer
            throw new IllegalStateException("Algoritmo SHA-1 indisponível", e);
        }
    }

    private static String paraHex(byte[] bytes) {
        char[] saida = new char[bytes.length * 2];
        for (int i = 0; i < bytes.length; i++) {
            int v = bytes[i] & 0xFF;
            saida[i * 2] = HEX[v >>> 4];
            saida[i * 2 + 1] = HEX[v & 0x0F];
        }
        return new String(saida);
    }

    public static void main( String[] args ) {
    	
    	
    	testaSenha( "objetivo", "senha", 100000 );
    	
    	
        String texto = args.length > 0 ? args[0] : "P1234";
        System.out.println(sha1(texto));
    }

	private static void testaSenha( String objetivo, String senha, long qtMaximo ) {

		long qt = 0;
		
		while( qt++ < qtMaximo ) {
			
		}
	}
}
