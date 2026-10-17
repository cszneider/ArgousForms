package br.com.argousForms.auth;

import java.security.MessageDigest;
import java.security.SecureRandom;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Base64;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

import br.com.argousForms.api.ArgousFormsApiException;
import br.com.argousForms.model.negocio.cadastro.HistoricoLoginNegocio;
import br.com.argousForms.model.negocio.cadastro.UsuarioSistemaNegocio;
import br.com.argousForms.model.persistencia.cadastro.HistoricoLogin;
import br.com.argousForms.model.persistencia.cadastro.HistoricoLoginLocalizador;
import br.com.argousForms.model.persistencia.cadastro.UsuarioSistema;
import br.com.argousForms.model.persistencia.cadastro.UsuarioSistemaLocalizador;
import br.com.argousForms.security.PoliticaSenha;
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
	public record ConexaoAtiva( UUID idLogin, Instant inicio, Instant ultimoAcesso, Instant validade, String enderecoIp, String agente, boolean atual ) {}

	public Sessao entrar( String emailInformado, String senha, String ip, String userAgent ) throws Exception {

		String email = emailInformado.strip().toLowerCase( Locale.ROOT );
		if( email.length() > 120 || senha == null || senha.isEmpty() ) throw credenciaisInvalidas();

		try ( Conexao conexao = PoolDeConexoes.getConexao() ) {
			conexao.beginTransaction();
			try {
				// Serializa o login com a troca de senha para não criar sessão com a senha antiga após a revogação.
				try ( PreparedStatement bloqueio = conexao.getConnection().prepareStatement( "select ID_USUARIO_SISTEMA from Cadastro.USUARIOS_SISTEMA where lower(trim(DS_EMAIL)) = ? and DT_EXCLUSAO is null for update" ) ) {
					bloqueio.setString( 1, email );
					try ( ResultSet resultado = bloqueio.executeQuery() ) {
						if( !resultado.next() ) throw credenciaisInvalidas();
					}
				}

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

	public List<ConexaoAtiva> listarConexoes( String token ) throws Exception {

		Usuario usuario = consultar( token );
		if( !usuario.papeis().contains( "AUTOGESTAO" ) ) {
			throw new ArgousFormsApiException( 403, "ACESSO_NEGADO", "Seu usuário não pode consultar as próprias conexões." );
		}

		List<ConexaoAtiva> conexoes = new ArrayList<>();
		boolean atualEncontrada = false;
		try ( Conexao conexao = PoolDeConexoes.getConexao() ) {
			String sql = "select h.ID_LOGIN, h.DT_LOGIN, h.DT_ULTIMO_ACESSO, h.DT_VALIDADE, h.DS_ENDERECO_IP, h.DS_USER_AGENT, "
				+ "(h.CD_BEARER_SHA256 = ?) as ATUAL from Cadastro.HISTORICO_LOGINS h "
				+ "join Cadastro.USUARIO_ORIGENS_LOGIN v on v.ID_USUARIO_ORIGEM_LOGIN = h.ID_USUARIO_ORIGEM_LOGIN "
				+ "join Cadastro.ORIGENS_LOGIN o on o.ID_ORIGEM_LOGIN = v.ID_ORIGEM_LOGIN "
				+ "where v.ID_USUARIO_SISTEMA = ? and h.DT_VALIDADE > CURRENT_TIMESTAMP and h.DT_REVOGACAO is null "
				+ "and v.DT_REVOGACAO is null and v.SN_EMAIL_VERIFICADO = true "
				+ "and o.SN_ATIVA = true and o.DT_EXCLUSAO is null order by h.DT_LOGIN desc";
			try ( PreparedStatement consulta = conexao.getConnection().prepareStatement( sql ) ) {
				consulta.setString( 1, hash( token ) );
				consulta.setObject( 2, usuario.idUsuario() );
				try ( ResultSet resultado = consulta.executeQuery() ) {
					while( resultado.next() ) {
						boolean atual = resultado.getBoolean( "ATUAL" );
						atualEncontrada |= atual;
						conexoes.add( new ConexaoAtiva( resultado.getObject( "ID_LOGIN", UUID.class ), instante( resultado, "DT_LOGIN" ),
							instante( resultado, "DT_ULTIMO_ACESSO" ), instante( resultado, "DT_VALIDADE" ),
							resultado.getString( "DS_ENDERECO_IP" ), resultado.getString( "DS_USER_AGENT" ), atual ) );
					}
				}
			}
		}
		if( !atualEncontrada ) throw sessaoInvalida();
		return conexoes;
	}

	public boolean encerrarConexao( String token, UUID idLogin ) throws Exception {

		Usuario usuario = consultar( token );
		if( !usuario.papeis().contains( "AUTOGESTAO" ) ) {
			throw new ArgousFormsApiException( 403, "ACESSO_NEGADO", "Seu usuário não pode encerrar as próprias conexões." );
		}

		String hashAtual = hash( token );
		try ( Conexao conexao = PoolDeConexoes.getConexao() ) {
			conexao.beginTransaction();
			try {
				// Serializa revogações e trocas de senha da mesma conta.
				try ( PreparedStatement bloqueio = conexao.getConnection().prepareStatement( "select ID_USUARIO_SISTEMA from Cadastro.USUARIOS_SISTEMA where ID_USUARIO_SISTEMA = ? and DT_EXCLUSAO is null for update" ) ) {
					bloqueio.setObject( 1, usuario.idUsuario() );
					try ( ResultSet resultado = bloqueio.executeQuery() ) {
						if( !resultado.next() ) throw sessaoInvalida();
					}
				}

				try ( Query query = new Query( conexao ) ) {
					query.setSQL( "select 1 from Cadastro.HISTORICO_LOGINS h "
						+ "join Cadastro.USUARIO_ORIGENS_LOGIN v on v.ID_USUARIO_ORIGEM_LOGIN = h.ID_USUARIO_ORIGEM_LOGIN "
						+ "where h.CD_BEARER_SHA256 = :hash and v.ID_USUARIO_SISTEMA = :usuario "
						+ "and h.DT_REVOGACAO is null and h.DT_VALIDADE > CURRENT_TIMESTAMP "
						+ "and v.DT_REVOGACAO is null and v.SN_EMAIL_VERIFICADO = true" );
					query.setParameter( "hash", hashAtual );
					query.setParameter( "usuario", usuario.idUsuario().toString() );
					query.executeQuery();
					if( query.isEmpty() ) throw sessaoInvalida();
				}

				HistoricoLogin historico;
				try ( Query query = new Query( conexao ) ) {
					query.setSQL( "select h.* from Cadastro.HISTORICO_LOGINS h "
						+ "join Cadastro.USUARIO_ORIGENS_LOGIN v on v.ID_USUARIO_ORIGEM_LOGIN = h.ID_USUARIO_ORIGEM_LOGIN "
						+ "where h.ID_LOGIN = :login and v.ID_USUARIO_SISTEMA = :usuario "
						+ "and h.DT_REVOGACAO is null and h.DT_VALIDADE > CURRENT_TIMESTAMP" );
					query.setParameter( "login", idLogin.toString() );
					query.setParameter( "usuario", usuario.idUsuario().toString() );
					query.executeQuery();
					if( query.isEmpty() ) {
						throw new ArgousFormsApiException( 404, "CONEXAO_NAO_ENCONTRADA", "Esta conexão não está mais ativa." );
					}
					historico = new HistoricoLogin();
					HistoricoLoginLocalizador.buscaCampos( historico, query );
				}

				boolean atual = hashAtual.equals( historico.getCdBearerSha256() );
				historico.setDtRevogacao( new QtData( Instant.now().toEpochMilli() ) );
				new HistoricoLoginNegocio( conexao, historico ).altera();
				conexao.commit();
				return atual;
			} catch ( Exception e ) {
				if( conexao.inTransaction() ) conexao.rollback();
				throw e;
			}
		}
	}

	private static Instant instante( ResultSet resultado, String campo ) throws Exception {

		Timestamp valor = resultado.getTimestamp( campo );
		return valor == null ? null : valor.toInstant();
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

	public void alterarSenha( String token, String senhaAtual, String senhaNova ) throws Exception {

		Usuario usuarioAutenticado = consultar( token );
		if( !usuarioAutenticado.papeis().contains( "AUTOGESTAO" ) ) {
			throw new ArgousFormsApiException( 403, "ACESSO_NEGADO", "Seu usuário não pode alterar a própria senha." );
		}
		if( !PoliticaSenha.atende( senhaNova ) ) {
			throw new ArgousFormsApiException( 400, "SENHA_FRACA", "A nova senha deve ter pelo menos 8 caracteres e atender a 3 destas 4 condições: maiúscula, minúscula, numeral e símbolo." );
		}

		try ( Conexao conexao = PoolDeConexoes.getConexao() ) {
			conexao.beginTransaction();
			try {
				// Query bloqueia FOR UPDATE; esta consulta JDBC apenas serializa trocas simultâneas da mesma conta.
				try ( PreparedStatement bloqueio = conexao.getConnection().prepareStatement( "select ID_USUARIO_SISTEMA from Cadastro.USUARIOS_SISTEMA where ID_USUARIO_SISTEMA = ? and DT_EXCLUSAO is null for update" ) ) {
					bloqueio.setObject( 1, usuarioAutenticado.idUsuario() );
					try ( ResultSet resultado = bloqueio.executeQuery() ) {
						if( !resultado.next() ) throw sessaoInvalida();
					}
				}
				try ( Query query = new Query( conexao ) ) {
					query.setSQL( "select 1 from Cadastro.HISTORICO_LOGINS where CD_BEARER_SHA256 = :hash and DT_REVOGACAO is null and DT_VALIDADE > CURRENT_TIMESTAMP" );
					query.setParameter( "hash", hash( token ) );
					query.executeQuery();
					if( query.isEmpty() ) throw sessaoInvalida();
				}

				UsuarioSistema usuario;
				try ( Query query = new Query( conexao ) ) {
					query.setSQL( "select * from Cadastro.USUARIOS_SISTEMA where ID_USUARIO_SISTEMA = :id and DT_EXCLUSAO is null" );
					query.setParameter( "id", usuarioAutenticado.idUsuario().toString() );
					query.executeQuery();
					if( query.isEmpty() ) throw sessaoInvalida();
					usuario = new UsuarioSistema();
					UsuarioSistemaLocalizador.buscaCampos( usuario, query );
				}

				if( !SenhaSegura.confere( senhaAtual, usuario.getCdHashSenha() ) ) {
					throw new ArgousFormsApiException( 401, "SENHA_ATUAL_INCORRETA", "A senha atual está incorreta." );
				}

				usuario.setCdHashSenha( SenhaSegura.gerarHash( senhaNova ) );
				new UsuarioSistemaNegocio( conexao, usuario ).altera();
				List<HistoricoLogin> outrasSessoes = new ArrayList<>();
				try ( Query query = new Query( conexao ) ) {
					query.setSQL( "select h.* from Cadastro.HISTORICO_LOGINS h "
						+ "join Cadastro.USUARIO_ORIGENS_LOGIN v on v.ID_USUARIO_ORIGEM_LOGIN = h.ID_USUARIO_ORIGEM_LOGIN "
						+ "where v.ID_USUARIO_SISTEMA = :id and h.CD_BEARER_SHA256 <> :hash and h.DT_REVOGACAO is null" );
					query.setParameter( "id", usuarioAutenticado.idUsuario().toString() );
					query.setParameter( "hash", hash( token ) );
					query.executeQuery();
					if( !query.isEmpty() ) {
						do {
							HistoricoLogin historico = new HistoricoLogin();
							HistoricoLoginLocalizador.buscaCampos( historico, query );
							outrasSessoes.add( historico );
						} while ( query.next() );
					}
				}
				QtData agora = new QtData( Instant.now().toEpochMilli() );
				for( HistoricoLogin historico : outrasSessoes ) {
					historico.setDtRevogacao( agora );
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
