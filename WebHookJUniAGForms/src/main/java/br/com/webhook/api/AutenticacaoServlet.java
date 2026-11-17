package br.com.webhook.api;

import java.io.IOException;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.HashMap;
import java.util.Map;

import br.com.webhook.configuracao.ConfiguracaoPermanente;
import br.com.webhook.seguranca.AutenticacaoService;
import br.com.webhook.seguranca.AutenticacaoService.Falha;
import br.com.webhook.seguranca.LimiteTentativas;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

public class AutenticacaoServlet extends HttpServlet {

    private static final long serialVersionUID = 1L;
    private static final String COOKIE = "WH_AGFORMS_SESSAO";
    private final LimiteTentativas limite = new LimiteTentativas();

    @Override
    protected void doGet( HttpServletRequest request, HttpServletResponse response ) throws IOException {
        atender( request, response, false );
    }

    @Override
    protected void doPost( HttpServletRequest request, HttpServletResponse response ) throws IOException {
        atender( request, response, true );
    }

    private void atender( HttpServletRequest request, HttpServletResponse response, boolean escrita ) throws IOException {

        response.setCharacterEncoding( StandardCharsets.UTF_8.name() );
        response.setContentType( "application/json" );
        response.setHeader( "Cache-Control", "no-store" );
        response.setHeader( "X-Content-Type-Options", "nosniff" );

        String agente = request.getHeader( "User-Agent" );
        if( agente == null || agente.isBlank() || agente.length() > 4096 ) {
            erro( response, 400, "USER_AGENT_OBRIGATORIO", "Informe um User-Agent válido." );
            return;
        }
        if( !transportePermitido( request ) ) {
            erro( response, 403, "HTTPS_OBRIGATORIO", "Use HTTPS para acessar a administração." );
            return;
        }
        if( escrita && ( !"1".equals( request.getHeader( "X-Webhook-Admin" ) ) || "cross-site".equals( request.getHeader( "Sec-Fetch-Site" ) ) ) ) {
            erro( response, 403, "ORIGEM_NAO_PERMITIDA", "Requisição administrativa não permitida." );
            return;
        }

        var configuracao = (ConfiguracaoPermanente) getServletContext().getAttribute( ConfiguracaoPermanente.ATRIBUTO_CONTEXTO );
        if( configuracao == null ) {
            erro( response, 503, "INSTALACAO_INDISPONIVEL", "A instalação não está disponível." );
            return;
        }

        AutenticacaoService servico = new AutenticacaoService( configuracao );
        String caminho = request.getPathInfo();
        String token = token( request );
        try {
            if( !escrita && ( "/sessao".equals( caminho ) || "/administracao".equals( caminho ) ) ) {
                responderSessao( response, servico.consultarSessao( token, "/sessao".equals( caminho ) ) );
                return;
            }
            if( !escrita || !( "/entrar".equals( caminho ) || "/senha".equals( caminho ) || "/sair".equals( caminho ) ) ) {
                erro( response, 404, "OPERACAO_INEXISTENTE", "Operação não encontrada." );
                return;
            }
            if( !"/sair".equals( caminho ) && !limite.permitir( request.getRemoteAddr() ) ) {
                response.setHeader( "Retry-After", "300" );
                erro( response, 429, "MUITAS_TENTATIVAS", "Muitas tentativas. Aguarde alguns minutos e tente novamente." );
                return;
            }

            Map<String, String> campos = lerFormulario( request );
            if( "/entrar".equals( caminho ) ) {
                String email = obrigatorio( campos, "email", 100 );
                char[] senha = obrigatorio( campos, "senha", 1024 ).toCharArray();
                try {
                    var login = servico.entrar( email, senha, request.getRemoteAddr(), agente );
                    cookie( request, response, login.token(), (int) Math.min( Integer.MAX_VALUE, Math.max( 1, login.sessao().segundosValidade() ) ) );
                    responderSessao( response, login.sessao() );
                } finally {
                    Arrays.fill( senha, '\0' );
                }
            } else if( "/senha".equals( caminho ) ) {
                char[] atual = obrigatorio( campos, "senhaAtual", 1024 ).toCharArray();
                char[] nova = obrigatorio( campos, "novaSenha", 1024 ).toCharArray();
                char[] confirmacao = obrigatorio( campos, "confirmacao", 1024 ).toCharArray();
                try {
                    responderSessao( response, servico.alterarSenha( token, atual, nova, confirmacao, request.getRemoteAddr() ) );
                } finally {
                    Arrays.fill( atual, '\0' );
                    Arrays.fill( nova, '\0' );
                    Arrays.fill( confirmacao, '\0' );
                }
            } else {
                servico.sair( token, request.getRemoteAddr() );
                cookie( request, response, "", 0 );
                response.setStatus( 204 );
            }
        } catch ( Falha falha ) {
            String codigo = falha.getMessage();
            switch( codigo ) {
                case "CREDENCIAIS_INVALIDAS" -> erro( response, 401, codigo, "E-mail ou senha inválidos." );
                case "SESSAO_INVALIDA" -> {
                    cookie( request, response, "", 0 );
                    erro( response, 401, codigo, "Sua sessão expirou ou foi encerrada. Entre novamente." );
                }
                case "TROCA_SENHA_OBRIGATORIA" -> erro( response, 403, codigo, "Altere sua senha inicial antes de continuar." );
                case "SENHA_ATUAL_INVALIDA" -> erro( response, 400, codigo, "A senha atual está incorreta." );
                case "NOVA_SENHA_INVALIDA" -> erro( response, 400, codigo, "Confirme uma senha diferente da atual, com 8 a 1024 caracteres e pelo menos três categorias: maiúsculas, minúsculas, números e símbolos." );
                default -> erro( response, 400, "REQUISICAO_INVALIDA", "Confira os campos informados." );
            }
        } catch ( Exception falha ) {
            // Não registrar exceções ou parâmetros: podem conter dados pessoais ou credenciais.
            getServletContext().log( "Webhook: falha tecnica no servico de autenticacao." );
            erro( response, 503, "AUTENTICACAO_INDISPONIVEL", "Não foi possível concluir a operação. Tente novamente." );
        }
    }

    private static Map<String, String> lerFormulario( HttpServletRequest request ) throws Exception {
        return lerFormulario( request, 4 );
    }

    static Map<String, String> lerFormulario( HttpServletRequest request, int maximoCampos ) throws Exception {

        String tipo = request.getContentType();
        if( tipo == null || !"application/x-www-form-urlencoded".equalsIgnoreCase( tipo.split( ";", 2 )[ 0 ].strip() ) ) {
            throw new Falha( "REQUISICAO_INVALIDA" );
        }
        byte[] corpo = request.getInputStream().readNBytes( 16385 );
        if( corpo.length > 16384 ) {
            throw new Falha( "REQUISICAO_INVALIDA" );
        }

        Map<String, String> campos = new HashMap<>();
        try {
            String texto = new String( corpo, StandardCharsets.UTF_8 );
            for( String parte : texto.split( "&" ) ) {
                if( parte.isEmpty() ) continue;
                String[] par = parte.split( "=", 2 );
                String chave = URLDecoder.decode( par[ 0 ], StandardCharsets.UTF_8 );
                String valor = par.length == 2 ? URLDecoder.decode( par[ 1 ], StandardCharsets.UTF_8 ) : "";
                if( campos.putIfAbsent( chave, valor ) != null || campos.size() > maximoCampos ) {
                    throw new Falha( "REQUISICAO_INVALIDA" );
                }
            }
        } catch ( IllegalArgumentException erro ) {
            throw new Falha( "REQUISICAO_INVALIDA" );
        } finally {
            Arrays.fill( corpo, (byte) 0 );
        }

        return campos;
    }

    private static String obrigatorio( Map<String, String> campos, String nome, int limite ) throws Falha {

        String valor = campos.get( nome );
        if( valor == null || valor.isEmpty() || valor.length() > limite ) {
            throw new Falha( "REQUISICAO_INVALIDA" );
        }

        return valor;
    }

    static boolean transportePermitido( HttpServletRequest request ) {

        if( request.isSecure() || Boolean.getBoolean( "webhook.http.desenvolvimento" ) ) return true;
        String servidor = request.getServerName();
        String ip = request.getRemoteAddr();

        return ( "localhost".equalsIgnoreCase( servidor ) || "127.0.0.1".equals( servidor ) || "::1".equals( servidor ) || "[::1]".equals( servidor ) )
            && ( "127.0.0.1".equals( ip ) || "::1".equals( ip ) || "0:0:0:0:0:0:0:1".equals( ip ) );
    }

    static String token( HttpServletRequest request ) {

        String encontrado = null;
        Cookie[] cookies = request.getCookies();
        if( cookies == null ) return null;
        for( Cookie cookie : cookies ) {
            if( COOKIE.equals( cookie.getName() ) ) {
                if( encontrado != null ) return null;
                encontrado = cookie.getValue();
            }
        }

        return encontrado;
    }

    private static void cookie( HttpServletRequest request, HttpServletResponse response, String token, int validade ) {

        Cookie cookie = new Cookie( COOKIE, token );
        cookie.setPath( request.getContextPath().isEmpty() ? "/" : request.getContextPath() );
        cookie.setHttpOnly( true );
        cookie.setSecure( request.isSecure() );
        cookie.setAttribute( "SameSite", "Strict" );
        cookie.setMaxAge( validade );
        response.addCookie( cookie );
    }

    private static void responderSessao( HttpServletResponse response, AutenticacaoService.Sessao sessao ) throws IOException {
        response.getWriter().write( "{\"autenticado\":true,\"idAdministrador\":\"" + sessao.administrador() + "\",\"trocarSenha\":" + sessao.trocarSenha() + ",\"nome\":" + json( sessao.nome() ) + ",\"email\":" + json( sessao.email() ) + "}" );
    }

    static void erro( HttpServletResponse response, int status, String codigo, String mensagem ) throws IOException {

        response.setStatus( status );
        response.getWriter().write( "{\"codigo\":" + json( codigo ) + ",\"mensagem\":" + json( mensagem ) + "}" );
    }

    static String json( String texto ) {

        StringBuilder resultado = new StringBuilder( "\"" );
        for( char caractere : texto.toCharArray() ) {
            if( caractere == '"' || caractere == '\\' ) {
                resultado.append( '\\' ).append( caractere );
            } else if( caractere < 32 ) {
                resultado.append( String.format( "\\u%04x", (int) caractere ) );
            } else {
                resultado.append( caractere );
            }
        }

        return resultado.append( '"' ).toString();
    }
}
