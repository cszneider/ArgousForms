package br.com.webhook.administracao;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.sql.Connection;
import java.sql.SQLException;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

import br.com.webhook.api.Json;
import br.com.webhook.configuracao.ConfiguracaoPermanente;
import br.com.webhook.persistencia.ConexaoBanco;
import br.com.webhook.seguranca.AutenticacaoService;
import br.com.webhook.seguranca.SenhaAdministrador;

public final class AdministracaoService {

    private static final int TAMANHO_PAGINA = 20;
    private static final String CAMPOS_ADMIN = "a.ID_ADMINISTRADOR AS id, a.CD_EMAIL AS email, a.DS_NOME AS nome, a.SN_ATIVO AS ativo, a.SN_TROCAR_SENHA AS \"trocarSenha\", a.DT_INCLUSAO AS \"criadoEm\"";
    private static final String CAMPOS_TRANSACAO = "ID_TRANSACAO AS id, ID_REQUISICAO AS \"idRequisicao\", ID_PROTOCOLO AS \"idProtocolo\", CD_CONSULTA AS codigo, DT_INICIO AS inicio, DT_FIM AS fim, NR_DURACAO_MS AS \"duracaoMs\", TP_RESULTADO AS resultado, NR_STATUS_HTTP AS http, SN_HMAC_VALIDO AS \"hmacValido\", CD_ERRO AS \"codigoErro\", DS_ERRO AS erro, host(DS_IP_ORIGEM) AS ip, NR_BYTES_REQUISICAO AS \"bytesRequisicao\", NR_BYTES_RESPOSTA AS \"bytesResposta\"";
    private final ConfiguracaoPermanente configuracao;

    public AdministracaoService( ConfiguracaoPermanente configuracao ) { this.configuracao = configuracao; }

    public Object consultar( String token, String operacao, Map<String, String> filtros ) throws Exception {

        return transacao( token, false, ( conexao, sessao ) -> {
            if( "configuracao".equals( operacao ) ) return configuracao( conexao );
            if( "administradores".equals( operacao ) ) return administradores( conexao, filtros );
            if( "transacao".equals( operacao ) ) {
                var linhas = consultar( conexao, "SELECT " + CAMPOS_TRANSACAO + " FROM Agforms.TRANSACOES WHERE ID_TRANSACAO = ?", uuid( filtros.get( "id" ) ) );
                if( linhas.isEmpty() ) throw new Validacao( "Transação não encontrada." );
                return linhas.get( 0 );
            }

            Map<String, Object> config = configuracao( conexao );
            Periodo periodo = periodo( filtros, (String) config.get( "fusoHorario" ) );
            return switch( operacao ) {
                case "resumo", "estatisticas" -> estatisticas( conexao, periodo, config );
                case "transacoes" -> transacoes( conexao, periodo, filtros );
                case "atividade" -> atividade( conexao, periodo, filtros );
                default -> throw new Validacao( "Consulta administrativa não encontrada." );
            };
        } );
    }

    public Object salvar( String token, String operacao, Map<String, String> campos, String ip ) throws Exception {

        return transacao( token, true, ( conexao, sessao ) -> switch( operacao ) {
            case "administradores" -> salvarAdministrador( conexao, sessao, campos, ip );
            case "configuracao" -> salvarConfiguracao( conexao, sessao, campos, ip );
            default -> throw new Validacao( "Operação administrativa não encontrada." );
        } );
    }

    private static Map<String, Object> estatisticas( Connection conexao, Periodo periodo, Map<String, Object> config ) throws Exception {

        Object inicio = periodo.inicioInstant();
        Object fim = periodo.fimInstant();
        String intervalo = " WHERE DT_INICIO >= ? AND DT_INICIO < ?";
        String sql = "SELECT count(*) AS total, count(*) FILTER (WHERE TP_RESULTADO = 'O') AS sucessos, count(*) FILTER (WHERE TP_RESULTADO = 'N') AS \"naoEncontrados\", count(*) FILTER (WHERE TP_RESULTADO IN ('F','I')) AS falhas, count(*) FILTER (WHERE TP_RESULTADO IN ('R','S')) AS recusadas, count(*) FILTER (WHERE TP_RESULTADO = 'P') AS \"emProcessamento\", round(avg(NR_DURACAO_MS), 1) AS \"tempoMedioMs\" FROM Agforms.TRANSACOES" + intervalo;
        Map<String, Object> metricas = consultar( conexao, sql, inicio, fim ).get( 0 );
        var dias = consultar( conexao, "SELECT (DT_INICIO AT TIME ZONE ?)::date AS dia, count(*) AS total, count(*) FILTER (WHERE TP_RESULTADO IN ('F','I')) AS falhas FROM Agforms.TRANSACOES" + intervalo + " GROUP BY 1 ORDER BY 1", periodo.fuso(), inicio, fim );
        var horas = consultar( conexao, "SELECT EXTRACT(HOUR FROM DT_INICIO AT TIME ZONE ?)::int AS hora, count(*) AS total FROM Agforms.TRANSACOES" + intervalo + " GROUP BY 1 ORDER BY 1", periodo.fuso(), inicio, fim );
        var resultados = consultar( conexao, "SELECT TP_RESULTADO AS resultado, count(*) AS total FROM Agforms.TRANSACOES" + intervalo + " GROUP BY 1 ORDER BY 1", inicio, fim );
        var codigos = consultar( conexao, "SELECT COALESCE(CD_CONSULTA, 'Sem código') AS codigo, count(*) AS total, round(avg(NR_DURACAO_MS), 1) AS \"tempoMedioMs\" FROM Agforms.TRANSACOES" + intervalo + " GROUP BY 1 ORDER BY total DESC, codigo LIMIT 10", inicio, fim );
        var recentes = consultar( conexao, "SELECT " + CAMPOS_TRANSACAO + " FROM Agforms.TRANSACOES" + intervalo + " ORDER BY DT_INICIO DESC, ID_TRANSACAO DESC LIMIT 5", inicio, fim );

        Map<String, Object> retorno = new LinkedHashMap<>();
        retorno.put( "periodo", periodo.mapa() );
        retorno.put( "configuracao", config );
        retorno.put( "metricas", metricas );
        retorno.put( "dias", dias );
        retorno.put( "horas", horas );
        retorno.put( "resultados", resultados );
        retorno.put( "codigos", codigos );
        retorno.put( "recentes", recentes );

        return retorno;
    }

    private static Map<String, Object> transacoes( Connection conexao, Periodo periodo, Map<String, String> filtros ) throws Exception {

        List<Object> parametros = new ArrayList<>( List.of( periodo.inicioInstant(), periodo.fimInstant() ) );
        String where = " WHERE DT_INICIO >= ? AND DT_INICIO < ?";
        String codigo = filtros.getOrDefault( "codigo", "" ).strip();
        if( codigo.length() > 100 ) throw new Validacao( "O código deve ter até 100 caracteres." );
        if( !codigo.isEmpty() ) {
            where += " AND CD_CONSULTA = ?";
            parametros.add( codigo );
        }
        String resultado = filtros.getOrDefault( "resultado", "" );
        if( !resultado.isEmpty() ) {
            if( !resultado.matches( "[PONRSFI]" ) ) throw new Validacao( "Resultado inválido." );
            where += " AND TP_RESULTADO = ?";
            parametros.add( resultado );
        }

        return pagina( conexao, "SELECT " + CAMPOS_TRANSACAO + " FROM Agforms.TRANSACOES", "SELECT count(*) AS total FROM Agforms.TRANSACOES", where, " ORDER BY DT_INICIO DESC, ID_TRANSACAO DESC", parametros, filtros, periodo );
    }

    private static Map<String, Object> atividade( Connection conexao, Periodo periodo, Map<String, String> filtros ) throws Exception {

        List<Object> parametros = new ArrayList<>( List.of( periodo.inicioInstant(), periodo.fimInstant() ) );
        String from = " FROM Agforms.ACOES_ADMINISTRATIVAS h JOIN Agforms.ADMINISTRADORES a ON a.ID_ADMINISTRADOR = h.ID_ADMINISTRADOR LEFT JOIN Agforms.ADMINISTRADORES alvo ON alvo.ID_ADMINISTRADOR = h.ID_ADMINISTRADOR_ALVO";
        String where = " WHERE h.DT_OCORRENCIA >= ? AND h.DT_OCORRENCIA < ?";
        String acao = filtros.getOrDefault( "acao", "" );
        if( !acao.isEmpty() ) {
            if( !acao.matches( "[0-9]" ) ) throw new Validacao( "Ação inválida." );
            where += " AND h.CD_ACAO = ?";
            parametros.add( acao );
        }
        String busca = texto( filtros, "busca", 100, false );
        if( !busca.isEmpty() ) {
            where += " AND position(lower(?) in lower(a.DS_NOME || ' ' || a.CD_EMAIL)) > 0";
            parametros.add( busca );
        }
        String campos = "h.ID_ACAO_ADMINISTRATIVA AS id, h.DT_OCORRENCIA AS data, h.CD_ACAO AS acao, a.DS_NOME AS administrador, a.CD_EMAIL AS email, alvo.DS_NOME AS alvo, h.JS_DETALHES::text AS detalhes, host(h.DS_IP_ORIGEM) AS ip, h.ID_SESSAO AS \"idSessao\"";

        return pagina( conexao, "SELECT " + campos + from, "SELECT count(*) AS total" + from, where, " ORDER BY h.DT_OCORRENCIA DESC, h.ID_ACAO_ADMINISTRATIVA DESC", parametros, filtros, periodo );
    }

    private static Map<String, Object> administradores( Connection conexao, Map<String, String> filtros ) throws Exception {

        String busca = texto( filtros, "busca", 100, false );
        String where = " WHERE position(lower(?) in lower(a.DS_NOME || ' ' || a.CD_EMAIL)) > 0";
        String select = "SELECT " + CAMPOS_ADMIN + ", (SELECT count(*) FROM Agforms.SESSOES_ADMINISTRATIVAS s WHERE s.ID_ADMINISTRADOR = a.ID_ADMINISTRADOR AND s.DT_REVOGACAO IS NULL AND s.DT_VALIDADE > CURRENT_TIMESTAMP) AS \"sessoesAtivas\" FROM Agforms.ADMINISTRADORES a";
        Map<String, Object> retorno = pagina( conexao, select, "SELECT count(*) AS total FROM Agforms.ADMINISTRADORES a", where, " ORDER BY a.DS_NOME, a.ID_ADMINISTRADOR", new ArrayList<>( List.of( busca ) ), filtros, null );
        @SuppressWarnings( "unchecked" )
        var itens = (List<Map<String, Object>>) retorno.get( "itens" );
        for( var item : itens ) item.put( "revisao", revisaoAdministrador( item ) );

        return retorno;
    }

    private static Map<String, Object> configuracao( Connection conexao ) throws Exception {
        return configuracao( conexao, false );
    }

    private static Map<String, Object> configuracao( Connection conexao, boolean bloquear ) throws Exception {

        String sql = "SELECT c.SN_RECEBIMENTO_ATIVO AS \"recebimentoAtivo\", c.CD_FUSO_HORARIO AS \"fusoHorario\", c.NR_MINUTOS_VALIDADE_SESSAO AS \"validadeSessaoMinutos\", c.NR_DIAS_RETENCAO_TRANSACOES AS \"retencaoTransacoesDias\", c.NR_DIAS_RETENCAO_ACOES_ADMIN AS \"retencaoAcoesDias\", c.NR_DIAS_RETENCAO_SESSOES AS \"retencaoSessoesDias\", c.DT_ALTERACAO AS \"alteradoEm\", a.DS_NOME AS \"alteradoPor\" FROM Agforms.CONFIGURACAO c JOIN Agforms.ADMINISTRADORES a ON a.ID_ADMINISTRADOR = c.ID_ADMINISTRADOR WHERE c.ID_CONFIGURACAO = 1";
        var linhas = consultar( conexao, sql + ( bloquear ? " FOR UPDATE OF c" : "" ) );
        if( linhas.size() != 1 ) throw new SQLException( "Configuracao indisponivel.", "W0002" );
        Map<String, Object> dados = linhas.get( 0 );
        dados.put( "revisao", revisao( dados ) );

        return dados;
    }

    private static Object salvarConfiguracao( Connection conexao, AutenticacaoService.Sessao sessao, Map<String, String> campos, String ip ) throws Exception {

        Map<String, Object> anterior = configuracao( conexao, true );
        conferirRevisao( campos, anterior.get( "revisao" ) );
        String fuso = texto( campos, "fusoHorario", 100, true );
        try {
            ZoneId.of( fuso );
            if( consultar( conexao, "SELECT name FROM pg_timezone_names WHERE name = ?", fuso ).isEmpty() ) throw new IllegalArgumentException();
        } catch ( java.time.DateTimeException | IllegalArgumentException erro ) {
            throw new Validacao( "Informe um fuso horário válido, como America/Sao_Paulo ou UTC." );
        }
        int validade = inteiro( campos, "validadeSessaoMinutos", 11 );
        int transacoes = inteiro( campos, "retencaoTransacoesDias", 1 );
        int acoes = inteiro( campos, "retencaoAcoesDias", 1 );
        int sessoes = inteiro( campos, "retencaoSessoesDias", 1 );
        atualizar( conexao, "UPDATE Agforms.CONFIGURACAO SET CD_FUSO_HORARIO = ?, NR_MINUTOS_VALIDADE_SESSAO = ?, NR_DIAS_RETENCAO_TRANSACOES = ?, NR_DIAS_RETENCAO_ACOES_ADMIN = ?, NR_DIAS_RETENCAO_SESSOES = ?, DT_ALTERACAO = clock_timestamp(), ID_ADMINISTRADOR = ? WHERE ID_CONFIGURACAO = 1", fuso, validade, transacoes, acoes, sessoes, sessao.administrador() );
        Map<String, Object> atual = configuracao( conexao );
        auditar( conexao, sessao, "9", null, ip, Map.of( "anterior", anterior, "atual", atual ) );

        return atual;
    }

    private static Object salvarAdministrador( Connection conexao, AutenticacaoService.Sessao sessao, Map<String, String> campos, String ip ) throws Exception {

        String nome = texto( campos, "nome", 200, true );
        String email = texto( campos, "email", 100, true ).toLowerCase( Locale.ROOT );
        if( !email.matches( "[^\\s@]+@[^\\s@]+\\.[^\\s@]+" ) ) throw new Validacao( "Informe um e-mail válido." );
        boolean ativo = booleano( campos, "ativo" );
        String idTexto = campos.getOrDefault( "id", "" );
        UUID id = idTexto.isBlank() ? UUID.randomUUID() : uuid( idTexto );
        boolean novo = idTexto.isBlank();
        if( !consultar( conexao, "SELECT ID_ADMINISTRADOR FROM Agforms.ADMINISTRADORES WHERE lower(CD_EMAIL) = ? AND ID_ADMINISTRADOR <> ?", email, id ).isEmpty() ) throw new Validacao( "Já existe um administrador com esse e-mail." );

        if( novo ) {
            char[] senha = campos.getOrDefault( "senhaTemporaria", "" ).toCharArray();
            String hash;
            try {
                if( !SenhaAdministrador.atendePolitica( senha ) ) throw new Validacao( "A senha temporária deve ter de 8 a 1024 caracteres e ao menos três categorias: maiúsculas, minúsculas, números e símbolos." );
                hash = SenhaAdministrador.gerarHash( senha );
            } finally {
                Arrays.fill( senha, '\0' );
            }
            atualizar( conexao, "INSERT INTO Agforms.ADMINISTRADORES (ID_ADMINISTRADOR, CD_EMAIL, DS_NOME, CD_SENHA_HASH, SN_TROCAR_SENHA, SN_ATIVO, DT_INCLUSAO, DT_ALTERACAO_SENHA, ID_ADMINISTRADOR_CRIOU) VALUES (?, ?, ?, ?, TRUE, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, ?)", id, email, nome, hash, ativo, sessao.administrador() );
            auditar( conexao, sessao, "3", id, ip, Map.of( "nome", nome, "email", email, "ativo", ativo ) );
        } else {
            var linhas = consultar( conexao, "SELECT " + CAMPOS_ADMIN + " FROM Agforms.ADMINISTRADORES a WHERE a.ID_ADMINISTRADOR = ? FOR UPDATE", id );
            if( linhas.isEmpty() ) throw new Validacao( "Administrador não encontrado." );
            Map<String, Object> anterior = linhas.get( 0 );
            conferirRevisao( campos, revisaoAdministrador( anterior ) );
            boolean eraAtivo = Boolean.TRUE.equals( anterior.get( "ativo" ) );
            if( eraAtivo && !ativo && ( (Number) consultar( conexao, "SELECT count(*) AS total FROM Agforms.ADMINISTRADORES WHERE SN_ATIVO" ).get( 0 ).get( "total" ) ).longValue() <= 1 ) throw new Validacao( "Não é permitido desativar o último administrador ativo." );
            atualizar( conexao, "UPDATE Agforms.ADMINISTRADORES SET CD_EMAIL = ?, DS_NOME = ?, SN_ATIVO = ? WHERE ID_ADMINISTRADOR = ?", email, nome, ativo, id );
            if( !ativo ) atualizar( conexao, "UPDATE Agforms.SESSOES_ADMINISTRATIVAS SET DT_REVOGACAO = CURRENT_TIMESTAMP, CD_MOTIVO_REVOGACAO = 'CONTA_DESATIVADA' WHERE ID_ADMINISTRADOR = ? AND DT_REVOGACAO IS NULL", id );
            if( !nome.equals( anterior.get( "nome" ) ) || !email.equals( anterior.get( "email" ) ) ) auditar( conexao, sessao, "4", id, ip, Map.of( "anterior", Map.of( "nome", anterior.get( "nome" ), "email", anterior.get( "email" ) ), "atual", Map.of( "nome", nome, "email", email ) ) );
            if( eraAtivo != ativo ) auditar( conexao, sessao, ativo ? "5" : "6", id, ip, Map.of( "ativo", ativo ) );
        }

        return Map.of( "id", id, "sessaoEncerrada", id.equals( sessao.administrador() ) && !ativo );
    }

    private static String revisaoAdministrador( Map<String, Object> dados ) throws Exception {
        return revisao( List.of( dados.get( "id" ), dados.get( "nome" ), dados.get( "email" ), dados.get( "ativo" ), dados.get( "trocarSenha" ), dados.get( "criadoEm" ) ) );
    }

    private static String revisao( Object dados ) throws Exception {
        return HexFormat.of().formatHex( MessageDigest.getInstance( "SHA-256" ).digest( Json.escrever( dados ).getBytes( StandardCharsets.UTF_8 ) ) );
    }

    private static void conferirRevisao( Map<String, String> campos, Object esperada ) throws Validacao {

        if( !esperada.equals( campos.get( "revisao" ) ) ) throw new Validacao( "O registro mudou desde sua abertura. Atualize a lista e abra a edição novamente.", true );
    }

    private static Map<String, Object> pagina( Connection conexao, String select, String count, String where, String ordem, List<Object> parametros, Map<String, String> filtros, Periodo periodo ) throws Exception {

        int pagina = inteiroOpcional( filtros.getOrDefault( "pagina", "0" ), 0, 1_000_000 );
        Object total = consultar( conexao, count + where, parametros.toArray() ).get( 0 ).get( "total" );
        parametros.add( TAMANHO_PAGINA );
        parametros.add( (long) pagina * TAMANHO_PAGINA );
        var itens = consultar( conexao, select + where + ordem + " LIMIT ? OFFSET ?", parametros.toArray() );
        Map<String, Object> retorno = new LinkedHashMap<>();
        retorno.put( "itens", itens );
        retorno.put( "total", total );
        retorno.put( "pagina", pagina );
        retorno.put( "tamanhoPagina", TAMANHO_PAGINA );
        if( periodo != null ) retorno.put( "periodo", periodo.mapa() );

        return retorno;
    }

    private static Periodo periodo( Map<String, String> filtros, String fuso ) throws Validacao {

        try {
            ZoneId zona = ZoneId.of( fuso );
            LocalDate hoje = LocalDate.now( zona );
            String de = filtros.getOrDefault( "inicio", "" );
            String ate = filtros.getOrDefault( "fim", "" );
            LocalDate inicio = de.isBlank() ? hoje.minusDays( 6 ) : LocalDate.parse( de );
            LocalDate fim = ate.isBlank() ? hoje : LocalDate.parse( ate );
            if( fim.isBefore( inicio ) || ChronoUnit.DAYS.between( inicio, fim ) > 365 ) throw new IllegalArgumentException();
            return new Periodo( inicio, fim, fuso );
        } catch ( RuntimeException erro ) {
            throw new Validacao( "Informe um período válido de até 366 dias." );
        }
    }

    private static List<Map<String, Object>> consultar( Connection conexao, String sql, Object... parametros ) throws SQLException {

        List<Map<String, Object>> linhas = new ArrayList<>();
        try ( var comando = conexao.prepareStatement( sql ) ) {
            for( int i = 0; i < parametros.length; i++ ) comando.setObject( i + 1, parametros[ i ] );
            try ( var resultado = comando.executeQuery() ) {
                var colunas = resultado.getMetaData();
                while( resultado.next() ) {
                    Map<String, Object> linha = new LinkedHashMap<>();
                    for( int i = 1; i <= colunas.getColumnCount(); i++ ) {
                        Object valor = resultado.getObject( i );
                        if( valor instanceof java.sql.Timestamp instante ) valor = instante.toInstant().toString();
                        if( valor instanceof java.sql.Date data ) valor = data.toLocalDate().toString();
                        linha.put( colunas.getColumnLabel( i ), valor );
                    }
                    linhas.add( linha );
                }
            }
        }

        return linhas;
    }

    private static void atualizar( Connection conexao, String sql, Object... parametros ) throws SQLException {

        try ( var comando = conexao.prepareStatement( sql ) ) {
            for( int i = 0; i < parametros.length; i++ ) comando.setObject( i + 1, parametros[ i ] );
            comando.executeUpdate();
        }
    }

    private static void auditar( Connection conexao, AutenticacaoService.Sessao sessao, String acao, UUID alvo, String ip, Map<String, Object> detalhes ) throws SQLException {
        atualizar( conexao, "INSERT INTO Agforms.ACOES_ADMINISTRATIVAS (ID_ACAO_ADMINISTRATIVA, ID_ADMINISTRADOR, ID_SESSAO, DT_OCORRENCIA, CD_ACAO, ID_ADMINISTRADOR_ALVO, JS_DETALHES, DS_IP_ORIGEM) VALUES (?, ?, ?, CURRENT_TIMESTAMP, ?, ?, ?::jsonb, ?::inet)", UUID.randomUUID(), sessao.administrador(), sessao.id(), acao, alvo, Json.escrever( detalhes ), ip );
    }

    private <T> T transacao( String token, boolean escrita, Operacao<T> operacao ) throws Exception {

        try ( Connection conexao = ConexaoBanco.abrir( configuracao ) ) {
            conexao.setAutoCommit( false );
            try {
                try ( var comando = conexao.createStatement() ) {
                    comando.execute( "SET LOCAL lock_timeout = '15s'" );
                    comando.execute( "SET LOCAL statement_timeout = '30s'" );
                    if( escrita ) comando.execute( "SELECT pg_advisory_xact_lock(470380466701)" );
                }
                var sessao = AutenticacaoService.exigirAdministrador( conexao, token );
                T retorno = operacao.executar( conexao, sessao );
                conexao.commit();
                return retorno;
            } catch ( Exception erro ) {
                try { conexao.rollback(); } catch ( SQLException ignorada ) { /* Conexão será fechada. */ }
                throw erro;
            }
        }
    }

    private static String texto( Map<String, String> campos, String campo, int limite, boolean obrigatorio ) throws Validacao {

        String texto = campos.getOrDefault( campo, "" ).strip();
        if( texto.length() > limite || texto.codePoints().anyMatch( Character::isISOControl ) || obrigatorio && texto.isEmpty() ) throw new Validacao( "Confira o campo " + campo + "." );
        return texto;
    }

    private static int inteiro( Map<String, String> campos, String campo, int minimo ) throws Validacao {
        return inteiroOpcional( campos.getOrDefault( campo, "" ), minimo, Integer.MAX_VALUE );
    }

    private static int inteiroOpcional( String texto, int minimo, int maximo ) throws Validacao {

        try {
            int valor = Integer.parseInt( texto );
            if( valor < minimo || valor > maximo ) throw new NumberFormatException();
            return valor;
        } catch ( NumberFormatException erro ) {
            throw new Validacao( "Informe valores numéricos dentro dos limites indicados." );
        }
    }

    private static boolean booleano( Map<String, String> campos, String campo ) throws Validacao {

        String valor = campos.get( campo );
        if( !"true".equals( valor ) && !"false".equals( valor ) ) throw new Validacao( "Situação inválida." );
        return Boolean.parseBoolean( valor );
    }

    private static UUID uuid( String texto ) throws Validacao {

        try { return UUID.fromString( texto ); }
        catch ( RuntimeException erro ) { throw new Validacao( "Identificador inválido." ); }
    }

    private record Periodo( LocalDate inicio, LocalDate fim, String fuso ) {

        Object inicioInstant() { return inicio.atStartOfDay( ZoneId.of( fuso ) ).toOffsetDateTime(); }
        Object fimInstant() { return fim.plusDays( 1 ).atStartOfDay( ZoneId.of( fuso ) ).toOffsetDateTime(); }
        Map<String, Object> mapa() { return Map.of( "inicio", inicio.toString(), "fim", fim.toString(), "fuso", fuso ); }
    }

    @FunctionalInterface
    private interface Operacao<T> { T executar( Connection conexao, AutenticacaoService.Sessao sessao ) throws Exception; }

    public static final class Validacao extends Exception {

        private static final long serialVersionUID = 1L;
        private final boolean conflito;
        public Validacao( String mensagem ) { this( mensagem, false ); }
        public Validacao( String mensagem, boolean conflito ) { super( mensagem ); this.conflito = conflito; }
        public boolean conflito() { return conflito; }
    }
}
