package br.com.argousForms.security;

import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Arrays;
import java.util.Base64;
import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.PBEKeySpec;

public final class SenhaSegura {

	private static final int ITERACOES = 600_000;
	private static final SecureRandom ALEATORIO = new SecureRandom();

	private SenhaSegura() {
	}

	public static String gerarHash(String senha) {
		byte[] salt = new byte[16];
		ALEATORIO.nextBytes(salt);
		return "pbkdf2-sha256$" + ITERACOES + "$" + Base64.getEncoder().encodeToString(salt)
			+ "$" + Base64.getEncoder().encodeToString(derivar(senha, salt, ITERACOES));
	}

	public static boolean confere(String senha, String armazenado) {
		if (senha == null || armazenado == null) return false;
		try {
			String[] partes = armazenado.split("\\$", -1);
			if (partes.length != 4 || !"pbkdf2-sha256".equals(partes[0])) return false;
			int iteracoes = Integer.parseInt(partes[1]);
			if (iteracoes < 1 || iteracoes > 2_000_000) return false;
			byte[] salt = Base64.getDecoder().decode(partes[2]);
			byte[] esperado = Base64.getDecoder().decode(partes[3]);
			if (salt.length != 16 || esperado.length != 32) return false;
			return MessageDigest.isEqual(esperado, derivar(senha, salt, iteracoes));
		} catch (IllegalArgumentException e) {
			return false;
		}
	}

	private static byte[] derivar(String senha, byte[] salt, int iteracoes) {
		char[] caracteres = senha.toCharArray();
		PBEKeySpec especificacao = new PBEKeySpec(caracteres, salt, iteracoes, 256);
		Arrays.fill(caracteres, '\0');
		try {
			return SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256").generateSecret(especificacao).getEncoded();
		} catch (GeneralSecurityException e) {
			throw new IllegalStateException("PBKDF2-HMAC-SHA-256 indisponível.");
		} finally {
			especificacao.clearPassword();
		}
	}
}
