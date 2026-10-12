package br.com.argousForms.auth;

import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Base64;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

import br.com.argousForms.api.ArgousFormsApiException;
import br.com.argousForms.model.negocio.cadastro.HistoricoLoginNegocio;
import br.com.argousForms.model.persistencia.cadastro.HistoricoLogin;
import br.com.argousForms.model.persistencia.cadastro.HistoricoLoginLocalizador;
import br.com.argousForms.security.SenhaSegura;
import quatro.sql.Conexao;
import quatro.sql.PoolDeConexoes;
import quatro.sql.Query;
import quatro.util.QtData;

public final class AutenticacaoLocalService {

	private static final SecureRandom ALEATORIO = new SecureRandom();
	private static final long VALIDADE_SEGUNDOS = 7 * 24 * 60 * 60;

	public record Sessao( String token, UUID idUsuario, String nome, String email, List<String> papeis, List<String> perfis ) {}
	public record Usuario( UUID idUsuario, String nome, String email, List<String> papeis, List<String> perfis ) {}

	public Sessao entrar( String emailInformado, String senha, String ip, String userAgent ) throws Exception {

		String email = emailInformado.strip().toLowerCase( Locale.ROOT );
		if( email.length() > 120 || senha == null || senha.isEmpty() ) throw credenciaisInvalidas();

		try ( Conexao conexao = PoolDeConexoes.getConexao() ) {
			conexao.beginTransaction();
			try {
				UUID idUsuario;
				UUID idVinculo;
				String nome;
				boolean confirmado;
				try ( Query query = new Query( conexao ) ) {
					query.setSQL( "select u.ID_USUARIO_SISTEMA, u.DS_NOME, u.CD_HASH_SENHA, v.ID_USUARIO_ORIGEM_LOGIN, v.SN_EMAIL_VERIFICADO "
						+ "from Cadastro.USUARIOS_SISTEMA u "
						+ "join Cadastro.USUARIO_ORIGENS_LOGIN v on v.ID_USUARIO_SISTEMA = u.ID_USUARIO_SISTEMA "
						+ "join Cadastro.ORIGENS_LOGIN o on o.ID_ORIGEM_LOGIN = v.ID_ORIGEM_LOGIN "
						+ "where lower(trim(u.DS_EMAIL)) = :email and u.DT_EXCLUSAO is null "
						+ "and v.DT_REVOGACAO is null and o.CD_ORIGEM = 1 and o.TP_AUTENTICACAO = 'L' "
						+ "and o.SN_ATIVA = true and o.DT_EXCLUSAO is null" );
					query.setParameter( "email", email );
					query.executeQuery();
					if( query.isEmpty() || !SenhaSegura.confere( senha, query.getString( "CD_HASH_SENHA" ) ) ) throw credenciaisInvalidas();
					idUsuario = UUID.fromString( query.getString( "ID_USUARIO_SISTEMA" ) );
					idVinculo = UUID.fromString( query.getString( "ID_USUARIO_ORIGEM_LOGIN" ) );
					nome = query.getString( "DS_NOME" );
					confirmado = query.getBoolean( "SN_EMAIL_VERIFICADO" );
					if( query.next() ) throw new IllegalStateException( "Mais de um vínculo local para o e-mail informado." );
				}

				if( !confirmado ) throw new ArgousFormsApiException( 403, "EMAIL_NAO_CONFIRMADO", "Confirme seu e-mail antes de entrar." );
				List<String> papeis = papeisAtivos( conexao, idUsuario );
				List<String> perfis = perfisAtivos( conexao, idUsuario );

				byte[] segredo = new byte[ 32 ];
				ALEATORIO.nextBytes( segredo );
				String token = Base64.getUrlEncoder().withoutPadding().encodeToString( segredo );
				Instant agora = Instant.now();
				HistoricoLogin historico = new HistoricoLogin();
				historico.setIdLogin( UUID.randomUUID() );
				historico.setIdUsuarioOrigemLogin( idVinculo );
				historico.setCdBearerSha256( hash( token ) );
				historico.setDtLogin( new QtData( agora.toEpochMilli() ) );
				historico.setDtValidade( new QtData( agora.plusSeconds( VALIDADE_SEGUNDOS ).toEpochMilli() ) );
				historico.setDsEnderecoIp( ip == null || ip.isBlank() ? "desconhecido" : ip );
				historico.setDsUserAgent( userAgent == null || userAgent.isBlank() ? "desconhecido" : userAgent );
				new HistoricoLoginNegocio( conexao, historico ).insere();
				conexao.commit();
				return new Sessao( token, idUsuario, nome, email, papeis, perfis );
			} catch ( Exception e ) {
				if( conexao.inTransaction() ) conexao.rollback();
				throw e;
			}
		}
	}

	public Usuario consultar( String token ) throws Exception {

		if( token == null || token.isBlank() ) throw sessaoInvalida();
		try ( Conexao conexao = PoolDeConexoes.getConexao() ) {
			UUID idUsuario;
			String nome;
			String email;
			try ( Query query = new Query( conexao ) ) {
				query.setSQL( "select u.ID_USUARIO_SISTEMA, u.DS_NOME, u.DS_EMAIL from Cadastro.HISTORICO_LOGINS h "
					+ "join Cadastro.USUARIO_ORIGENS_LOGIN v on v.ID_USUARIO_ORIGEM_LOGIN = h.ID_USUARIO_ORIGEM_LOGIN "
					+ "join Cadastro.USUARIOS_SISTEMA u on u.ID_USUARIO_SISTEMA = v.ID_USUARIO_SISTEMA "
					+ "join Cadastro.ORIGENS_LOGIN o on o.ID_ORIGEM_LOGIN = v.ID_ORIGEM_LOGIN "
					+ "where h.CD_BEARER_SHA256 = :hash and h.DT_VALIDADE > CURRENT_TIMESTAMP "
					+ "and h.DT_REVOGACAO is null and v.SN_EMAIL_VERIFICADO = true "
					+ "and v.DT_REVOGACAO is null and u.DT_EXCLUSAO is null "
					+ "and o.CD_ORIGEM = 1 and o.SN_ATIVA = true and o.DT_EXCLUSAO is null" );
				query.setParameter( "hash", hash( token ) );
				query.executeQuery();
				if( query.isEmpty() ) throw sessaoInvalida();
				idUsuario = UUID.fromString( query.getString( "ID_USUARIO_SISTEMA" ) );
				nome = query.getString( "DS_NOME" );
				email = query.getString( "DS_EMAIL" );
			}

			return new Usuario( idUsuario, nome, email, papeisAtivos( conexao, idUsuario ), perfisAtivos( conexao, idUsuario ) );
		}
	}

	private List<String> papeisAtivos( Conexao conexao, UUID idUsuario ) throws Exception {

		List<String> papeis = new ArrayList<>();
		try ( Query query = new Query( conexao ) ) {
			query.setSQL( "select distinct papel.CD_PAPEL from Cadastro.USUARIO_PERFIS up "
				+ "join Cadastro.PERFIS perfil on perfil.ID_PERFIL = up.ID_PERFIL "
				+ "join Cadastro.PERFIL_PAPEIS vinculo on vinculo.ID_PERFIL = perfil.ID_PERFIL "
				+ "join Cadastro.PAPEIS papel on papel.ID_PAPEL = vinculo.ID_PAPEL "
				+ "where up.ID_USUARIO_SISTEMA = :usuario "
				+ "and perfil.SN_ATIVO = true and perfil.DT_EXCLUSAO is null "
				+ "and vinculo.DT_EXCLUSAO is null and papel.SN_ATIVO = true and papel.DT_EXCLUSAO is null "
				+ "and up.DT_REVOGACAO is null "
				+ "and (up.DT_INICIO_VIGENCIA is null or up.DT_INICIO_VIGENCIA <= CURRENT_TIMESTAMP) "
				+ "and (up.DT_FIM_VIGENCIA is null or up.DT_FIM_VIGENCIA > CURRENT_TIMESTAMP)" );
			query.setParameter( "usuario", idUsuario.toString() );
			query.executeQuery();
			if( !query.isEmpty() ) {
				do {
					papeis.add( query.getString( "CD_PAPEL" ) );
				} while ( query.next() );
			}
		}
		return papeis;
	}

	private List<String> perfisAtivos( Conexao conexao, UUID idUsuario ) throws Exception {

		List<String> perfis = new ArrayList<>();
		try ( Query query = new Query( conexao ) ) {
			query.setSQL( "select distinct perfil.CD_PERFIL from Cadastro.USUARIO_PERFIS up "
				+ "join Cadastro.PERFIS perfil on perfil.ID_PERFIL = up.ID_PERFIL "
				+ "where up.ID_USUARIO_SISTEMA = :usuario "
				+ "and perfil.SN_ATIVO = true and perfil.DT_EXCLUSAO is null "
				+ "and up.DT_REVOGACAO is null "
				+ "and (up.DT_INICIO_VIGENCIA is null or up.DT_INICIO_VIGENCIA <= CURRENT_TIMESTAMP) "
				+ "and (up.DT_FIM_VIGENCIA is null or up.DT_FIM_VIGENCIA > CURRENT_TIMESTAMP)" );
			query.setParameter( "usuario", idUsuario.toString() );
			query.executeQuery();
			if( !query.isEmpty() ) {
				do {
					perfis.add( query.getString( "CD_PERFIL" ) );
				} while ( query.next() );
			}
		}
		return perfis;
	}

	public void sair( String token ) throws Exception {

		if( token == null || token.isBlank() ) return;
		try ( Conexao conexao = PoolDeConexoes.getConexao() ) {
			conexao.beginTransaction();
			try ( Query query = new Query( conexao ) ) {
				query.setSQL( "select * from Cadastro.HISTORICO_LOGINS where CD_BEARER_SHA256 = :hash and DT_REVOGACAO is null" );
				query.setParameter( "hash", hash( token ) );
				query.executeQuery();
				if( !query.isEmpty() ) {
					HistoricoLogin historico = new HistoricoLogin();
					HistoricoLoginLocalizador.buscaCampos( historico, query );
					historico.setDtRevogacao( new QtData( Instant.now().toEpochMilli() ) );
					new HistoricoLoginNegocio( conexao, historico ).altera();
				}
				conexao.commit();
			} catch ( Exception e ) {
				if( conexao.inTransaction() ) conexao.rollback();
				throw e;
			}
		}
	}

	private static String hash( String token ) throws Exception {

		return HexFormat.of().formatHex( MessageDigest.getInstance( "SHA-256" ).digest( token.getBytes( java.nio.charset.StandardCharsets.US_ASCII ) ) );
	}

	private static ArgousFormsApiException credenciaisInvalidas() {
		return new ArgousFormsApiException( 401, "CREDENCIAIS_INVALIDAS", "E-mail ou senha incorretos." );
	}

	private static ArgousFormsApiException sessaoInvalida() {
		return new ArgousFormsApiException( 401, "SESSAO_INVALIDA", "Sessão inválida ou expirada. Entre novamente." );
	}
}
