package br.com.webhook.configuracao;

import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;

/** Testes executáveis com o JDK, sem dependências de teste adicionais. */
public final class ConfiguracaoInicialTest {

    public static void main( String[] args ) throws Exception {

        String nome = ler( "<startup><instituicao><nome> Padaria do Espanhol </nome></instituicao><administrador><senha>NAO_EXPOR</senha></administrador></startup>" );
        if( !"Padaria do Espanhol".equals( nome ) ) {
            throw new AssertionError( "Nome incorreto." );
        }

        deveRecusar( "<startup/>" );
        deveRecusar( "<startup><instituicao><nome> </nome></instituicao></startup>" );
        deveRecusar( "<startup><instituicao><nome>A</nome><nome>B</nome></instituicao></startup>" );
        deveRecusar( "<startup><instituicao><nome>A</nome></instituicao><instituicao><nome>B</nome></instituicao></startup>" );
        deveRecusar( "<outro><instituicao><nome>A</nome></instituicao></outro>" );
        deveRecusar( "<startup><instituicao><nome>" + "a".repeat( 201 ) + "</nome></instituicao></startup>" );
        deveRecusar( "<startup><instituicao><nome>A&#10;B</nome></instituicao></startup>" );
        deveRecusar( "<startup><instituicao>" );
        deveRecusar( "<!DOCTYPE startup [<!ENTITY externa SYSTEM 'file:///arquivo-que-nao-deve-ser-acessado'>]><startup><instituicao><nome>&externa;</nome></instituicao></startup>" );
        deveRecusar( "<!DOCTYPE startup [<!ENTITY interna 'valor'>]><startup><instituicao><nome>&interna;</nome></instituicao></startup>" );

        try {
            ConfiguracaoInicial.lerNomeInstituicao( null );
            throw new AssertionError( "Arquivo ausente aceito." );
        } catch ( IllegalArgumentException esperado ) {
            // Ausência deve impedir que a tela apresente uma instalação configurada.
        }

        System.out.println( "ConfiguracaoInicial: 12 verificacoes aprovadas." );
    }

    private static String ler( String xml ) throws Exception {
        return ConfiguracaoInicial.lerNomeInstituicao( new ByteArrayInputStream( xml.getBytes( StandardCharsets.UTF_8 ) ) );
    }

    private static void deveRecusar( String xml ) throws Exception {

        try {
            ler( xml );
        } catch ( Exception esperado ) {
            return;
        }

        throw new AssertionError( "XML invalido aceito." );
    }
}
