package br.com.webhook.configuracao;

import java.io.InputStream;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.LinkOption;
import java.nio.file.Path;
import java.nio.file.attribute.PosixFilePermissions;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Arrays;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.Map;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;

import org.w3c.dom.Element;

/** Cifragem local: a chave acompanha o arquivo e oferece proteção contra leitura casual. */
public final class ConfiguracaoPermanente {

    public static final String ATRIBUTO_CONTEXTO = ConfiguracaoPermanente.class.getName();
    public static final String NOME_ARQUIVO = "configuracao.xml";
    private static final String ALFABETO = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    private static final String[] CAMPOS = { "nomeInstituicao", "endIP", "nroPorta", "database", "dbUser", "dbPasswd" };
    private static final SecureRandom ALEATORIO = new SecureRandom();
    private final Map<String, String> valores;

    private ConfiguracaoPermanente( Map<String, String> valores ) {
        this.valores = Map.copyOf( valores );
    }

    public String nomeInstituicao() { return valores.get( "nomeInstituicao" ); }

    public String valor( String campo ) { return valores.get( campo ); }

    @Override
    public String toString() { return "ConfiguracaoPermanente[conteudo protegido]"; }

    public static synchronized ConfiguracaoPermanente carregarOuCriar( Path diretorio ) throws Exception {

        Path destino = diretorio.resolve( NOME_ARQUIVO );
        if( Files.exists( destino, LinkOption.NOFOLLOW_LINKS ) ) return ler( destino );

        Map<String, String> dados = new LinkedHashMap<>();
        try ( InputStream entrada = Files.newInputStream( diretorio.resolve( "startup.xml" ) ) ) {
            Element raiz = ConfiguracaoInicial.lerRaiz( entrada, "startup" );
            dados.put( "nomeInstituicao", ConfiguracaoInicial.extrairNomeInstituicao( raiz ) );
            Element postgres = ConfiguracaoInicial.filhoUnico( raiz, "postgres" );
            for( String campo : CAMPOS ) {
                if( !"nomeInstituicao".equals( campo ) ) {
                    String valor = ConfiguracaoInicial.filhoUnico( postgres, campo ).getTextContent();
                    dados.put( campo, "dbPasswd".equals( campo ) ? valor : valor.strip() );
                }
            }
        }
        validar( dados );

        byte[] chaveOriginal = novaChave();
        SecretKeySpec chave = derivar( chaveOriginal );
        StringBuilder xml = new StringBuilder( "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<configuracao versao=\"1\">\n" );
        xml.append( "  <chave>" ).append( Base64.getEncoder().encodeToString( compactar( chaveOriginal ) ) ).append( "</chave>\n" );
        for( String campo : CAMPOS ) {
            xml.append( "  <" ).append( campo ).append( ">" ).append( cifrar( campo, dados.get( campo ), chave ) );
            xml.append( "</" ).append( campo ).append( ">\n" );
        }
        xml.append( "</configuracao>\n" );
        Arrays.fill( chaveOriginal, (byte) 0 );

        Path temporario;
        if( Files.getFileStore( diretorio ).supportsFileAttributeView( "posix" ) ) {
            temporario = Files.createTempFile( diretorio, ".configuracao-", ".tmp", PosixFilePermissions.asFileAttribute( PosixFilePermissions.fromString( "rw-------" ) ) );
        } else {
            temporario = Files.createTempFile( diretorio, ".configuracao-", ".tmp" );
        }

        try {
            Files.writeString( temporario, xml, StandardCharsets.UTF_8 );
            // Validar o arquivo completo antes de publicá-lo; não substituir configuração existente.
            ConfiguracaoPermanente resultado = ler( temporario );
            Files.move( temporario, destino );
            return resultado;
        } finally {
            Files.deleteIfExists( temporario );
        }
    }

    static ConfiguracaoPermanente ler( Path arquivo ) throws Exception {

        if( !Files.isRegularFile( arquivo, LinkOption.NOFOLLOW_LINKS ) || Files.size( arquivo ) > 65536 ) {
            throw new IllegalArgumentException( "Arquivo de configuracao invalido." );
        }

        Map<String, String> dados = new LinkedHashMap<>();
        try ( InputStream entrada = Files.newInputStream( arquivo ) ) {
            Element raiz = ConfiguracaoInicial.lerRaiz( entrada, "configuracao" );
            if( !"1".equals( raiz.getAttribute( "versao" ) ) ) {
                throw new IllegalArgumentException( "Versao de configuracao invalida." );
            }

            byte[] chaveOriginal = descompactar( Base64.getDecoder().decode( ConfiguracaoInicial.filhoUnico( raiz, "chave" ).getTextContent().strip() ) );
            SecretKeySpec chave = derivar( chaveOriginal );
            Arrays.fill( chaveOriginal, (byte) 0 );
            for( String campo : CAMPOS ) {
                String texto = ConfiguracaoInicial.filhoUnico( raiz, campo ).getTextContent().strip();
                dados.put( campo, decifrar( campo, texto, chave ) );
            }
        }
        validar( dados );

        return new ConfiguracaoPermanente( dados );
    }

    private static void validar( Map<String, String> dados ) {

        for( String campo : CAMPOS ) {
            String valor = dados.get( campo );
            if( valor == null || valor.isBlank() || valor.length() > 4096 ) {
                throw new IllegalArgumentException( "Configuracao incompleta ou invalida." );
            }
        }

        String nome = dados.get( "nomeInstituicao" );
        if( nome.length() > 200 || nome.codePoints().anyMatch( Character::isISOControl ) ) {
            throw new IllegalArgumentException( "Nome da instituicao invalido." );
        }

        int porta = Integer.parseInt( dados.get( "nroPorta" ) );
        if( porta < 1 || porta > 65535 ) {
            throw new IllegalArgumentException( "Porta PostgreSQL invalida." );
        }
    }

    static byte[] novaChave() {

        byte[] chave = new byte[ 250 ];
        for( int i = 0; i < chave.length; i++ ) {
            chave[ i ] = (byte) ALFABETO.charAt( ALEATORIO.nextInt( ALFABETO.length() ) );
        }

        return chave;
    }

    static byte[] compactar( byte[] chave ) {

        if( chave.length != 250 ) {
            throw new IllegalArgumentException( "Tamanho de chave invalido." );
        }

        byte[] resultado = new byte[ 219 ];
        int posicao = 0;
        for( byte caractere : chave ) {
            if( ALFABETO.indexOf( caractere ) < 0 ) {
                throw new IllegalArgumentException( "Caractere de chave invalido." );
            }
            for( int bit = 6; bit >= 0; bit-- ) {
                resultado[ posicao / 8 ] |= (byte) ( ( ( caractere >> bit ) & 1 ) << ( 7 - posicao % 8 ) );
                posicao++;
            }
        }

        return resultado;
    }

    static byte[] descompactar( byte[] compactada ) {

        if( compactada.length != 219 || ( compactada[ 218 ] & 3 ) != 0 ) {
            throw new IllegalArgumentException( "Chave compactada invalida." );
        }

        byte[] chave = new byte[ 250 ];
        int posicao = 0;
        for( int i = 0; i < chave.length; i++ ) {
            int caractere = 0;
            for( int bit = 6; bit >= 0; bit-- ) {
                caractere |= ( ( compactada[ posicao / 8 ] >> ( 7 - posicao % 8 ) ) & 1 ) << bit;
                posicao++;
            }
            if( ALFABETO.indexOf( caractere ) < 0 ) {
                throw new IllegalArgumentException( "Chave compactada invalida." );
            }
            chave[ i ] = (byte) caractere;
        }

        return chave;
    }

    private static SecretKeySpec derivar( byte[] chave ) throws Exception {
        return new SecretKeySpec( MessageDigest.getInstance( "SHA-256" ).digest( chave ), "AES" );
    }

    private static String cifrar( String campo, String texto, SecretKeySpec chave ) throws Exception {

        byte[] nonce = new byte[ 12 ];
        ALEATORIO.nextBytes( nonce );
        Cipher cipher = Cipher.getInstance( "AES/GCM/NoPadding" );
        cipher.init( Cipher.ENCRYPT_MODE, chave, new GCMParameterSpec( 128, nonce ) );
        cipher.updateAAD( ( "agforms-config-v1|" + campo ).getBytes( StandardCharsets.UTF_8 ) );
        byte[] cifrado = cipher.doFinal( texto.getBytes( StandardCharsets.UTF_8 ) );

        return Base64.getEncoder().encodeToString( ByteBuffer.allocate( nonce.length + cifrado.length ).put( nonce ).put( cifrado ).array() );
    }

    private static String decifrar( String campo, String texto, SecretKeySpec chave ) throws Exception {

        byte[] conteudo = Base64.getDecoder().decode( texto );
        if( conteudo.length < 28 ) {
            throw new IllegalArgumentException( "Conteudo cifrado invalido." );
        }

        Cipher cipher = Cipher.getInstance( "AES/GCM/NoPadding" );
        cipher.init( Cipher.DECRYPT_MODE, chave, new GCMParameterSpec( 128, Arrays.copyOfRange( conteudo, 0, 12 ) ) );
        cipher.updateAAD( ( "agforms-config-v1|" + campo ).getBytes( StandardCharsets.UTF_8 ) );

        return new String( cipher.doFinal( conteudo, 12, conteudo.length - 12 ), StandardCharsets.UTF_8 );
    }
}
