package br.com.argousForms.security;

import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Locale;
import java.util.UUID;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

public final class CodigoConfirmacao {

	private static final SecureRandom ALEATORIO = new SecureRandom();
	private final byte[] chave;

	/** Gera uma chave de instalação de 256 bits, representada por 44 caracteres Base64. */
	public static String gerarChaveBase64() {
		
		byte[] chave = new byte[ 32 ];
		ALEATORIO.nextBytes( chave );
		return Base64.getEncoder().encodeToString( chave );
	}

	public CodigoConfirmacao( byte[] chave ) {
		
		if( chave == null || chave.length < 32 ) {
			throw new IllegalArgumentException( "A chave deve ter pelo menos 32 bytes." );
		}
		
		this.chave = chave.clone();
	}

	public String gerar() {
		return String.format( Locale.ROOT, "%08d", ALEATORIO.nextInt( 100_000_000 ) );
	}

	public String hash( UUID solicitacao, UUID usuario, String email, String codigo ) {

		try {
			Mac mac = Mac.getInstance( "HmacSHA256" );
			mac.init( new SecretKeySpec( chave, "HmacSHA256" ) );
			String contexto = "ArgousForms:confirmacao:v1\n" + solicitacao + "\n" + usuario + "\n" + email + "\n" + codigo;
			
			return HexFormat.of().formatHex( mac.doFinal( contexto.getBytes( StandardCharsets.UTF_8 ) ) );
		} catch ( GeneralSecurityException e ) {
			throw new IllegalStateException( "HMAC-SHA-256 indisponível." );
		}
	}

	public boolean confere( UUID solicitacao, UUID usuario, String email, String codigo, String esperado ) {

		if( codigo == null || !codigo.matches( "[0-9]{8}" ) || esperado == null ) return false;
		
		return MessageDigest.isEqual( hash( solicitacao, usuario, email, codigo ).getBytes( StandardCharsets.US_ASCII ), esperado.getBytes( StandardCharsets.US_ASCII ) );
	}
}
