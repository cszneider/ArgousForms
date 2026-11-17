package br.com.webhook.configuracao;

import java.io.InputStream;

import javax.xml.XMLConstants;
import javax.xml.parsers.DocumentBuilderFactory;

import org.w3c.dom.Element;
import org.w3c.dom.Node;
import org.xml.sax.SAXException;
import org.xml.sax.helpers.DefaultHandler;

/** Leitura da identidade pública da instalação, sem expor credenciais. */
public final class ConfiguracaoInicial {

    private ConfiguracaoInicial() {}

    public static String lerNomeInstituicao( InputStream entrada ) throws Exception {

        return extrairNomeInstituicao( lerRaiz( entrada, "startup" ) );
    }

    static Element lerRaiz( InputStream entrada, String tag ) throws Exception {

        if( entrada == null ) {
            throw new IllegalArgumentException( "Configuracao inicial ausente." );
        }

        DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
        factory.setFeature( XMLConstants.FEATURE_SECURE_PROCESSING, true );
        factory.setFeature( "http://apache.org/xml/features/disallow-doctype-decl", true );
        factory.setFeature( "http://xml.org/sax/features/external-general-entities", false );
        factory.setFeature( "http://xml.org/sax/features/external-parameter-entities", false );
        factory.setAttribute( XMLConstants.ACCESS_EXTERNAL_DTD, "" );
        factory.setAttribute( XMLConstants.ACCESS_EXTERNAL_SCHEMA, "" );
        factory.setXIncludeAware( false );
        factory.setExpandEntityReferences( false );

        var builder = factory.newDocumentBuilder();
        builder.setErrorHandler( new DefaultHandler() {

            @Override
            public void error( org.xml.sax.SAXParseException erro ) throws SAXException {
                throw erro;
            }

            @Override
            public void fatalError( org.xml.sax.SAXParseException erro ) throws SAXException {
                throw erro;
            }
        } );

        Element raiz = builder.parse( entrada ).getDocumentElement();
        if( !tag.equals( raiz.getTagName() ) ) {
            throw new IllegalArgumentException( "Configuracao inicial invalida." );
        }

        return raiz;
    }

    static String extrairNomeInstituicao( Element raiz ) {

        Element instituicao = filhoUnico( raiz, "instituicao" );
        String nome = filhoUnico( instituicao, "nome" ).getTextContent().strip();
        if( nome.isEmpty() || nome.length() > 200 || nome.codePoints().anyMatch( Character::isISOControl ) ) {
            throw new IllegalArgumentException( "Nome da instituicao invalido." );
        }

        return nome;
    }

    static Element filhoUnico( Element pai, String nome ) {

        Element encontrado = null;
        for( Node filho = pai.getFirstChild(); filho != null; filho = filho.getNextSibling() ) {
            if( filho instanceof Element elemento && nome.equals( elemento.getTagName() ) ) {
                if( encontrado != null ) {
                    throw new IllegalArgumentException( "Configuracao inicial ambigua." );
                }
                encontrado = elemento;
            }
        }

        if( encontrado == null ) {
            throw new IllegalArgumentException( "Configuracao inicial incompleta." );
        }

        return encontrado;
    }
}
