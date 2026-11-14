package br.com.unimed.webhook;

import java.io.IOException;
import java.nio.charset.StandardCharsets;

import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

/** Ponto de entrada das consultas enviadas pelo ArgousForms. */
public class WebHookServlet extends HttpServlet {

    private static final long serialVersionUID = 1L;

    @Override
    protected void doPost( HttpServletRequest request, HttpServletResponse response ) throws IOException {

        // A validação HMAC deverá preceder qualquer consulta ao jUni.
        response.setStatus( HttpServletResponse.SC_NOT_IMPLEMENTED );
        response.setCharacterEncoding( StandardCharsets.UTF_8.name() );
        response.setContentType( "application/json" );
        response.setHeader( "Cache-Control", "no-store" );

        response.getWriter().write( "{\"erro\":{\"codigo\":\"WEBHOOK_NAO_IMPLEMENTADO\",\"mensagem\":\"O processamento das consultas ainda nao foi implementado.\"}}" );
    }
}
