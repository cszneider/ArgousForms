package br.com.webhook.configuracao;

import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.Arrays;
import java.util.Locale;
import java.util.UUID;

import br.com.webhook.persistencia.ConexaoBanco;
import br.com.webhook.seguranca.SenhaAdministrador;
import org.w3c.dom.Element;

/** Instala somente a base comum. Não acessa o ERP nem usa Quatro. */
public final class InstalacaoBanco {

    private static final String RECURSO_SQL = "/banco/script_base_webhook.sql";
    private static final long CHAVE_BLOQUEIO = 0x4147464F524D5301L;

    private InstalacaoBanco() {}

    public static boolean inicializar( ConfiguracaoPermanente configuracao, Path diretorio ) throws FalhaInstalacao {

        try {
            Class.forName( "org.postgresql.Driver" );
        } catch ( ClassNotFoundException erro ) {
            throw new FalhaInstalacao( "DRIVER_POSTGRESQL_AUSENTE", null );
        }

        try ( Connection conexao = ConexaoBanco.abrir( configuracao ) ) {
            return instalar( conexao, diretorio );
        } catch ( FalhaInstalacao erro ) {
            throw erro;
        } catch ( Exception erro ) {
            throw falha( "CONEXAO_POSTGRESQL", erro );
        }
    }

    // Recebe uma conexão nova em autocommit e assume a transação completa da instalação.
    static boolean instalar( Connection conexao, Path diretorio ) throws FalhaInstalacao {

        String etapa = "PREPARACAO_TRANSACAO";
        boolean iniciou = false;
        try {
            if( !conexao.getAutoCommit() ) {
                throw new IllegalStateException( "Conexao ja esta em transacao." );
            }
            conexao.setAutoCommit( false );
            iniciou = true;

            etapa = "BLOQUEIO_INSTALACAO";
            try ( var comando = conexao.createStatement() ) {
                comando.execute( "SET LOCAL lock_timeout = '15s'" );
                comando.execute( "SET LOCAL statement_timeout = '30s'" );
            }
            try ( var comando = conexao.prepareStatement( "SELECT pg_advisory_xact_lock(?)" ) ) {
                comando.setLong( 1, CHAVE_BLOQUEIO );
                comando.execute();
            }

            etapa = "VERIFICACAO_SCHEMA";
            if( existeSchema( conexao ) ) {
                etapa = "VERIFICACAO_INSTALACAO_EXISTENTE";
                verificarInstalacao( conexao );
                conexao.commit();
                return false;
            }

            etapa = "LEITURA_ADMINISTRADOR_STARTUP";
            try ( DadosIniciais dados = lerDadosIniciais( diretorio.resolve( "startup.xml" ) ) ) {
                etapa = "HASH_SENHA_INICIAL";
                String hash = gerarHash( dados.senha );
                etapa = "CRIACAO_ESTRUTURA";
                executarScript( conexao );
                UUID administrador = UUID.randomUUID();
                OffsetDateTime agora = OffsetDateTime.now( ZoneOffset.UTC );
                etapa = "INCLUSAO_ADMINISTRADOR";
                inserirAdministrador( conexao, dados, administrador, hash, agora );
                etapa = "INCLUSAO_CONFIGURACAO";
                inserirConfiguracao( conexao, dados.fuso, administrador, agora );
            }

            etapa = "CONFIRMACAO_INSTALACAO";
            conexao.commit();
            return true;
        } catch ( Exception erro ) {
            if( iniciou ) {
                try {
                    conexao.rollback();
                } catch ( SQLException falhaRollback ) {
                    // O startup é preservado. Uma próxima inicialização verificará o banco novamente.
                }
            }
            throw falha( etapa, erro );
        }
    }

    private static boolean existeSchema( Connection conexao ) throws SQLException {

        try ( var comando = conexao.prepareStatement( "SELECT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = ?)" ) ) {
            comando.setString( 1, "agforms" );
            try ( var resultado = comando.executeQuery() ) {
                resultado.next();
                return resultado.getBoolean( 1 );
            }
        }
    }

    private static void verificarInstalacao( Connection conexao ) throws SQLException {

        String sql = "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'agforms' AND table_type = 'BASE TABLE' AND table_name IN ('administradores', 'sessoes_administrativas', 'configuracao', 'transacoes', 'acoes_administrativas')";
        try ( var comando = conexao.createStatement(); var resultado = comando.executeQuery( sql ) ) {
            resultado.next();
            if( resultado.getInt( 1 ) != 5 ) {
                throw new SQLException( "Estrutura incompleta.", "W0001" );
            }
        }

        sql = "SELECT EXISTS (SELECT 1 FROM Agforms.CONFIGURACAO c JOIN Agforms.ADMINISTRADORES a ON a.ID_ADMINISTRADOR = c.ID_ADMINISTRADOR WHERE c.ID_CONFIGURACAO = 1), EXISTS (SELECT 1 FROM Agforms.ADMINISTRADORES WHERE SN_ATIVO)";
        try ( var comando = conexao.createStatement(); var resultado = comando.executeQuery( sql ) ) {
            resultado.next();
            if( !resultado.getBoolean( 1 ) || !resultado.getBoolean( 2 ) ) {
                throw new SQLException( "Carga inicial incompleta.", "W0002" );
            }
        }
    }

    private static void executarScript( Connection conexao ) throws Exception {

        String script;
        try ( InputStream entrada = InstalacaoBanco.class.getResourceAsStream( RECURSO_SQL ) ) {
            if( entrada == null ) {
                throw new IllegalStateException( "Script base ausente." );
            }
            script = new String( entrada.readAllBytes(), StandardCharsets.UTF_8 );
        }

        // O recurso controlado contém somente DDL simples; não contém funções ou literais com ponto e vírgula.
        script = script.replaceAll( "(?m)^\\s*--[^\\r\\n]*", "" );
        try ( var comando = conexao.createStatement() ) {
            for( String sql : script.split( ";" ) ) {
                if( !sql.isBlank() ) comando.execute( sql.strip() );
            }
        }
    }

    private static void inserirAdministrador( Connection conexao, DadosIniciais dados, UUID id, String hash, OffsetDateTime agora ) throws SQLException {

        String sql = "INSERT INTO Agforms.ADMINISTRADORES (ID_ADMINISTRADOR, CD_EMAIL, DS_NOME, CD_SENHA_HASH, SN_TROCAR_SENHA, SN_ATIVO, DT_INCLUSAO, DT_ALTERACAO_SENHA, ID_ADMINISTRADOR_CRIOU) VALUES (?, ?, ?, ?, TRUE, TRUE, ?, ?, NULL)";
        try ( PreparedStatement comando = conexao.prepareStatement( sql ) ) {
            comando.setObject( 1, id );
            comando.setString( 2, dados.email );
            comando.setString( 3, dados.nome );
            comando.setString( 4, hash );
            comando.setObject( 5, agora );
            comando.setObject( 6, agora );
            comando.executeUpdate();
        }
    }

    private static void inserirConfiguracao( Connection conexao, String fuso, UUID administrador, OffsetDateTime agora ) throws SQLException {

        String sql = "INSERT INTO Agforms.CONFIGURACAO (ID_CONFIGURACAO, SN_RECEBIMENTO_ATIVO, CD_FUSO_HORARIO, DT_ALTERACAO, ID_ADMINISTRADOR) VALUES (1, FALSE, ?, ?, ?)";
        try ( PreparedStatement comando = conexao.prepareStatement( sql ) ) {
            comando.setString( 1, fuso );
            comando.setObject( 2, agora );
            comando.setObject( 3, administrador );
            comando.executeUpdate();
        }
    }

    private static DadosIniciais lerDadosIniciais( Path startup ) throws Exception {

        try ( InputStream entrada = Files.newInputStream( startup ) ) {
            Element raiz = ConfiguracaoInicial.lerRaiz( entrada, "startup" );
            Element administrador = ConfiguracaoInicial.filhoUnico( raiz, "administrador" );
            String email = ConfiguracaoInicial.filhoUnico( administrador, "email" ).getTextContent().strip().toLowerCase( Locale.ROOT );
            String nome = ConfiguracaoInicial.filhoUnico( administrador, "nome" ).getTextContent().strip();
            String senha = ConfiguracaoInicial.filhoUnico( administrador, "senha" ).getTextContent();
            if( email.length() > 100 || !email.matches( "[^\\s@]+@[^\\s@]+\\.[^\\s@]+" ) || nome.isEmpty() || nome.length() > 200 || nome.codePoints().anyMatch( Character::isISOControl ) || senha.isBlank() || senha.length() > 1024 ) {
                throw new IllegalArgumentException( "Dados iniciais invalidos." );
            }

            Element instituicao = ConfiguracaoInicial.filhoUnico( raiz, "instituicao" );
            String fuso = "UTC";
            if( instituicao.getElementsByTagName( "fusoHorario" ).getLength() > 0 ) {
                fuso = ConfiguracaoInicial.filhoUnico( instituicao, "fusoHorario" ).getTextContent().strip();
            }
            ZoneId.of( fuso );

            return new DadosIniciais( email, nome, senha.toCharArray(), fuso );
        }
    }

    static String gerarHash( char[] senha ) throws Exception {
        return SenhaAdministrador.gerarHash( senha );
    }

    private static FalhaInstalacao falha( String etapa, Exception erro ) {
        return new FalhaInstalacao( etapa, erro instanceof SQLException sql ? sql.getSQLState() : null );
    }

    public static final class FalhaInstalacao extends Exception {

        private static final long serialVersionUID = 1L;

        FalhaInstalacao( String etapa, String estadoSQL ) {
            super( "etapa=" + etapa + ( estadoSQL != null && estadoSQL.matches( "[A-Z0-9]{5}" ) ? "; SQLSTATE=" + estadoSQL : "" ) );
        }
    }

    private static final class DadosIniciais implements AutoCloseable {

        final String email;
        final String nome;
        final char[] senha;
        final String fuso;

        DadosIniciais( String email, String nome, char[] senha, String fuso ) {
            this.email = email;
            this.nome = nome;
            this.senha = senha;
            this.fuso = fuso;
        }

        @Override
        public void close() { Arrays.fill( senha, '\0' ); }
    }
}
