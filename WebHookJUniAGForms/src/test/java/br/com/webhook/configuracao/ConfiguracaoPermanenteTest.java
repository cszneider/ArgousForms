package br.com.webhook.configuracao;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.attribute.PosixFilePermissions;
import java.util.Arrays;
import java.util.Base64;
import java.util.Comparator;

public final class ConfiguracaoPermanenteTest {

    public static void main( String[] args ) throws Exception {

        for( int i = 0; i < 100; i++ ) {
            byte[] chave = ConfiguracaoPermanente.novaChave();
            byte[] compactada = ConfiguracaoPermanente.compactar( chave );
            checar( compactada.length == 219, "Tamanho compactado incorreto." );
            checar( Arrays.equals( chave, ConfiguracaoPermanente.descompactar( compactada ) ), "Chave nao recuperada." );
        }

        Path diretorio = Files.createTempDirectory( "webhook-config-teste-" );
        try {
            Path startup = diretorio.resolve( "startup.xml" );
            Path permanente = diretorio.resolve( ConfiguracaoPermanente.NOME_ARQUIVO );
            Files.writeString( startup, "<startup><instituicao><nome>Padaria de Teste</nome></instituicao><administrador><senha>ADMIN_NAO_PERSISTIR</senha></administrador><postgres><endIP>127.0.0.1</endIP><nroPorta>5432</nroPorta><database>teste_webhook</database><dbUser>usuario_teste</dbUser><dbPasswd> senha&amp;teste </dbPasswd></postgres></startup>" );

            ConfiguracaoPermanente primeira = ConfiguracaoPermanente.carregarOuCriar( diretorio );
            checar( "Padaria de Teste".equals( primeira.nomeInstituicao() ), "Nome nao recuperado." );
            checar( " senha&teste ".equals( primeira.valor( "dbPasswd" ) ), "Senha alterada." );
            checar( Files.exists( startup ), "Startup removido antes da instalacao." );
            String conteudo = Files.readString( permanente );
            checar( !conteudo.contains( "ADMIN_NAO_PERSISTIR" ), "Senha inicial persistida." );
            checar( !conteudo.contains( "senha&amp;teste" ) && !conteudo.contains( "teste_webhook" ) && !conteudo.contains( "Padaria de Teste" ), "Dados em claro." );
            checar( !primeira.toString().contains( "senha" ), "Dados no toString." );
            if( Files.getFileStore( diretorio ).supportsFileAttributeView( "posix" ) ) {
                checar( Files.getPosixFilePermissions( permanente ).equals( PosixFilePermissions.fromString( "rw-------" ) ), "Permissoes inadequadas." );
            }

            Files.delete( startup );
            ConfiguracaoPermanente segunda = ConfiguracaoPermanente.carregarOuCriar( diretorio );
            checar( primeira.nomeInstituicao().equals( segunda.nomeInstituicao() ), "Reinicio sem startup falhou." );
            checar( conteudo.equals( Files.readString( permanente ) ), "Configuracao regravada." );

            String alterado = conteudo.replaceFirst( "<database>.", "<database>!" );
            Files.writeString( permanente, alterado );
            recusarLeitura( diretorio );
            checar( alterado.equals( Files.readString( permanente ) ), "Arquivo invalido sobrescrito." );

            String campoA = conteudo.split( "<endIP>" )[ 1 ].split( "</endIP>" )[ 0 ];
            String campoB = conteudo.split( "<database>" )[ 1 ].split( "</database>" )[ 0 ];
            byte[] adulterado = Base64.getDecoder().decode( campoB );
            adulterado[ adulterado.length - 1 ] ^= 1;
            Files.writeString( permanente, conteudo.replace( campoB, Base64.getEncoder().encodeToString( adulterado ) ) );
            recusarLeitura( diretorio );

            Files.writeString( permanente, conteudo.replace( "<endIP>" + campoA, "<endIP>" + campoB ) );
            recusarLeitura( diretorio );

            byte[] paddingInvalido = ConfiguracaoPermanente.compactar( ConfiguracaoPermanente.novaChave() );
            paddingInvalido[ 218 ] |= 1;
            try {
                ConfiguracaoPermanente.descompactar( paddingInvalido );
                throw new AssertionError( "Padding invalido aceito." );
            } catch ( IllegalArgumentException esperado ) {
                // Rejeição esperada.
            }

            checar( !Files.readString( permanente, StandardCharsets.UTF_8 ).isBlank(), "Arquivo vazio." );
            System.out.println( "ConfiguracaoPermanente: compactacao, cifragem, reinicio, permissoes e adulteracao verificados." );
        } finally {
            try ( var caminhos = Files.walk( diretorio ) ) {
                for( Path caminho : caminhos.sorted( Comparator.reverseOrder() ).toList() ) {
                    Files.delete( caminho );
                }
            }
        }
    }

    private static void recusarLeitura( Path diretorio ) throws Exception {

        try {
            ConfiguracaoPermanente.carregarOuCriar( diretorio );
        } catch ( Exception esperado ) {
            return;
        }

        throw new AssertionError( "Adulteracao aceita." );
    }

    private static void checar( boolean condicao, String mensagem ) {

        if( !condicao ) {
            throw new AssertionError( mensagem );
        }
    }
}
