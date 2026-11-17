package br.com.webhook.api;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.sql.SQLException;
import java.util.HashMap;
import java.util.Map;

import br.com.webhook.administracao.AdministracaoService;
import br.com.webhook.configuracao.ConfiguracaoPermanente;
import br.com.webhook.seguranca.AutenticacaoService;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

public class AdministracaoServlet extends HttpServlet {

    private static final long serialVersionUID = 1L;

    @Override
    protected void doGet( HttpServletRequest request, HttpServletResponse response ) throws IOException { atender( request, response, false ); }

    @Override
    protected void doPost( HttpServletRequest request, HttpServletResponse response ) throws IOException { atender( request, response, true ); }

    private void atender( HttpServletRequest request, HttpServletResponse response, boolean escrita ) throws IOException {

        response.setCharacterEncoding( StandardCharsets.UTF_8.name() );
        response.setContentType( "application/json" );
        response.setHeader( "Cache-Control", "no-store" );
        response.setHeader( "X-Content-Type-Options", "nosniff" );
        String agente = request.getHeader( "User-Agent" );
        if( agente == null || agente.isBlank() || agente.length() > 4096 ) {
            AutenticacaoServlet.erro( response, 400, "USER_AGENT_OBRIGATORIO", "Informe um User-Agent válido." );
            return;
        }
        if( !AutenticacaoServlet.transportePermitido( request ) ) {
            AutenticacaoServlet.erro( response, 403, "HTTPS_OBRIGATORIO", "Use HTTPS para acessar a administração." );
            return;
        }
        if( escrita && ( !"1".equals( request.getHeader( "X-Webhook-Admin" ) ) || "cross-site".equals( request.getHeader( "Sec-Fetch-Site" ) ) ) ) {
            AutenticacaoServlet.erro( response, 403, "ORIGEM_NAO_PERMITIDA", "Requisição administrativa não permitida." );
            return;
        }

        var config = (ConfiguracaoPermanente) getServletContext().getAttribute( ConfiguracaoPermanente.ATRIBUTO_CONTEXTO );
        if( config == null ) {
            AutenticacaoServlet.erro( response, 503, "INSTALACAO_INDISPONIVEL", "A instalação não está disponível." );
            return;
        }
        String token = AutenticacaoServlet.token( request );
        if( token == null || !token.matches( "[A-Za-z0-9_-]{43}" ) ) {
            AutenticacaoServlet.erro( response, 401, "SESSAO_INVALIDA", "Entre novamente para acessar a administração." );
            return;
        }
        String caminho = request.getPathInfo();
        String operacao = caminho != null && caminho.startsWith( "/" ) ? caminho.substring( 1 ) : "";
        if( !operacao.matches( escrita ? "administradores|configuracao" : "resumo|estatisticas|transacoes|transacao|administradores|atividade|configuracao" ) ) {
            AutenticacaoServlet.erro( response, 404, "OPERACAO_INEXISTENTE", "Operação não encontrada." );
            return;
        }

        try {
            Map<String, String> campos = escrita ? AutenticacaoServlet.lerFormulario( request, 12 ) : parametros( request );
            AdministracaoService servico = new AdministracaoService( config );
            Object resultado = escrita ? servico.salvar( token, operacao, campos, request.getRemoteAddr() ) : servico.consultar( token, operacao, campos );
            response.getWriter().write( Json.escrever( resultado ) );
        } catch ( AutenticacaoService.Falha erro ) {
            boolean troca = "TROCA_SENHA_OBRIGATORIA".equals( erro.getMessage() );
            boolean invalida = "REQUISICAO_INVALIDA".equals( erro.getMessage() );
            AutenticacaoServlet.erro( response, invalida ? 400 : troca ? 403 : 401, erro.getMessage(), invalida ? "Confira os campos informados." : troca ? "Altere sua senha inicial antes de continuar." : "Sua sessão expirou ou foi encerrada. Entre novamente." );
        } catch ( AdministracaoService.Validacao erro ) {
            AutenticacaoServlet.erro( response, erro.conflito() ? 409 : 400, erro.conflito() ? "CONFLITO_EDICAO" : "DADOS_INVALIDOS", erro.getMessage() );
        } catch ( SQLException erro ) {
            if( "23505".equals( erro.getSQLState() ) ) {
                AutenticacaoServlet.erro( response, 409, "REGISTRO_DUPLICADO", "Já existe um cadastro com esses dados." );
            } else {
                getServletContext().log( "Webhook: falha tecnica no painel administrativo." );
                AutenticacaoServlet.erro( response, 503, "ADMINISTRACAO_INDISPONIVEL", "Não foi possível concluir a operação. Tente novamente." );
            }
        } catch ( Exception erro ) {
            getServletContext().log( "Webhook: falha tecnica no painel administrativo." );
            AutenticacaoServlet.erro( response, 503, "ADMINISTRACAO_INDISPONIVEL", "Não foi possível concluir a operação. Tente novamente." );
        }
    }

    private static Map<String, String> parametros( HttpServletRequest request ) throws AdministracaoService.Validacao {

        String query = request.getQueryString();
        if( query != null && query.length() > 4096 ) throw new AdministracaoService.Validacao( "Filtros muito extensos." );
        Map<String, String> parametros = new HashMap<>();
        for( var entrada : request.getParameterMap().entrySet() ) {
            if( entrada.getValue().length != 1 || parametros.size() >= 10 ) throw new AdministracaoService.Validacao( "Filtros inválidos." );
            parametros.put( entrada.getKey(), entrada.getValue()[ 0 ] );
        }

        return parametros;
    }
}
