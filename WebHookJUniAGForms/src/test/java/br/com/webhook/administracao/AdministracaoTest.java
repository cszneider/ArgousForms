package br.com.webhook.administracao;

import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.Executors;

import br.com.webhook.api.Json;
import br.com.webhook.configuracao.ConfiguracaoPermanente;
import br.com.webhook.configuracao.InstalacaoBanco;
import br.com.webhook.seguranca.AutenticacaoService;

/** Somente database descartável local, nunca usa configuração ou dados da instalação. */
public final class AdministracaoTest {

    private static final String DATABASE = "webhook_instalacao_teste";
    private static final String SENHA = "SenhaDeTesteSegura!123";
    private static Connection banco;
    private static AdministracaoService servico;
    private static AutenticacaoService auth;
    private static String token;

    public static void main( String[] args ) throws Exception {

        String porta = System.getenv( "WEBHOOK_TEST_PORT" );
        checar( porta != null && porta.matches( "[0-9]{1,5}" ), "Porta do banco descartavel ausente." );
        Class.forName( "org.postgresql.Driver" );
        Path pasta = Files.createTempDirectory( "webhook-painel-teste-" );
        try ( Connection conexao = DriverManager.getConnection( "jdbc:postgresql://127.0.0.1:" + porta + "/" + DATABASE, "instalador", "SomenteTesteLocal_2026" ) ) {
            banco = conexao;
            checar( DATABASE.equals( banco.getCatalog() ), "Database de teste incorreto." );
            sql( "DROP SCHEMA IF EXISTS agforms CASCADE" );
            Files.writeString( pasta.resolve( "startup.xml" ), "<startup><instituicao><nome>Instituicao Teste</nome><fusoHorario>America/Sao_Paulo</fusoHorario></instituicao><administrador><email>primeiro@example.com</email><nome>Primeiro</nome><senha>" + SENHA + "</senha></administrador><postgres><endIP>127.0.0.1</endIP><nroPorta>" + porta + "</nroPorta><database>" + DATABASE + "</database><dbUser>instalador</dbUser><dbPasswd>SomenteTesteLocal_2026</dbPasswd></postgres></startup>" );
            ConfiguracaoPermanente config = ConfiguracaoPermanente.carregarOuCriar( pasta );
            InstalacaoBanco.inicializar( config, pasta );
            auth = new AutenticacaoService( config );
            servico = new AdministracaoService( config );
            token = auth.entrar( "primeiro@example.com", SENHA.toCharArray(), "127.0.0.1", "Teste" ).token();
            for( String pagina : List.of( "resumo", "estatisticas", "transacoes", "atividade", "administradores", "configuracao" ) ) {
                try {
                    servico.consultar( token, pagina, Map.of() );
                    throw new AssertionError( "Troca obrigatoria burlada." );
                } catch ( AutenticacaoService.Falha esperado ) {
                    checar( "TROCA_SENHA_OBRIGATORIA".equals( esperado.getMessage() ), "Falha inesperada." );
                }
            }
            auth.alterarSenha( token, SENHA.toCharArray(), "SenhaNovaDeTeste!456".toCharArray(), "SenhaNovaDeTeste!456".toCharArray(), "127.0.0.1" );
            testarEstatisticas();
            testarConfiguracao();
            testarAdministradores();
            sql( "DROP SCHEMA agforms CASCADE" );
            System.out.println( "Administracao: estatisticas, fuso, filtros, paginacao, auditoria, revisoes, rollback e protecao concorrente do ultimo administrador aprovados." );
        } finally {
            try ( var caminhos = Files.walk( pasta ) ) {
                for( Path caminho : caminhos.sorted( Comparator.reverseOrder() ).toList() ) Files.delete( caminho );
            }
        }
    }

    private static void testarEstatisticas() throws Exception {

        Map<String, String> periodo = Map.of( "inicio", "2026-11-15", "fim", "2026-11-16" );
        Map<String, Object> resumo = mapa( servico.consultar( token, "resumo", periodo ) );
        checar( valor( mapa( resumo.get( "metricas" ) ), "total" ) == 0, "Resumo vazio incorreto." );
        checar( mapa( resumo.get( "metricas" ) ).get( "tempoMedioMs" ) == null, "Media vazia virou zero." );
        inserirTransacao( "2026-11-16T02:30:00Z", "O", 100, "DADOS_FUNCIONARIO" );
        inserirTransacao( "2026-11-16T03:30:00Z", "F", 300, "DADOS_FUNCIONARIO" );
        inserirTransacao( "2026-11-17T02:59:00Z", "N", 200, "OUTRA_CONSULTA" );
        inserirTransacao( "2026-11-17T03:00:00Z", "O", 400, "FORA_DO_PERIODO" );
        resumo = mapa( servico.consultar( token, "estatisticas", periodo ) );
        Map<String, Object> metricas = mapa( resumo.get( "metricas" ) );
        checar( valor( metricas, "total" ) == 3 && valor( metricas, "sucessos" ) == 1 && valor( metricas, "falhas" ) == 1 && valor( metricas, "naoEncontrados" ) == 1, "Totais incorretos." );
        checar( ( (Number) metricas.get( "tempoMedioMs" ) ).doubleValue() == 200, "Media incorreta." );
        var dias = lista( resumo.get( "dias" ) );
        checar( dias.size() == 2 && "2026-11-15".equals( dias.get( 0 ).get( "dia" ) ) && valor( dias.get( 0 ), "total" ) == 1, "Agrupamento ignorou fuso." );
        var horas = lista( resumo.get( "horas" ) );
        checar( valor( horas.get( 0 ), "hora" ) == 0 && valor( horas.get( 1 ), "hora" ) == 23 && valor( horas.get( 1 ), "total" ) == 2, "Horas incorretas." );
        Map<String, String> filtro = new HashMap<>( periodo );
        filtro.put( "codigo", "DADOS_FUNCIONARIO" );
        filtro.put( "resultado", "F" );
        var consulta = mapa( servico.consultar( token, "transacoes", filtro ) );
        checar( valor( consulta, "total" ) == 1, "Filtros nao aplicados." );
        String id = lista( consulta.get( "itens" ) ).get( 0 ).get( "id" ).toString();
        checar( "F".equals( mapa( servico.consultar( token, "transacao", Map.of( "id", id ) ) ).get( "resultado" ) ), "Detalhe incorreto." );
        filtro.put( "codigo", "' OR 1=1 --" );
        checar( valor( mapa( servico.consultar( token, "transacoes", filtro ) ), "total" ) == 0, "Filtro SQL nao parametrizado." );
        for( int i = 0; i < 22; i++ ) inserirTransacao( "2026-11-16T12:00:00Z", "O", 10, "PAGINACAO" );
        var pagina = mapa( servico.consultar( token, "transacoes", periodo ) );
        checar( valor( pagina, "total" ) == 25 && lista( pagina.get( "itens" ) ).size() == 20, "Paginacao incorreta." );
        filtro = new HashMap<>( periodo );
        filtro.put( "pagina", "1" );
        checar( lista( mapa( servico.consultar( token, "transacoes", filtro ) ).get( "itens" ) ).size() == 5, "Segunda pagina incorreta." );
        invalida( () -> servico.consultar( token, "resumo", Map.of( "inicio", "2020-01-01", "fim", "2026-01-01" ) ) );
    }

    private static void testarConfiguracao() throws Exception {

        Map<String, Object> atual = mapa( servico.consultar( token, "configuracao", Map.of() ) );
        Map<String, String> campos = camposConfig( atual );
        campos.put( "fusoHorario", "UTC" );
        campos.put( "validadeSessaoMinutos", "120" );
        campos.put( "retencaoTransacoesDias", "90" );
        var salvo = mapa( servico.salvar( token, "configuracao", campos, "127.0.0.1" ) );
        checar( "UTC".equals( salvo.get( "fusoHorario" ) ) && valor( salvo, "validadeSessaoMinutos" ) == 120, "Configuracao nao salva." );
        try {
            servico.salvar( token, "configuracao", campos, "127.0.0.1" );
            throw new AssertionError( "Revisao antiga aceita." );
        } catch ( AdministracaoService.Validacao erro ) {
            checar( erro.conflito(), "Conflito nao identificado." );
        }
        campos = camposConfig( salvo );
        campos.put( "validadeSessaoMinutos", "10" );
        Map<String, String> invalidos = campos;
        invalida( () -> servico.salvar( token, "configuracao", invalidos, "127.0.0.1" ) );
        campos = camposConfig( salvo );
        campos.put( "fusoHorario", "Fuso/Inexistente" );
        Map<String, String> fusoInvalido = campos;
        invalida( () -> servico.salvar( token, "configuracao", fusoInvalido, "127.0.0.1" ) );
        String auditoria = Json.escrever( servico.consultar( token, "atividade", Map.of( "acao", "9" ) ) );
        checar( auditoria.contains( "anterior" ) && auditoria.contains( "atual" ) && !auditoria.contains( "dbPasswd" ), "Auditoria da configuracao incorreta." );
    }

    private static void testarAdministradores() throws Exception {

        Map<String, Object> primeiro = admins().get( 0 );
        Map<String, String> desativar = editar( primeiro );
        desativar.put( "ativo", "false" );
        invalida( () -> servico.salvar( token, "administradores", desativar, "127.0.0.1" ) );
        auth.consultarSessao( token, false );
        Map<String, String> novo = new HashMap<>( Map.of( "nome", "Segundo", "email", "SEGUNDO@EXAMPLE.COM", "ativo", "true", "senhaTemporaria", SENHA ) );
        String idSegundo = mapa( servico.salvar( token, "administradores", novo, "127.0.0.1" ) ).get( "id" ).toString();
        var segundo = admins().stream().filter( item -> idSegundo.equals( item.get( "id" ).toString() ) ).findFirst().orElseThrow();
        checar( Boolean.TRUE.equals( segundo.get( "trocarSenha" ) ) && "segundo@example.com".equals( segundo.get( "email" ) ), "Nova conta incorreta." );
        checar( !Json.escrever( admins() ).contains( "senha_hash" ), "Hash exposto." );
        invalida( () -> servico.salvar( token, "administradores", novo, "127.0.0.1" ) );
        var alteracao = editar( segundo );
        alteracao.put( "nome", "Segundo atualizado" );
        servico.salvar( token, "administradores", alteracao, "127.0.0.1" );
        Map<String, String> revisaoAntiga = new HashMap<>( alteracao );
        invalida( () -> servico.salvar( token, "administradores", revisaoAntiga, "127.0.0.1" ) );
        var loginSegundo = auth.entrar( "segundo@example.com", SENHA.toCharArray(), "127.0.0.1", "Teste" );
        segundo = admins().stream().filter( item -> idSegundo.equals( item.get( "id" ).toString() ) ).findFirst().orElseThrow();
        alteracao = editar( segundo );
        alteracao.put( "ativo", "false" );
        sql( "ALTER TABLE agforms.acoes_administrativas ADD CONSTRAINT teste_falha_desativacao CHECK (cd_acao <> '6') NOT VALID" );
        try {
            servico.salvar( token, "administradores", alteracao, "127.0.0.1" );
            throw new AssertionError( "Falha de auditoria nao reverteu desativacao." );
        } catch ( java.sql.SQLException esperado ) {
            checar( "23514".equals( esperado.getSQLState() ), "Falha injetada nao ocorreu." );
        }
        sql( "ALTER TABLE agforms.acoes_administrativas DROP CONSTRAINT teste_falha_desativacao" );
        auth.consultarSessao( loginSegundo.token(), true );
        servico.salvar( token, "administradores", alteracao, "127.0.0.1" );
        try {
            auth.consultarSessao( loginSegundo.token(), true );
            throw new AssertionError( "Desativacao nao revogou sessao." );
        } catch ( AutenticacaoService.Falha esperado ) { /* Sessão revogada. */ }
        segundo = admins().stream().filter( item -> idSegundo.equals( item.get( "id" ).toString() ) ).findFirst().orElseThrow();
        alteracao = editar( segundo );
        alteracao.put( "ativo", "true" );
        servico.salvar( token, "administradores", alteracao, "127.0.0.1" );
        var novoLogin = auth.entrar( "segundo@example.com", SENHA.toCharArray(), "127.0.0.1", "Teste" );
        auth.alterarSenha( novoLogin.token(), SENHA.toCharArray(), "SenhaDoSegundo!456".toCharArray(), "SenhaDoSegundo!456".toCharArray(), "127.0.0.1" );
        List<Map<String, Object>> contas = admins();
        Map<String, Object> a = contas.stream().filter( item -> item.get( "email" ).equals( "primeiro@example.com" ) ).findFirst().orElseThrow();
        Map<String, Object> b = contas.stream().filter( item -> item.get( "email" ).equals( "segundo@example.com" ) ).findFirst().orElseThrow();
        try ( var executor = Executors.newVirtualThreadPerTaskExecutor() ) {
            var primeiroResultado = executor.submit( () -> desativarProprio( token, a ) );
            var segundoResultado = executor.submit( () -> desativarProprio( novoLogin.token(), b ) );
            checar( primeiroResultado.get() != segundoResultado.get(), "Protecao concorrente do ultimo administrador falhou." );
        }
        try ( var comando = banco.createStatement(); var resultado = comando.executeQuery( "SELECT count(*) FROM agforms.administradores WHERE sn_ativo" ) ) {
            resultado.next();
            checar( resultado.getInt( 1 ) == 1, "Numero de administradores ativos incorreto." );
        }
    }

    private static boolean desativarProprio( String tokenAtual, Map<String, Object> conta ) throws Exception {

        var campos = editar( conta );
        campos.put( "ativo", "false" );
        try {
            servico.salvar( tokenAtual, "administradores", campos, "127.0.0.1" );
            return true;
        } catch ( AdministracaoService.Validacao erro ) {
            checar( erro.getMessage().contains( "último administrador" ), "Falha concorrente inesperada." );
            return false;
        }
    }

    private static Map<String, String> camposConfig( Map<String, Object> dados ) {

        Map<String, String> campos = new HashMap<>();
        for( String chave : List.of( "fusoHorario", "validadeSessaoMinutos", "retencaoTransacoesDias", "retencaoAcoesDias", "retencaoSessoesDias", "revisao" ) ) campos.put( chave, dados.get( chave ).toString() );
        return campos;
    }

    private static Map<String, String> editar( Map<String, Object> conta ) {

        Map<String, String> campos = new HashMap<>();
        for( String chave : List.of( "id", "nome", "email", "ativo", "revisao" ) ) campos.put( chave, conta.get( chave ).toString() );
        return campos;
    }

    private static List<Map<String, Object>> admins() throws Exception { return lista( mapa( servico.consultar( token, "administradores", Map.of() ) ).get( "itens" ) ); }

    private static void inserirTransacao( String inicio, String resultado, int duracao, String codigo ) throws Exception {

        try ( var comando = banco.prepareStatement( "INSERT INTO agforms.transacoes (id_transacao, id_requisicao, cd_consulta, dt_inicio, dt_fim, nr_duracao_ms, tp_resultado, ds_ip_origem) VALUES (?, ?, ?, ?::timestamptz, ?::timestamptz + INTERVAL '1 second', ?, ?, '127.0.0.1')" ) ) {
            comando.setObject( 1, UUID.randomUUID() );
            comando.setObject( 2, UUID.randomUUID() );
            comando.setString( 3, codigo );
            comando.setString( 4, inicio );
            comando.setString( 5, inicio );
            comando.setInt( 6, duracao );
            comando.setString( 7, resultado );
            comando.executeUpdate();
        }
    }

    private static void sql( String sql ) throws Exception {
        try ( var comando = banco.createStatement() ) { comando.execute( sql ); }
    }

    private static void invalida( Acao acao ) throws Exception {

        try { acao.executar(); throw new AssertionError( "Operacao invalida aceita." ); }
        catch ( AdministracaoService.Validacao esperado ) { /* Rejeição esperada. */ }
    }

    @SuppressWarnings( "unchecked" )
    private static Map<String, Object> mapa( Object objeto ) { return (Map<String, Object>) objeto; }
    @SuppressWarnings( "unchecked" )
    private static List<Map<String, Object>> lista( Object objeto ) { return (List<Map<String, Object>>) objeto; }
    private static long valor( Map<String, Object> mapa, String chave ) { return ( (Number) mapa.get( chave ) ).longValue(); }
    private static void checar( boolean condicao, String mensagem ) { if( !condicao ) throw new AssertionError( mensagem ); }
    @FunctionalInterface
    private interface Acao { void executar() throws Exception; }
}
