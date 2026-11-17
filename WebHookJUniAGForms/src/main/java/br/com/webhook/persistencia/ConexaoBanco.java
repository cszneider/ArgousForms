package br.com.webhook.persistencia;

import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.sql.Connection;
import java.sql.DriverManager;
import java.util.Properties;

import br.com.webhook.configuracao.ConfiguracaoPermanente;

public final class ConexaoBanco {

    private ConexaoBanco() {}

    public static Connection abrir( ConfiguracaoPermanente configuracao ) throws Exception {

        int porta = Integer.parseInt( configuracao.valor( "nroPorta" ) );
        String servidor = new URI( null, null, configuracao.valor( "endIP" ), porta, null, null, null ).getRawAuthority();
        String database = URLEncoder.encode( configuracao.valor( "database" ), StandardCharsets.UTF_8 ).replace( "+", "%20" );
        String url = "jdbc:postgresql://" + servidor + "/" + database;
        Properties propriedades = new Properties();
        propriedades.setProperty( "user", configuracao.valor( "dbUser" ) );
        propriedades.setProperty( "password", configuracao.valor( "dbPasswd" ) );
        propriedades.setProperty( "connectTimeout", "10" );
        propriedades.setProperty( "socketTimeout", "60" );
        propriedades.setProperty( "ApplicationName", "WebHookAGForms" );

        return DriverManager.getConnection( url, propriedades );
    }

}
