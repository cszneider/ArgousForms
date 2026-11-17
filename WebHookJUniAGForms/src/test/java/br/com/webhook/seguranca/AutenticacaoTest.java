package br.com.webhook.seguranca;

import java.io.ByteArrayInputStream;
import java.io.PrintWriter;
import java.io.StringWriter;
import java.lang.reflect.Proxy;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import br.com.webhook.api.AutenticacaoServlet;
import br.com.webhook.api.AdministracaoServlet;
import br.com.webhook.configuracao.ConfiguracaoPermanente;
import br.com.webhook.configuracao.InstalacaoBanco;
import jakarta.servlet.ReadListener;
import jakarta.servlet.ServletConfig;
import jakarta.servlet.ServletContext;
import jakarta.servlet.ServletInputStream;
import jakarta.servlet.ServletRequest;
import jakarta.servlet.ServletResponse;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

/** Teste somente contra database descartável local com dados fictícios. */
public final class AutenticacaoTest {

    private static final String DATABASE = "webhook_instalacao_teste";
    private static final String INICIAL = "InicialDeTeste!123";
    private static final String NOVA = "NovaSenhaDeTeste!456";
    private static ConfiguracaoPermanente configuracao;
    private static Connection banco;

    public static void main( String[] args ) throws Exception {

        String porta = System.getenv( "WEBHOOK_TEST_PORT" );
        checar( porta != null && porta.matches( "[0-9]{1,5}" ), "Porta descartavel ausente." );
        Path pasta = Files.createTempDirectory( "webhook-autenticacao-teste-" );
        Class.forName( "org.postgresql.Driver" );
        try ( Connection conexao = DriverManager.getConnection( "jdbc:postgresql://127.0.0.1:" + porta + "/" + DATABASE, "instalador", "SomenteTesteLocal_2026" ) ) {
            banco = conexao;
            limpar();
            String xml = "<startup><instituicao><nome>Instituicao de Teste</nome></instituicao><administrador><email>admin@example.com</email><nome>Administrador</nome><senha>" + INICIAL + "</senha></administrador><postgres><endIP>127.0.0.1</endIP><nroPorta>" + porta + "</nroPorta><database>" + DATABASE + "</database><dbUser>instalador</dbUser><dbPasswd>SomenteTesteLocal_2026</dbPasswd></postgres></startup>";
            Files.writeString( pasta.resolve( "startup.xml" ), xml );
            configuracao = ConfiguracaoPermanente.carregarOuCriar( pasta );
            InstalacaoBanco.inicializar( configuracao, pasta );
            testarServico();
            testarServlet();
            limpar();
            System.out.println( "Autenticacao: login, troca obrigatoria, hash, cookies, CSRF, logout, expiracao, revogacao, limites e rollback aprovados." );
        } finally {
            try ( var caminhos = Files.walk( pasta ) ) {
                for( Path caminho : caminhos.sorted( Comparator.reverseOrder() ).toList() ) Files.delete( caminho );
            }
        }
    }

    private static void testarServico() throws Exception {

        AutenticacaoService servico = new AutenticacaoService( configuracao );
        falha( "CREDENCIAIS_INVALIDAS", () -> servico.entrar( "ausente@example.com", INICIAL.toCharArray(), "127.0.0.1", "Teste" ) );
        falha( "CREDENCIAIS_INVALIDAS", () -> servico.entrar( "admin@example.com", "errada".toCharArray(), "127.0.0.1", "Teste" ) );
        checar( numero( "SELECT count(*) FROM agforms.sessoes_administrativas" ) == 0, "Login invalido criou sessao." );
        var login = servico.entrar( " ADMIN@EXAMPLE.COM ", INICIAL.toCharArray(), "127.0.0.1", "Teste" );
        checar( login.sessao().trocarSenha(), "Troca inicial nao exigida." );
        String hash = texto( "SELECT cd_token_hash FROM agforms.sessoes_administrativas" );
        checar( hash.equals( AutenticacaoService.hashToken( login.token() ) ) && !hash.equals( login.token() ), "Token em claro no banco." );
        checar( !login.toString().contains( login.token() ), "Token no toString." );
        falha( "TROCA_SENHA_OBRIGATORIA", () -> servico.consultarSessao( login.token(), false ) );
        servico.consultarSessao( login.token(), true );
        falha( "SENHA_ATUAL_INVALIDA", () -> servico.alterarSenha( login.token(), "errada".toCharArray(), NOVA.toCharArray(), NOVA.toCharArray(), "127.0.0.1" ) );
        falha( "NOVA_SENHA_INVALIDA", () -> servico.alterarSenha( login.token(), INICIAL.toCharArray(), "fraca".toCharArray(), "fraca".toCharArray(), "127.0.0.1" ) );
        falha( "NOVA_SENHA_INVALIDA", () -> servico.alterarSenha( login.token(), INICIAL.toCharArray(), NOVA.toCharArray(), "diferente".toCharArray(), "127.0.0.1" ) );
        falha( "NOVA_SENHA_INVALIDA", () -> servico.alterarSenha( login.token(), INICIAL.toCharArray(), INICIAL.toCharArray(), INICIAL.toCharArray(), "127.0.0.1" ) );

        var outra = servico.entrar( "admin@example.com", INICIAL.toCharArray(), "127.0.0.1", "Teste" );
        sql( "ALTER TABLE agforms.acoes_administrativas ADD CONSTRAINT teste_falha_auditoria CHECK (cd_acao <> '2') NOT VALID" );
        try {
            servico.alterarSenha( login.token(), INICIAL.toCharArray(), NOVA.toCharArray(), NOVA.toCharArray(), "127.0.0.1" );
            throw new AssertionError( "Falha de auditoria nao impediu troca." );
        } catch ( java.sql.SQLException esperado ) {
            checar( "23514".equals( esperado.getSQLState() ), "Falha de auditoria inesperada." );
        }
        sql( "ALTER TABLE agforms.acoes_administrativas DROP CONSTRAINT teste_falha_auditoria" );
        checar( SenhaAdministrador.verificar( INICIAL.toCharArray(), texto( "SELECT cd_senha_hash FROM agforms.administradores" ) ), "Rollback alterou senha." );
        checar( servico.consultarSessao( outra.token(), true ).trocarSenha(), "Rollback alterou flag ou revogou sessao." );

        checar( !servico.alterarSenha( login.token(), INICIAL.toCharArray(), NOVA.toCharArray(), NOVA.toCharArray(), "127.0.0.1" ).trocarSenha(), "Troca nao liberou conta." );
        servico.consultarSessao( login.token(), false );
        falha( "SESSAO_INVALIDA", () -> servico.consultarSessao( outra.token(), true ) );
        falha( "CREDENCIAIS_INVALIDAS", () -> servico.entrar( "admin@example.com", INICIAL.toCharArray(), "127.0.0.1", "Teste" ) );
        var nova = servico.entrar( "admin@example.com", NOVA.toCharArray(), "127.0.0.1", "Teste" );
        sql( "UPDATE agforms.sessoes_administrativas SET dt_validade = CURRENT_TIMESTAMP - INTERVAL '1 second' WHERE id_sessao = '" + login.sessao().id() + "'" );
        falha( "SESSAO_INVALIDA", () -> servico.consultarSessao( login.token(), false ) );
        sql( "UPDATE agforms.administradores SET sn_ativo = FALSE" );
        falha( "SESSAO_INVALIDA", () -> servico.consultarSessao( nova.token(), false ) );
        falha( "CREDENCIAIS_INVALIDAS", () -> servico.entrar( "admin@example.com", NOVA.toCharArray(), "127.0.0.1", "Teste" ) );
        sql( "UPDATE agforms.administradores SET sn_ativo = TRUE" );
        servico.sair( nova.token(), "127.0.0.1" );
        falha( "SESSAO_INVALIDA", () -> servico.consultarSessao( nova.token(), false ) );
    }

    private static void testarServlet() throws Exception {

        sql( "UPDATE agforms.administradores SET sn_trocar_senha = TRUE" );
        AutenticacaoServlet servlet = servlet();
        Map<String, String> credenciais = Map.of( "email", "admin@example.com", "senha", NOVA );
        checar( chamar( servlet, "POST", "/entrar", credenciais, null, false, true, true, "127.0.0.1" ).status == 403, "POST sem protecao CSRF aceito." );
        checar( chamar( servlet, "POST", "/entrar", credenciais, null, true, true, false, "127.0.0.1" ).status == 400, "Ausencia de User-Agent aceita." );
        checar( chamar( servlet, "POST", "/entrar", credenciais, null, true, false, true, "198.51.100.1" ).status == 403, "HTTP externo aceito." );

        Resposta login = chamar( servlet, "POST", "/entrar", credenciais, null, true, true, true, "127.0.0.1" );
        checar( login.status == 200 && login.corpo.toString().contains( "\"trocarSenha\":true" ), "Login HTTP falhou." );
        Cookie cookie = login.cookies.get( 0 );
        checar( cookie.isHttpOnly() && cookie.getSecure() && "Strict".equals( cookie.getAttribute( "SameSite" ) ) && "/WebHookJUniAGForms".equals( cookie.getPath() ) && cookie.getMaxAge() > 0, "Cookie sem protecoes." );
        checar( !login.corpo.toString().contains( cookie.getValue() ) && !login.corpo.toString().contains( "hash" ), "Segredo no JSON." );
        checar( chamar( servlet, "GET", "/administracao", Map.of(), cookie, true, true, true, "127.0.0.1" ).status == 403, "Troca obrigatoria burlada." );
        AdministracaoServlet painel = configurar( new AdministracaoServlet() );
        checar( chamar( painel, "GET", "/configuracao", Map.of(), cookie, true, true, true, "127.0.0.1" ).status == 403, "Painel burlou troca obrigatoria." );
        checar( chamar( servlet(), "GET", "/sessao", Map.of(), cookie, true, true, true, "127.0.0.1" ).status == 200, "Sessao nao sobreviveu a nova instancia do Servlet." );
        Map<String, String> senha = Map.of( "senhaAtual", NOVA, "novaSenha", "SenhaFinalDeTeste!789", "confirmacao", "SenhaFinalDeTeste!789" );
        Resposta troca = chamar( servlet, "POST", "/senha", senha, cookie, true, true, true, "127.0.0.1" );
        checar( troca.status == 200 && troca.corpo.toString().contains( "\"trocarSenha\":false" ), "Troca HTTP falhou." );
        checar( chamar( servlet, "GET", "/administracao", Map.of(), cookie, true, true, true, "127.0.0.1" ).status == 200, "Administracao nao liberada." );
        Resposta configPainel = chamar( painel, "GET", "/configuracao", Map.of(), cookie, true, true, true, "127.0.0.1" );
        checar( configPainel.status == 200 && configPainel.corpo.toString().contains( "fusoHorario" ) && !configPainel.corpo.toString().contains( "dbPasswd" ), "Configuracao HTTP incorreta." );
        checar( chamar( painel, "GET", "/configuracao", Map.of(), null, true, true, true, "127.0.0.1" ).status == 401, "Painel aceitou acesso anonimo." );
        checar( chamar( painel, "POST", "/configuracao", Map.of(), cookie, false, true, true, "127.0.0.1" ).status == 403, "Painel aceitou POST sem CSRF." );
        checar( chamar( painel, "POST", "/administradores", Map.of(), null, true, true, true, "127.0.0.1" ).status == 401, "Painel aceitou escrita anonima." );
        Resposta saida = chamar( servlet, "POST", "/sair", Map.of(), cookie, true, true, true, "127.0.0.1" );
        checar( saida.status == 204 && saida.cookies.get( 0 ).getMaxAge() == 0, "Logout nao removeu cookie." );
        checar( chamar( servlet, "GET", "/sessao", Map.of(), cookie, true, true, true, "127.0.0.1" ).status == 401, "Cookie revogado aceito." );

        LimiteTentativas limite = new LimiteTentativas();
        for( int i = 0; i < 10; i++ ) checar( limite.permitir( "127.0.0.1" ), "Limite prematuro." );
        checar( !limite.permitir( "127.0.0.1" ) && limite.permitir( "127.0.0.2" ), "Limite por IP incorreto." );
    }

    private static AutenticacaoServlet servlet() throws Exception {
        return configurar( new AutenticacaoServlet() );
    }

    private static <T extends jakarta.servlet.http.HttpServlet> T configurar( T servlet ) throws Exception {

        ServletContext contexto = (ServletContext) Proxy.newProxyInstance( ServletContext.class.getClassLoader(), new Class<?>[] { ServletContext.class }, ( proxy, metodo, args ) -> {
            if( "getAttribute".equals( metodo.getName() ) ) return configuracao;
            return null;
        } );
        ServletConfig config = (ServletConfig) Proxy.newProxyInstance( ServletConfig.class.getClassLoader(), new Class<?>[] { ServletConfig.class }, ( proxy, metodo, args ) -> "getServletContext".equals( metodo.getName() ) ? contexto : null );
        servlet.init( config );

        return servlet;
    }

    private static Resposta chamar( jakarta.servlet.http.HttpServlet servlet, String metodo, String caminho, Map<String, String> campos, Cookie cookie, boolean csrf, boolean seguro, boolean agente, String ip ) throws Exception {

        StringBuilder corpo = new StringBuilder();
        campos.forEach( ( chave, valor ) -> corpo.append( corpo.isEmpty() ? "" : "&" ).append( URLEncoder.encode( chave, StandardCharsets.UTF_8 ) ).append( '=' ).append( URLEncoder.encode( valor, StandardCharsets.UTF_8 ) ) );
        ByteArrayInputStream entrada = new ByteArrayInputStream( corpo.toString().getBytes( StandardCharsets.UTF_8 ) );
        ServletInputStream stream = new ServletInputStream() {
            @Override
            public int read() { return entrada.read(); }
            @Override
            public boolean isFinished() { return entrada.available() == 0; }
            @Override
            public boolean isReady() { return true; }
            @Override
            public void setReadListener( ReadListener listener ) { throw new UnsupportedOperationException(); }
        };
        HttpServletRequest request = (HttpServletRequest) Proxy.newProxyInstance( HttpServletRequest.class.getClassLoader(), new Class<?>[] { HttpServletRequest.class }, ( proxy, membro, args ) -> switch( membro.getName() ) {
            case "getMethod" -> metodo;
            case "getPathInfo" -> caminho;
            case "getParameterMap" -> Map.of();
            case "getHeader" -> "User-Agent".equals( args[ 0 ] ) ? ( agente ? "Teste" : null ) : "X-Webhook-Admin".equals( args[ 0 ] ) && csrf ? "1" : null;
            case "getRemoteAddr" -> ip;
            case "getServerName" -> ip.startsWith( "127." ) ? "localhost" : "erp.example.com";
            case "isSecure" -> seguro;
            case "getCookies" -> cookie == null ? null : new Cookie[] { cookie };
            case "getContextPath" -> "/WebHookJUniAGForms";
            case "getContentType" -> "application/x-www-form-urlencoded;charset=UTF-8";
            case "getInputStream" -> stream;
            default -> null;
        } );
        Resposta retorno = new Resposta();
        HttpServletResponse response = (HttpServletResponse) Proxy.newProxyInstance( HttpServletResponse.class.getClassLoader(), new Class<?>[] { HttpServletResponse.class }, ( proxy, membro, args ) -> {
            switch( membro.getName() ) {
                case "setStatus" -> retorno.status = (int) args[ 0 ];
                case "getWriter" -> { return new PrintWriter( retorno.corpo ); }
                case "addCookie" -> retorno.cookies.add( (Cookie) args[ 0 ] );
                case "setHeader" -> retorno.headers.put( (String) args[ 0 ], (String) args[ 1 ] );
                case "getStatus" -> { return retorno.status; }
            }
            return null;
        } );
        servlet.service( (ServletRequest) request, (ServletResponse) response );

        return retorno;
    }

    private static void falha( String codigo, Acao acao ) throws Exception {

        try {
            acao.executar();
            throw new AssertionError( "Operacao indevida aceita." );
        } catch ( AutenticacaoService.Falha erro ) {
            checar( codigo.equals( erro.getMessage() ), "Codigo de falha inesperado." );
        }
    }

    private static void limpar() throws Exception {

        checar( DATABASE.equals( banco.getCatalog() ), "Database de teste incorreto." );
        sql( "DROP SCHEMA IF EXISTS agforms CASCADE" );
    }

    private static void sql( String sql ) throws Exception {

        try ( var comando = banco.createStatement() ) {
            comando.execute( sql );
        }
    }

    private static int numero( String sql ) throws Exception {

        try ( var comando = banco.createStatement(); var resultado = comando.executeQuery( sql ) ) {
            resultado.next();
            return resultado.getInt( 1 );
        }
    }

    private static String texto( String sql ) throws Exception {

        try ( var comando = banco.createStatement(); var resultado = comando.executeQuery( sql ) ) {
            resultado.next();
            return resultado.getString( 1 );
        }
    }

    private static void checar( boolean condicao, String mensagem ) {

        if( !condicao ) {
            throw new AssertionError( mensagem );
        }
    }

    @FunctionalInterface
    private interface Acao { void executar() throws Exception; }

    private static final class Resposta {

        int status = 200;
        final StringWriter corpo = new StringWriter();
        final List<Cookie> cookies = new ArrayList<>();
        final Map<String, String> headers = new HashMap<>();
    }
}
