package br.com.argousForms.integracao;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

/** Assinatura v1 do contrato de integração, compartilhada com o webhook da instituição. */
final class WebhookHmac {

	private final byte[] chave;

	WebhookHmac() {

		String configurada = System.getenv( "ARGOUSFORMS_WEBHOOK_HMAC_CHAVE_BASE64" );
		if( configurada == null || configurada.isBlank() ) throw new IllegalStateException( "Chave HMAC do webhook não configurada." );
		try { chave = Base64.getDecoder().decode( configurada ); }
		catch ( IllegalArgumentException e ) { throw new IllegalStateException( "Chave HMAC do webhook inválida." ); }
		if( chave.length < 32 ) throw new IllegalStateException( "A chave HMAC do webhook precisa ter pelo menos 32 bytes." );
	}

	String assinar( String tipo, String id, String instante, byte[] corpo ) throws Exception {

		String conteudo = "ARGOUS-HMAC-V1\n" + tipo + "\n" + id + "\n" + instante + "\n" + sha256( corpo );
		Mac mac = Mac.getInstance( "HmacSHA256" );
		mac.init( new SecretKeySpec( chave, "HmacSHA256" ) );
		return Base64.getEncoder().encodeToString( mac.doFinal( conteudo.getBytes( StandardCharsets.UTF_8 ) ) );
	}

	void verificarResposta( String idEsperado, String idRecebido, String instante, String assinatura, byte[] corpo ) throws Exception {

		if( !idEsperado.equals( idRecebido ) || instante == null || assinatura == null ) throw new SecurityException( "Resposta do webhook sem assinatura válida." );
		Instant data;
		try { data = Instant.parse( instante ); }
		catch ( Exception e ) { throw new SecurityException( "Instante da resposta do webhook inválido." ); }
		if( Math.abs( Duration.between( data, Instant.now() ).toSeconds() ) > 300 ) throw new SecurityException( "Resposta do webhook fora da janela de tempo." );
		byte[] recebida;
		try { recebida = Base64.getDecoder().decode( assinatura ); }
		catch ( IllegalArgumentException e ) { throw new SecurityException( "Assinatura do webhook inválida." ); }
		byte[] esperada = Base64.getDecoder().decode( assinar( "RESPOSTA", idEsperado, instante, corpo ) );
		if( !MessageDigest.isEqual( recebida, esperada ) ) throw new SecurityException( "Assinatura do webhook inválida." );
	}

	static String sha256( byte[] conteudo ) throws Exception {

		return HexFormat.of().formatHex( MessageDigest.getInstance( "SHA-256" ).digest( conteudo ) );
	}
}
