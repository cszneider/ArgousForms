package br.com.webhook.api;

import java.io.IOException;
import java.nio.charset.StandardCharsets;

import br.com.webhook.configuracao.ConfiguracaoPermanente;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

public class InicializacaoServlet extends HttpServlet {

    private static final long serialVersionUID = 1L;

    @Override
    protected void doGet( HttpServletRequest request, HttpServletResponse response ) throws IOException {

        response.setCharacterEncoding( StandardCharsets.UTF_8.name() );
        response.setContentType( "application/json" );
        response.setHeader( "Cache-Control", "no-store" );
        response.setHeader( "X-Content-Type-Options", "nosniff" );

        String agente = request.getHeader( "User-Agent" );
        if( agente == null || agente.isBlank() ) {
            response.setStatus( HttpServletResponse.SC_BAD_REQUEST );
            response.getWriter().write( "{\"codigo\":\"USER_AGENT_OBRIGATORIO\"}" );
            return;
        }

        var configuracao = (ConfiguracaoPermanente) getServletContext().getAttribute( ConfiguracaoPermanente.ATRIBUTO_CONTEXTO );
        if( configuracao == null ) {
            response.setStatus( HttpServletResponse.SC_SERVICE_UNAVAILABLE );
            response.getWriter().write( "{\"codigo\":\"CONFIGURACAO_INICIAL_INDISPONIVEL\"}" );
            return;
        }

        String nome = configuracao.nomeInstituicao();
        String nomeJson = nome.replace( "\\", "\\\\" ).replace( "\"", "\\\"" );
        response.getWriter().write( "{\"nomeInstituicao\":\"" + nomeJson + "\"}" );
    }
}
