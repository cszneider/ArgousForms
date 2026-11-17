package br.com.webhook.seguranca;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.sql.Connection;
import java.sql.SQLException;
import java.util.Arrays;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Locale;
import java.util.UUID;

import br.com.webhook.configuracao.ConfiguracaoPermanente;
import br.com.webhook.persistencia.ConexaoBanco;

public final class AutenticacaoService {

    private final ConfiguracaoPermanente configuracao;

    public AutenticacaoService( ConfiguracaoPermanente configuracao ) { this.configuracao = configuracao; }

    public Login entrar( String email, char[] senha, String ip, String agente ) throws Exception {

        return transacao( conexao -> {
            UUID administrador = null;
            String hash = null;
            try ( var comando = conexao.prepareStatement( "SELECT ID_ADMINISTRADOR, CD_SENHA_HASH FROM Agforms.ADMINISTRADORES WHERE CD_EMAIL = ? AND SN_ATIVO FOR UPDATE" ) ) {
                comando.setString( 1, email.strip().toLowerCase( Locale.ROOT ) );
                try ( var resultado = comando.executeQuery() ) {
                    if( resultado.next() ) {
                        administrador = resultado.getObject( 1, UUID.class );
                        hash = resultado.getString( 2 );
                    }
                }
            }

            if( !SenhaAdministrador.verificar( senha, hash ) || administrador == null ) {
                throw new Falha( "CREDENCIAIS_INVALIDAS" );
            }

            byte[] aleatorio = new byte[ 32 ];
            new SecureRandom().nextBytes( aleatorio );
            String token = Base64.getUrlEncoder().withoutPadding().encodeToString( aleatorio );
            UUID sessao = UUID.randomUUID();
            String sql = "INSERT INTO Agforms.SESSOES_ADMINISTRATIVAS (ID_SESSAO, ID_ADMINISTRADOR, CD_TOKEN_HASH, DT_INICIO, DT_ULTIMO_ACESSO, DT_VALIDADE, DS_IP_ORIGEM, DS_USER_AGENT) SELECT ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + NR_MINUTOS_VALIDADE_SESSAO * INTERVAL '1 minute', ?::inet, ? FROM Agforms.CONFIGURACAO WHERE ID_CONFIGURACAO = 1";
            try ( var comando = conexao.prepareStatement( sql ) ) {
                comando.setObject( 1, sessao );
                comando.setObject( 2, administrador );
                comando.setString( 3, hashToken( token ) );
                comando.setString( 4, ip );
                comando.setString( 5, agente );
                if( comando.executeUpdate() != 1 ) {
                    throw new SQLException( "Configuracao ausente.", "W0002" );
                }
            }

            Sessao atual = carregarSessao( conexao, token );
            auditar( conexao, atual, "0", null, ip );
            return new Login( atual, token );
        } );
    }

    public Sessao consultarSessao( String token, boolean permitirTrocaObrigatoria ) throws Exception {

        return transacao( conexao -> {
            Sessao sessao = carregarSessao( conexao, token );
            if( sessao.trocarSenha() && !permitirTrocaObrigatoria ) {
                throw new Falha( "TROCA_SENHA_OBRIGATORIA" );
            }
            return sessao;
        } );
    }

    public Sessao alterarSenha( String token, char[] atual, char[] nova, char[] confirmacao, String ip ) throws Exception {

        return transacao( conexao -> {
            Sessao sessao = carregarSessao( conexao, token );
            String armazenado;
            try ( var comando = conexao.prepareStatement( "SELECT CD_SENHA_HASH FROM Agforms.ADMINISTRADORES WHERE ID_ADMINISTRADOR = ?" ) ) {
                comando.setObject( 1, sessao.administrador() );
                try ( var resultado = comando.executeQuery() ) {
                    resultado.next();
                    armazenado = resultado.getString( 1 );
                }
            }
            if( !SenhaAdministrador.verificar( atual, armazenado ) ) {
                throw new Falha( "SENHA_ATUAL_INVALIDA" );
            }
            if( !Arrays.equals( nova, confirmacao ) || Arrays.equals( atual, nova ) || !SenhaAdministrador.atendePolitica( nova ) ) {
                throw new Falha( "NOVA_SENHA_INVALIDA" );
            }

            String hash = SenhaAdministrador.gerarHash( nova );
            try ( var comando = conexao.prepareStatement( "UPDATE Agforms.ADMINISTRADORES SET CD_SENHA_HASH = ?, SN_TROCAR_SENHA = FALSE, DT_ALTERACAO_SENHA = CURRENT_TIMESTAMP WHERE ID_ADMINISTRADOR = ?" ) ) {
                comando.setString( 1, hash );
                comando.setObject( 2, sessao.administrador() );
                comando.executeUpdate();
            }
            try ( var comando = conexao.prepareStatement( "UPDATE Agforms.SESSOES_ADMINISTRATIVAS SET DT_REVOGACAO = CURRENT_TIMESTAMP, CD_MOTIVO_REVOGACAO = 'SENHA_ALTERADA' WHERE ID_ADMINISTRADOR = ? AND ID_SESSAO <> ? AND DT_REVOGACAO IS NULL AND DT_VALIDADE > CURRENT_TIMESTAMP" ) ) {
                comando.setObject( 1, sessao.administrador() );
                comando.setObject( 2, sessao.id() );
                comando.executeUpdate();
            }
            auditar( conexao, sessao, "2", sessao.administrador(), ip );

            return carregarSessao( conexao, token );
        } );
    }

    public void sair( String token, String ip ) throws Exception {

        transacao( conexao -> {
            Sessao sessao;
            try {
                sessao = carregarSessao( conexao, token );
            } catch ( Falha erro ) {
                if( "SESSAO_INVALIDA".equals( erro.getMessage() ) ) return null;
                throw erro;
            }

            try ( var comando = conexao.prepareStatement( "UPDATE Agforms.SESSOES_ADMINISTRATIVAS SET DT_REVOGACAO = CURRENT_TIMESTAMP, CD_MOTIVO_REVOGACAO = 'LOGOUT' WHERE ID_SESSAO = ?" ) ) {
                comando.setObject( 1, sessao.id() );
                comando.executeUpdate();
            }
            auditar( conexao, sessao, "1", null, ip );
            return null;
        } );
    }

    public static Sessao exigirAdministrador( Connection conexao, String token ) throws Exception {

        Sessao sessao = carregarSessao( conexao, token );
        if( sessao.trocarSenha() ) {
            throw new Falha( "TROCA_SENHA_OBRIGATORIA" );
        }

        return sessao;
    }

    private static Sessao carregarSessao( Connection conexao, String token ) throws Exception {

        if( token == null || !token.matches( "[A-Za-z0-9_-]{43}" ) ) {
            throw new Falha( "SESSAO_INVALIDA" );
        }

        String hash = hashToken( token );
        // Todas as operações travam primeiro a conta e depois a sessão, evitando inversão de locks.
        try ( var comando = conexao.prepareStatement( "SELECT a.ID_ADMINISTRADOR FROM Agforms.ADMINISTRADORES a JOIN Agforms.SESSOES_ADMINISTRATIVAS s ON s.ID_ADMINISTRADOR = a.ID_ADMINISTRADOR WHERE s.CD_TOKEN_HASH = ? FOR UPDATE OF a" ) ) {
            comando.setString( 1, hash );
            try ( var resultado = comando.executeQuery() ) {
                if( !resultado.next() ) {
                    throw new Falha( "SESSAO_INVALIDA" );
                }
            }
        }

        Sessao sessao;
        String sql = "SELECT s.ID_SESSAO, a.ID_ADMINISTRADOR, a.DS_NOME, a.CD_EMAIL, a.SN_TROCAR_SENHA, EXTRACT(EPOCH FROM s.DT_VALIDADE - CURRENT_TIMESTAMP)::bigint FROM Agforms.SESSOES_ADMINISTRATIVAS s JOIN Agforms.ADMINISTRADORES a ON a.ID_ADMINISTRADOR = s.ID_ADMINISTRADOR WHERE s.CD_TOKEN_HASH = ? AND a.SN_ATIVO AND s.DT_REVOGACAO IS NULL AND s.DT_VALIDADE > CURRENT_TIMESTAMP FOR UPDATE OF s";
        try ( var comando = conexao.prepareStatement( sql ) ) {
            comando.setString( 1, hash );
            try ( var resultado = comando.executeQuery() ) {
                if( !resultado.next() ) {
                    throw new Falha( "SESSAO_INVALIDA" );
                }
                sessao = new Sessao( resultado.getObject( 1, UUID.class ), resultado.getObject( 2, UUID.class ), resultado.getString( 3 ), resultado.getString( 4 ), resultado.getBoolean( 5 ), resultado.getLong( 6 ) );
            }
        }

        try ( var comando = conexao.prepareStatement( "UPDATE Agforms.SESSOES_ADMINISTRATIVAS SET DT_ULTIMO_ACESSO = CURRENT_TIMESTAMP WHERE ID_SESSAO = ? AND DT_ULTIMO_ACESSO < CURRENT_TIMESTAMP - INTERVAL '1 minute'" ) ) {
            comando.setObject( 1, sessao.id() );
            comando.executeUpdate();
        }

        return sessao;
    }

    private static void auditar( Connection conexao, Sessao sessao, String acao, UUID alvo, String ip ) throws SQLException {

        String sql = "INSERT INTO Agforms.ACOES_ADMINISTRATIVAS (ID_ACAO_ADMINISTRATIVA, ID_ADMINISTRADOR, ID_SESSAO, DT_OCORRENCIA, CD_ACAO, ID_ADMINISTRADOR_ALVO, JS_DETALHES, DS_IP_ORIGEM) VALUES (?, ?, ?, CURRENT_TIMESTAMP, ?, ?, '{}'::jsonb, ?::inet)";
        try ( var comando = conexao.prepareStatement( sql ) ) {
            comando.setObject( 1, UUID.randomUUID() );
            comando.setObject( 2, sessao.administrador() );
            comando.setObject( 3, sessao.id() );
            comando.setString( 4, acao );
            comando.setObject( 5, alvo );
            comando.setString( 6, ip );
            comando.executeUpdate();
        }
    }

    public static String hashToken( String token ) throws Exception {
        return HexFormat.of().formatHex( MessageDigest.getInstance( "SHA-256" ).digest( token.getBytes( StandardCharsets.UTF_8 ) ) );
    }

    private <T> T transacao( Operacao<T> operacao ) throws Exception {

        try ( Connection conexao = ConexaoBanco.abrir( configuracao ) ) {
            conexao.setAutoCommit( false );
            try {
                T retorno = operacao.executar( conexao );
                conexao.commit();
                return retorno;
            } catch ( Exception erro ) {
                try {
                    conexao.rollback();
                } catch ( SQLException falhaRollback ) {
                    // Não registrar mensagens que possam conter dados da operação.
                }
                throw erro;
            }
        }
    }

    @FunctionalInterface
    private interface Operacao<T> {
        T executar( Connection conexao ) throws Exception;
    }

    public record Sessao( UUID id, UUID administrador, String nome, String email, boolean trocarSenha, long segundosValidade ) {}

    public record Login( Sessao sessao, String token ) {

        @Override
        public String toString() { return "Login[conteudo protegido]"; }
    }

    public static final class Falha extends Exception {

        private static final long serialVersionUID = 1L;

        public Falha( String codigo ) { super( codigo ); }
    }
}
