package br.com.argousForms.cadastro;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import javax.mail.internet.InternetAddress;
import javax.servlet.ServletContext;
import br.com.argousForms.api.ArgousFormsApiException;
import br.com.argousForms.email.EmailException;
import br.com.argousForms.email.EmailService;
import br.com.argousForms.model.negocio.cadastro.ConfirmacaoEmailNegocioEspecifico;
import br.com.argousForms.security.CodigoConfirmacao;
import br.com.argousForms.security.SenhaSegura;
import br.com.argousForms.model.persistencia.cadastro.ConfirmacaoEmail;
import br.com.argousForms.model.persistencia.cadastro.OrigemLogin;
import br.com.argousForms.model.persistencia.cadastro.UsuarioOrigemLogin;
import br.com.argousForms.model.persistencia.cadastro.UsuarioSistema;
import quatro.util.QtData;

public final class CadastroService {

	private static final String TIPO_AUTENTICACAO_LOCAL = "L";
	private final CadastroRepositorio repositorio;
	private final CodigoConfirmacao codigos;
	private final UUID origemLocal;
	private final Clock relogio;
	private final EnvioEmail envio;

	@FunctionalInterface
	interface EnvioEmail {
		void enviar(String email, String codigo) throws EmailException;
	}

	public record Resultado(UUID idConfirmacao, boolean emailEnviado) {
	}

	public static CadastroService daInstalacao( ServletContext contexto ) throws ArgousFormsApiException {

		return new CadastroService( new CadastroRepositorioQuatro(), CadastroConfiguracao.codigos( contexto ), CadastroConfiguracao.origemLocal(), Clock.systemUTC(), new EmailService()::enviarConfirmacao );
	}

	CadastroService( CadastroRepositorio repositorio, CodigoConfirmacao codigos, UUID origemLocal, Clock relogio, EnvioEmail envio ) {

		this.repositorio = repositorio;
		this.codigos = codigos;
		this.origemLocal = origemLocal;
		this.relogio = relogio;
		this.envio = envio;
	}

	public Resultado cadastrar(String nome, String emailInformado, String senha) throws Exception {
		String email = normalizarEmail(emailInformado);
		if (nome == null || nome.isBlank() || nome.strip().length() > 200) throw invalido("Informe o nome, com até 200 caracteres.");
		validarSenha(senha);
		String hashSenha = SenhaSegura.gerarHash(senha);
		String codigo = codigos.gerar();
		ConfirmacaoEmail confirmacao;

		try (CadastroRepositorio.Transacao tx = repositorio.abrir()) {
			tx.iniciar();
			try {
				tx.bloquearEmail(email);
				exigirOrigem(tx);
				if (tx.usuario(email) != null) {
					throw new ArgousFormsApiException(409, "CADASTRO_INDISPONIVEL", "Não foi possível iniciar um novo cadastro com esses dados. Se já iniciou, utilize o reenvio do código.");
				}

				Instant agora = relogio.instant();
				UsuarioSistema usuario = new UsuarioSistema();
				usuario.setIdUsuarioSistema(UUID.randomUUID());
				usuario.setDsNome(nome.strip());
				usuario.setDsEmail(email);
				usuario.setCdHashSenha(hashSenha);
				usuario.setDtInclusao(data(agora));
				tx.inserir(usuario);

				UsuarioOrigemLogin vinculo = new UsuarioOrigemLogin();
				vinculo.setIdUsuarioOrigemLogin(UUID.randomUUID());
				vinculo.setIdUsuarioSistema(usuario.getIdUsuarioSistema());
				vinculo.setIdOrigemLogin(origemLocal);
				vinculo.setCdUsuarioNaOrigem(email);
				vinculo.setDsEmailOrigem(email);
				vinculo.setSnEmailVerificado(false);
				vinculo.setDtInclusao(data(agora));
				tx.inserir(vinculo);

				confirmacao = novaConfirmacao(usuario, agora);
				gravarConfirmacao( tx, confirmacao, codigo );
				// Nenhum UsuarioPerfil e nenhuma sessão são criados pelo autocadastro.
				tx.commit();
			} catch (Exception e) {
				reverter(tx, e);
				throw e;
			}
		}

		// SMTP não participa da transação: falhas preservam o cadastro pendente para reenvio.
		return enviar(confirmacao, codigo);
	}

	public Resultado reenviar(String emailInformado, String senha) throws Exception {
		String email = normalizarEmail(emailInformado);
		validarSenha(senha);
		String codigo = codigos.gerar();
		ConfirmacaoEmail nova;

		try (CadastroRepositorio.Transacao tx = repositorio.abrir()) {
			tx.iniciar();
			try {
				tx.bloquearEmail(email);
				exigirOrigem(tx);
				UsuarioSistema usuario = tx.usuario(email);
				if (usuario == null || usuario.getDtExclusao() != null || !SenhaSegura.confere(senha, usuario.getCdHashSenha())) throw cadastroNaoEncontrado();
				exigirVinculoPendente(tx, usuario, email);
				Instant agora = relogio.instant();
				List<ConfirmacaoEmail> anteriores = tx.confirmacoes(usuario.getIdUsuarioSistema());
				long naHora = anteriores.stream().filter(c -> c.getDtInclusao().getTimeInMillis() > agora.minus(Duration.ofHours(1)).toEpochMilli()).count();
				boolean recente = anteriores.stream().anyMatch(c -> c.getDtInclusao().getTimeInMillis() > agora.minusSeconds(60).toEpochMilli());
				if (recente || naHora >= 5) throw new ArgousFormsApiException(429, "REENVIO_LIMITADO", "Aguarde antes de solicitar outro código.");

				for (ConfirmacaoEmail anterior : anteriores) {
					if (anterior.getDtConfirmacao() == null && anterior.getDtRevogacao() == null) {
						anterior.setDtRevogacao(data(agora));
						tx.alterar(anterior);
					}
				}
				nova = novaConfirmacao(usuario, agora);
				gravarConfirmacao( tx, nova, codigo );
				tx.commit();
			} catch (Exception e) {
				reverter(tx, e);
				throw e;
			}
		}
		return enviar(nova, codigo);
	}

	public void confirmar( String emailInformado, UUID idConfirmacao, String codigo ) throws Exception {

		String email = normalizarEmail( emailInformado );
		ArgousFormsApiException rejeicao = null;

		try ( CadastroRepositorio.Transacao tx = repositorio.abrir() ) {
			tx.iniciar();
			try {
				tx.bloquearEmail( email );
				exigirOrigem( tx );
				UsuarioSistema usuario = tx.usuario( email );
				if( usuario == null ) {
					throw codigoInvalido();
				}
				if( usuario.getDtExclusao() != null ) {
					throw codigoInvalido();
				}

				UsuarioOrigemLogin vinculo = exigirVinculoPendente( tx, usuario, email );
				ConfirmacaoEmail confirmacao = tx.confirmacoes( usuario.getIdUsuarioSistema() ).stream()
					.filter( c -> c.getIdConfirmacaoEmail().equals( idConfirmacao ) ).findFirst().orElse( null );
				if( confirmacao == null ) {
					throw codigoInvalido();
				}

				Instant agora = relogio.instant();
				if( !email.equals( confirmacao.getDsEmail() ) ) {
					throw codigoInvalido();
				}
				if( confirmacao.getDtConfirmacao() != null ) {
					throw codigoInvalido();
				}
				if( confirmacao.getDtRevogacao() != null ) {
					throw codigoInvalido();
				}
				if( confirmacao.getDtValidade() == null ) {
					throw codigoInvalido();
				}
				if( confirmacao.getDtValidade().getTimeInMillis() <= agora.toEpochMilli() ) {
					throw codigoInvalido();
				}

				int tentativas = confirmacao.getNrTentativasInvalidas() == null ? 0 : confirmacao.getNrTentativasInvalidas();
				if( tentativas >= 5 ) {
					throw codigoInvalido();
				}

				if( !codigos.confere( idConfirmacao, usuario.getIdUsuarioSistema(), email, codigo, confirmacao.getCdHashToken() ) ) {
					confirmacao.setNrTentativasInvalidas( tentativas + 1 );
					if( tentativas + 1 >= 5 ) confirmacao.setDtRevogacao( data( agora ) );
					tx.alterar( confirmacao );
					rejeicao = codigoInvalido();
				} else {
					confirmacao.setDtConfirmacao( data( agora ) );
					vinculo.setSnEmailVerificado( true );
					tx.alterar( confirmacao );
					tx.alterar( vinculo );
				}
				tx.commit();
			} catch ( Exception e ) {
				reverter( tx, e );
				throw e;
			}
		}

		// A tentativa incorreta precisa permanecer gravada mesmo quando a API responde com erro.
		if( rejeicao != null ) throw rejeicao;
	}

	private ConfirmacaoEmail novaConfirmacao( UsuarioSistema usuario, Instant agora ) {

		ConfirmacaoEmail confirmacao = new ConfirmacaoEmail();
		confirmacao.setIdUsuarioSistema( usuario.getIdUsuarioSistema() );
		confirmacao.setDsEmail( usuario.getDsEmail() );
		confirmacao.setCdHashToken( ConfirmacaoEmailNegocioEspecifico.HASH_AGUARDANDO );
		confirmacao.setDtInclusao( data( agora ) );
		confirmacao.setDtValidade( data( agora.plusSeconds( 600 ) ) );
		confirmacao.setNrTentativasInvalidas( 0 );
		return confirmacao;
	}

	private void gravarConfirmacao( CadastroRepositorio.Transacao tx, ConfirmacaoEmail confirmacao, String codigo ) throws Exception {

		tx.inserir( confirmacao );
		if( confirmacao.getIdConfirmacaoEmail() == null ) throw new IllegalStateException( "A inclusão não retornou o identificador da confirmação." );

		confirmacao.setCdHashToken( codigos.hash( confirmacao.getIdConfirmacaoEmail(), confirmacao.getIdUsuarioSistema(), confirmacao.getDsEmail(), codigo ) );
		tx.alterar( confirmacao );
	}

	private void exigirOrigem( CadastroRepositorio.Transacao tx ) throws Exception {

		OrigemLogin origem = tx.origem( origemLocal );
		if( origem == null || !origem.isSnAtiva() || !origem.isSnPermiteAutocadastro()
				|| origem.getDtExclusao() != null || !TIPO_AUTENTICACAO_LOCAL.equals( origem.getTpAutenticacao() ) ) {
			throw new ArgousFormsApiException( 503, "AUTOCADASTRO_INDISPONIVEL", "O cadastro local não está disponível nesta instalação." );
		}
	}

	private UsuarioOrigemLogin exigirVinculoPendente(CadastroRepositorio.Transacao tx, UsuarioSistema usuario, String email) throws Exception {
		UsuarioOrigemLogin vinculo = tx.vinculo(usuario.getIdUsuarioSistema(), origemLocal);
		if (vinculo == null || vinculo.getDtRevogacao() != null || vinculo.isSnEmailVerificado() || !email.equals(vinculo.getDsEmailOrigem())) throw cadastroNaoEncontrado();
		return vinculo;
	}

	private Resultado enviar( ConfirmacaoEmail confirmacao, String codigo ) {

		try {
			envio.enviar( confirmacao.getDsEmail(), codigo );
			return new Resultado( confirmacao.getIdConfirmacaoEmail(), true );
		} catch ( EmailException e ) {
			return new Resultado( confirmacao.getIdConfirmacaoEmail(), false );
		}
	}

	static String normalizarEmail(String email) throws ArgousFormsApiException {
		if (email == null || email.isBlank() || email.length() > 254 || email.contains("\r") || email.contains("\n")) throw invalido("Informe um e-mail válido.");
		String normalizado = email.strip().toLowerCase(Locale.ROOT);
		try {
			InternetAddress[] enderecos = InternetAddress.parse(normalizado, true);
			if (enderecos.length != 1 || enderecos[0].isGroup() || enderecos[0].getPersonal() != null || !enderecos[0].getAddress().equals(normalizado)) throw invalido("Informe somente o endereço de e-mail.");
			enderecos[0].validate();
		} catch (javax.mail.internet.AddressException e) {
			throw invalido("Informe um e-mail válido.");
		}
		return normalizado;
	}

	private static void validarSenha(String senha) throws ArgousFormsApiException {
		if (senha == null || senha.isBlank() || senha.length() < 8 || senha.length() > 1024) throw invalido("A senha deve ter entre 8 e 1024 caracteres.");
	}

	private static QtData data(Instant instante) {
		return new QtData(instante.toEpochMilli());
	}

	private static void reverter(CadastroRepositorio.Transacao tx, Exception original) {
		try {
			tx.rollback();
		} catch (Exception falha) {
			original.addSuppressed(falha);
		}
	}

	private static ArgousFormsApiException invalido(String mensagem) {
		return new ArgousFormsApiException(400, "CADASTRO_INVALIDO", mensagem);
	}

	private static ArgousFormsApiException codigoInvalido() {
		return new ArgousFormsApiException(400, "CODIGO_INVALIDO", "Código inválido, expirado ou já utilizado.");
	}

	private static ArgousFormsApiException cadastroNaoEncontrado() {
		return new ArgousFormsApiException(400, "CADASTRO_NAO_DISPONIVEL", "Não foi possível continuar esse cadastro. Verifique os dados informados.");
	}
}
