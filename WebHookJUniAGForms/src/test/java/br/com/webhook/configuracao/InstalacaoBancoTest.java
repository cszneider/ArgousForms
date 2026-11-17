package br.com.webhook.configuracao;

import java.lang.reflect.Proxy;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.sql.Connection;
import java.sql.DriverManager;
import java.util.ArrayList;
import java.util.Base64;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.Executors;

import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.PBEKeySpec;

import jakarta.servlet.ServletContext;
import jakarta.servlet.ServletContextEvent;

/** Integração somente com PostgreSQL descartável local: nunca lê credenciais de instalação. */
public final class InstalacaoBancoTest {

    private static final String DATABASE = "webhook_instalacao_teste";
    private static final String SENHA_INICIAL = "TemporariaDeTeste!123";
    private static String porta;

    public static void main( String[] args ) throws Exception {

        porta = System.getenv( "WEBHOOK_TEST_PORT" );
        if( porta == null || !porta.matches( "[0-9]{1,5}" ) ) {
            throw new IllegalStateException( "Defina WEBHOOK_TEST_PORT para o PostgreSQL descartavel local." );
        }
        Class.forName( "org.postgresql.Driver" );

        Path raiz = Files.createTempDirectory( "webhook-instalacao-teste-" );
        try ( Connection conexao = conectar() ) {
            checar( !booleano( conexao, "SELECT rolsuper FROM pg_roles WHERE rolname = current_user" ), "Teste deve usar usuario sem SUPERUSER." );
            limpar( conexao );

            if( args.length == 1 && "rollback".equals( args[ 0 ] ) ) {
                Contexto contexto = contexto( raiz.resolve( "rollback" ) );
                iniciar( contexto );
                checar( contexto.atributos.isEmpty(), "Falha liberou a aplicacao." );
                checar( Files.exists( contexto.diretorio.resolve( "startup.xml" ) ), "Falha apagou startup." );
                checar( !existeSchema( conexao ), "DDL nao foi revertido." );
                checar( contexto.logs.stream().anyMatch( linha -> linha.contains( "INCLUSAO_CONFIGURACAO" ) && linha.contains( "23514" ) ), "Falha injetada nao ocorreu na carga." );
                System.out.println( "InstalacaoBanco: rollback real de DDL e carga aprovado; startup preservado." );
                return;
            }

            Contexto primeira = contexto( raiz.resolve( "primeira" ) );
            iniciar( primeira );
            pronta( primeira );
            checar( !Files.exists( primeira.diretorio.resolve( "startup.xml" ) ), "Startup nao removido apos commit." );
            checar( numero( conexao, "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'agforms'" ) == 5, "Tabelas ausentes." );
            checar( numero( conexao, "SELECT count(*) FROM agforms.administradores" ) == 1, "Administrador ausente." );
            checar( booleano( conexao, "SELECT sn_trocar_senha AND sn_ativo FROM agforms.administradores" ), "Flags iniciais incorretas." );
            checar( !booleano( conexao, "SELECT sn_recebimento_ativo FROM agforms.configuracao" ), "Recebimento inicial nao suspenso." );
            checar( numero( conexao, "SELECT nr_minutos_validade_sessao FROM agforms.configuracao" ) == 43200, "Default do DDL nao respeitado." );
            try ( var comando = conexao.createStatement(); var resultado = comando.executeQuery( "SELECT cd_senha_hash, cd_email FROM agforms.administradores" ) ) {
                resultado.next();
                validarHash( resultado.getString( 1 ) );
                checar( "administrador@example.com".equals( resultado.getString( 2 ) ), "Email nao normalizado." );
            }

            try ( var comando = conexao.createStatement() ) {
                comando.executeUpdate( "UPDATE agforms.administradores SET ds_nome = 'Nome preservado', cd_senha_hash = 'hash-alterado-no-teste'" );
            }
            Contexto reinicio = new Contexto( primeira.diretorio );
            iniciar( reinicio );
            pronta( reinicio );
            checar( booleano( conexao, "SELECT ds_nome = 'Nome preservado' AND cd_senha_hash = 'hash-alterado-no-teste' FROM agforms.administradores" ), "Reinicio sobrescreveu a conta." );
            checar( numero( conexao, "SELECT count(*) FROM agforms.administradores" ) == 1, "Reinicio duplicou administrador." );

            limpar( conexao );
            Contexto simultaneaA = contexto( raiz.resolve( "simultanea" ) );
            Contexto simultaneaB = new Contexto( simultaneaA.diretorio );
            try ( var executor = Executors.newVirtualThreadPerTaskExecutor() ) {
                var a = executor.submit( () -> iniciar( simultaneaA ) );
                var b = executor.submit( () -> iniciar( simultaneaB ) );
                a.get();
                b.get();
            }
            pronta( simultaneaA );
            pronta( simultaneaB );
            checar( numero( conexao, "SELECT count(*) FROM agforms.administradores" ) == 1, "Inicializacoes concorrentes duplicaram carga." );

            limpar( conexao );
            try ( var comando = conexao.createStatement() ) {
                comando.execute( "CREATE SCHEMA agforms" );
            }
            Contexto parcial = contexto( raiz.resolve( "parcial" ) );
            iniciar( parcial );
            checar( parcial.atributos.isEmpty(), "Estrutura parcial aceita." );
            checar( Files.exists( parcial.diretorio.resolve( "startup.xml" ) ), "Estrutura parcial apagou startup." );
            checar( existeSchema( conexao ), "Schema existente foi apagado." );
            checar( numero( conexao, "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'agforms'" ) == 0, "Estrutura parcial foi alterada." );

            limpar( conexao );
            Contexto semStartup = new Contexto( primeira.diretorio );
            iniciar( semStartup );
            checar( semStartup.atributos.isEmpty() && !existeSchema( conexao ), "Instalacao sem administrador inicial foi aceita." );
            System.out.println( "InstalacaoBanco: carga real, hash, reinicio, concorrencia e estrutura parcial aprovados." );
        } finally {
            try ( Connection conexao = conectar() ) {
                limpar( conexao );
            }
            try ( var caminhos = Files.walk( raiz ) ) {
                for( Path caminho : caminhos.sorted( Comparator.reverseOrder() ).toList() ) {
                    Files.delete( caminho );
                }
            }
        }
    }

    private static Connection conectar() throws Exception {
        return DriverManager.getConnection( "jdbc:postgresql://127.0.0.1:" + porta + "/" + DATABASE, "instalador", "SomenteTesteLocal_2026" );
    }

    private static void limpar( Connection conexao ) throws Exception {

        checar( DATABASE.equals( conexao.getCatalog() ), "Database descartavel incorreto." );
        try ( var comando = conexao.createStatement() ) {
            comando.execute( "DROP SCHEMA IF EXISTS agforms CASCADE" );
        }
    }

    private static boolean existeSchema( Connection conexao ) throws Exception {
        return booleano( conexao, "SELECT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'agforms')" );
    }

    private static boolean booleano( Connection conexao, String sql ) throws Exception {

        try ( var comando = conexao.createStatement(); var resultado = comando.executeQuery( sql ) ) {
            resultado.next();
            return resultado.getBoolean( 1 );
        }
    }

    private static int numero( Connection conexao, String sql ) throws Exception {

        try ( var comando = conexao.createStatement(); var resultado = comando.executeQuery( sql ) ) {
            resultado.next();
            return resultado.getInt( 1 );
        }
    }

    private static Contexto contexto( Path diretorio ) throws Exception {

        Files.createDirectories( diretorio );
        String xml = "<startup><instituicao><nome>Instituicao de Teste</nome><fusoHorario>America/Sao_Paulo</fusoHorario></instituicao><administrador><email> Administrador@Example.com </email><nome>Administrador de Teste</nome><senha>" + SENHA_INICIAL + "</senha></administrador><postgres><endIP>127.0.0.1</endIP><nroPorta>" + porta + "</nroPorta><database>" + DATABASE + "</database><dbUser>instalador</dbUser><dbPasswd>SomenteTesteLocal_2026</dbPasswd></postgres></startup>";
        Files.writeString( diretorio.resolve( "startup.xml" ), xml );

        return new Contexto( diretorio );
    }

    private static void iniciar( Contexto contexto ) {

        ServletContext servlet = (ServletContext) Proxy.newProxyInstance( ServletContext.class.getClassLoader(), new Class<?>[] { ServletContext.class }, ( proxy, metodo, args ) -> {
            return switch( metodo.getName() ) {
                case "getRealPath" -> contexto.diretorio.toString();
                case "setAttribute" -> contexto.atributos.put( (String) args[ 0 ], args[ 1 ] );
                case "log" -> contexto.logs.add( (String) args[ 0 ] );
                default -> null;
            };
        } );
        new ConfiguracaoListener().contextInitialized( new ServletContextEvent( servlet ) );
    }

    private static void pronta( Contexto contexto ) {

        checar( contexto.atributos.containsKey( ConfiguracaoPermanente.ATRIBUTO_CONTEXTO ), "Listener nao liberou configuracao apos sucesso." );
        for( String log : contexto.logs ) {
            checar( !log.contains( SENHA_INICIAL ) && !log.contains( "SomenteTesteLocal_2026" ) && !log.contains( "administrador@example.com" ), "Dado sensivel em log." );
        }
    }

    private static void validarHash( String hash ) throws Exception {

        String[] partes = hash.split( "\\$" );
        checar( partes.length == 4 && "pbkdf2-sha256".equals( partes[ 0 ] ) && "600000".equals( partes[ 1 ] ), "Formato de hash incorreto." );
        PBEKeySpec especificacao = new PBEKeySpec( SENHA_INICIAL.toCharArray(), Base64.getDecoder().decode( partes[ 2 ] ), 600_000, 256 );
        try {
            byte[] calculado = SecretKeyFactory.getInstance( "PBKDF2WithHmacSHA256" ).generateSecret( especificacao ).getEncoded();
            checar( MessageDigest.isEqual( calculado, Base64.getDecoder().decode( partes[ 3 ] ) ), "Hash nao corresponde a senha inicial." );
        } finally {
            especificacao.clearPassword();
        }
    }

    private static void checar( boolean condicao, String mensagem ) {

        if( !condicao ) {
            throw new AssertionError( mensagem );
        }
    }

    private static final class Contexto {

        final Path diretorio;
        final Map<String, Object> atributos = new HashMap<>();
        final List<String> logs = new ArrayList<>();

        Contexto( Path diretorio ) { this.diretorio = diretorio; }
    }
}
