package br.com.argousForms.cadastro;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.ObjectInputStream;
import java.io.ObjectOutputStream;
import java.io.Serializable;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import br.com.argousForms.api.ArgousFormsApiException;
import br.com.argousForms.email.EmailException;
import br.com.argousForms.model.negocio.cadastro.ConfirmacaoEmailNegocioEspecifico;
import br.com.argousForms.security.CodigoConfirmacao;
import br.com.argousForms.security.SenhaSegura;
import br.com.argousForms.model.persistencia.cadastro.ConfirmacaoEmail;
import br.com.argousForms.model.persistencia.cadastro.OrigemLogin;
import br.com.argousForms.model.persistencia.cadastro.UsuarioOrigemLogin;
import br.com.argousForms.model.persistencia.cadastro.UsuarioSistema;
import quatro.negocio.ErroDeNegocio;

/** Testa o fluxo sem banco/SMTP, incluindo atomicidade com falhas injetadas. */
public final class CadastroServiceVerificacao {

	private static final String EMAIL = "pessoa@example.com";
	private static final String SENHA = " senha de teste ";

	public static void main(String[] args) throws Exception {
		ConfirmacaoEmail provisoria = new ConfirmacaoEmail();
		provisoria.setCdHashToken( ConfirmacaoEmailNegocioEspecifico.HASH_AGUARDANDO );
		ConfirmacaoEmailNegocioEspecifico regra = new ConfirmacaoEmailNegocioEspecifico();
		regra.antesDeInserir( null, provisoria );
		try {
			regra.antesDeAlterar( null, provisoria );
			throw new AssertionError( "O hash provisório não pode permanecer após a inclusão." );
		} catch ( ErroDeNegocio esperada ) {
			// A alteração exige o HMAC definitivo.
		}

		Cenario c = new Cenario();
		CadastroService.Resultado resultado = c.service.cadastrar(" Pessoa ", " PESSOA@example.com ", SENHA);
		exigir(resultado.emailEnviado() && c.envios == 1, "Código deve ser enviado após commit");
		exigir(c.repo.estado.usuario.getDsEmail().equals(EMAIL), "Normalização de e-mail");
		exigir(c.repo.estado.usuario.getDsNome().equals("Pessoa"), "Normalização de nome");
		exigir(SenhaSegura.confere(SENHA, c.repo.estado.usuario.getCdHashSenha()), "Hash de senha verificável");
		exigir(!SenhaSegura.confere(SENHA.strip(), c.repo.estado.usuario.getCdHashSenha()), "Não alterar espaços da senha");
		exigir(!c.repo.estado.vinculo.isSnEmailVerificado(), "Novo usuário deve estar pendente");
		exigir(c.codigo.matches("[0-9]{8}") && !c.atual().getCdHashToken().equals(c.codigo), "Persistir somente hash do código");
		exigir(new CodigoConfirmacao(new byte[32]).confere(resultado.idConfirmacao(), c.repo.estado.usuario.getIdUsuarioSistema(), EMAIL, c.codigo, c.atual().getCdHashToken()), "Hash deve usar o UUID gerado na inclusão");
		exigir(c.atual().getDtValidade().getTimeInMillis() - c.relogio.millis() == 600_000, "Validade de dez minutos");
		erro("CADASTRO_INDISPONIVEL", () -> c.service.cadastrar("Outro", EMAIL, "outra senha"));
		exigir(SenhaSegura.confere(SENHA, c.repo.estado.usuario.getCdHashSenha()), "Duplicidade não pode substituir senha");
		c.service.confirmar(EMAIL, resultado.idConfirmacao(), c.codigo);
		exigir(c.repo.estado.vinculo.isSnEmailVerificado() && c.atual().getDtConfirmacao() != null, "Confirmação atômica");
		erro("CADASTRO_NAO_DISPONIVEL", () -> c.service.confirmar(EMAIL, resultado.idConfirmacao(), c.codigo));

		Cenario tentativas = novo();
		String errado = tentativas.codigo.equals("00000000") ? "11111111" : "00000000";
		for (int i = 1; i <= 5; i++) {
			erro("CODIGO_INVALIDO", () -> tentativas.service.confirmar(EMAIL, tentativas.atual().getIdConfirmacaoEmail(), errado));
			exigir(tentativas.atual().getNrTentativasInvalidas() == i, "Tentativa incorreta deve sobreviver à resposta de erro");
		}
		exigir(tentativas.atual().getDtRevogacao() != null, "Quinta falha revoga código");
		erro("CODIGO_INVALIDO", () -> tentativas.service.confirmar(EMAIL, tentativas.atual().getIdConfirmacaoEmail(), tentativas.codigo));

		Cenario expirado = novo();
		expirado.relogio.avancar(600);
		erro("CODIGO_INVALIDO", () -> expirado.service.confirmar(EMAIL, expirado.atual().getIdConfirmacaoEmail(), expirado.codigo));

		Cenario reenvio = novo();
		UUID anterior = reenvio.atual().getIdConfirmacaoEmail();
		String codigoAnterior = reenvio.codigo;
		erro("REENVIO_LIMITADO", () -> reenvio.service.reenviar(EMAIL, SENHA));
		reenvio.relogio.avancar(60);
		erro("CADASTRO_NAO_DISPONIVEL", () -> reenvio.service.reenviar(EMAIL, "senha incorreta"));
		reenvio.service.reenviar(EMAIL, SENHA);
		exigir(reenvio.repo.estado.confirmacoes.get(0).getDtRevogacao() != null, "Reenvio revoga anterior");
		erro("CODIGO_INVALIDO", () -> reenvio.service.confirmar(EMAIL, anterior, codigoAnterior));
		for (int i = 0; i < 3; i++) {
			reenvio.relogio.avancar(60);
			reenvio.service.reenviar(EMAIL, SENHA);
		}
		reenvio.relogio.avancar(60);
		erro("REENVIO_LIMITADO", () -> reenvio.service.reenviar(EMAIL, SENHA));

		for (int escrita = 1; escrita <= 4; escrita++) {
			Cenario falha = new Cenario();
			falha.repo.falharNaEscrita = escrita;
			falha(() -> falha.service.cadastrar("Pessoa", EMAIL, SENHA));
			exigir(falha.repo.estado.usuario == null && falha.repo.estado.vinculo == null && falha.repo.estado.confirmacoes.isEmpty(), "Rollback integral do cadastro");
			exigir(falha.envios == 0, "Não enviar antes do commit");
		}

		Cenario falhaConfirmacao = novo();
		falhaConfirmacao.repo.falharNaEscrita = 2;
		falha(() -> falhaConfirmacao.service.confirmar(EMAIL, falhaConfirmacao.atual().getIdConfirmacaoEmail(), falhaConfirmacao.codigo));
		exigir(!falhaConfirmacao.repo.estado.vinculo.isSnEmailVerificado() && falhaConfirmacao.atual().getDtConfirmacao() == null, "Rollback integral da confirmação");

		Cenario falhaReenvio = novo();
		falhaReenvio.relogio.avancar(60);
		falhaReenvio.repo.falharNaEscrita = 2;
		falha(() -> falhaReenvio.service.reenviar(EMAIL, SENHA));
		exigir(falhaReenvio.atual().getDtRevogacao() == null && falhaReenvio.repo.estado.confirmacoes.size() == 1, "Rollback preserva código anterior no reenvio");

		Cenario smtp = new Cenario();
		smtp.falhaSmtp = true;
		exigir(!smtp.service.cadastrar("Pessoa", EMAIL, SENHA).emailEnviado(), "Falha SMTP deve ser informada");
		exigir(smtp.repo.estado.usuario != null && !smtp.repo.estado.vinculo.isSnEmailVerificado(), "Falha SMTP preserva cadastro pendente");

		Cenario desabilitado = new Cenario();
		desabilitado.origem.setSnPermiteAutocadastro(false);
		erro("AUTOCADASTRO_INDISPONIVEL", () -> desabilitado.service.cadastrar("Pessoa", EMAIL, SENHA));
		exigir(desabilitado.repo.estado.usuario == null, "Respeitar origem desabilitada");

		Cenario origemExterna = new Cenario();
		origemExterna.origem.setTpAutenticacao( "G" );
		erro( "AUTOCADASTRO_INDISPONIVEL", () -> origemExterna.service.cadastrar( "Pessoa", EMAIL, SENHA ) );
		exigir( origemExterna.repo.estado.usuario == null, "Origem externa não pode cadastrar senha local" );

		CodigoConfirmacao codigos = new CodigoConfirmacao(new byte[32]);
		UUID id = UUID.randomUUID(), usuario = UUID.randomUUID();
		String hash = codigos.hash(id, usuario, EMAIL, "12345678");
		exigir(!codigos.confere(UUID.randomUUID(), usuario, EMAIL, "12345678", hash), "Hash deve estar vinculado à solicitação");
		exigir(!codigos.confere(id, usuario, "outro@example.com", "12345678", hash), "Hash deve estar vinculado ao e-mail");
		exigir(hash.length() == 64, "HMAC deve caber em 64 caracteres");

		Relogio relogio = new Relogio();
		LimiteCadastro limite = new LimiteCadastro(relogio);
		for (int i = 0; i < 30; i++) limite.verificar("127.0.0.1");
		erro("LIMITE_CADASTRO", () -> limite.verificar("127.0.0.1"));
		relogio.avancar(600);
		limite.verificar("127.0.0.1");
		System.out.println("Cadastro: cenários de sucesso, duplicidade, rollback, tentativas, expiração, reenvio, SMTP e limites aprovados.");
	}

	private static Cenario novo() throws Exception {
		Cenario c = new Cenario();
		c.service.cadastrar("Pessoa", EMAIL, SENHA);
		return c;
	}

	private static void exigir(boolean condicao, String mensagem) {
		if (!condicao) throw new AssertionError(mensagem);
	}

	@FunctionalInterface
	private interface Acao { void executar() throws Exception; }

	private static void erro(String codigo, Acao acao) throws Exception {
		try {
			acao.executar();
			throw new AssertionError("Erro esperado: " + codigo);
		} catch (ArgousFormsApiException e) {
			exigir(e.getCodigoErro().equals(codigo), "Código inesperado: " + e.getCodigoErro());
		}
	}

	private static void falha(Acao acao) throws Exception {
		try {
			acao.executar();
			throw new AssertionError("Falha de escrita esperada");
		} catch (FalhaSimulada esperada) {
		}
	}

	private static final class FalhaSimulada extends Exception { private static final long serialVersionUID = 1L; }

	private static final class Cenario {
		private final Relogio relogio = new Relogio();
		private final OrigemLogin origem = new OrigemLogin();
		private final Repositorio repo = new Repositorio(origem);
		private final CadastroService service;
		private int envios;
		private String codigo;
		private boolean falhaSmtp;

		private Cenario() {
			origem.setIdOrigemLogin(UUID.randomUUID());
			origem.setTpAutenticacao( "L" );
			origem.setSnAtiva(true);
			origem.setSnPermiteAutocadastro(true);
			service = new CadastroService(repo, new CodigoConfirmacao(new byte[32]), origem.getIdOrigemLogin(), relogio, (email, codigo) -> {
				exigir(!repo.aberta && repo.commits > 0, "SMTP deve ocorrer após commit e liberação da conexão");
				if (falhaSmtp) throw new EmailException("Falha simulada");
				this.codigo = codigo;
				envios++;
			});
		}

		private ConfirmacaoEmail atual() {
			return repo.estado.confirmacoes.get(repo.estado.confirmacoes.size() - 1);
		}
	}

	private static final class Relogio extends Clock {
		private Instant agora = Instant.parse("2026-10-07T12:00:00Z");
		public ZoneId getZone() { return ZoneOffset.UTC; }
		public Clock withZone(ZoneId zona) { return this; }
		public Instant instant() { return agora; }
		private void avancar(int segundos) { agora = agora.plusSeconds(segundos); }
	}

	private static final class Estado implements Serializable {
		private static final long serialVersionUID = 1L;
		private UsuarioSistema usuario;
		private UsuarioOrigemLogin vinculo;
		private List<ConfirmacaoEmail> confirmacoes = new ArrayList<>();
	}

	private static final class Repositorio implements CadastroRepositorio {
		private Estado estado = new Estado();
		private final OrigemLogin origem;
		private boolean aberta;
		private int commits;
		private int falharNaEscrita;

		private Repositorio(OrigemLogin origem) { this.origem = origem; }

		public Transacao abrir() {
			return new Transacao() {
				private Estado antes;
				private int escritas;
				public void iniciar() throws Exception {
					exigir(!aberta, "Não criar transações aninhadas");
					ByteArrayOutputStream buffer = new ByteArrayOutputStream();
					try (ObjectOutputStream out = new ObjectOutputStream(buffer)) { out.writeObject(estado); }
					try (ObjectInputStream in = new ObjectInputStream(new ByteArrayInputStream(buffer.toByteArray()))) { antes = (Estado) in.readObject(); }
					aberta = true;
				}
				public void commit() { commits++; aberta = false; }
				public void rollback() { if (aberta) estado = antes; aberta = false; }
				public void close() { exigir(!aberta, "Transação deve terminar antes da liberação"); }
				public void bloquearEmail(String email) { exigir(aberta, "Bloqueio deve pertencer à transação"); }
				public OrigemLogin origem(UUID id) { return origem.getIdOrigemLogin().equals(id) ? origem : null; }
				public UsuarioSistema usuario(String email) { return estado.usuario != null && estado.usuario.getDsEmail().equals(email) ? estado.usuario : null; }
				public UsuarioOrigemLogin vinculo(UUID usuario, UUID origem) { return estado.vinculo; }
				public List<ConfirmacaoEmail> confirmacoes(UUID usuario) { return estado.confirmacoes; }
				private void escrita() throws Exception { if (++escritas == falharNaEscrita) throw new FalhaSimulada(); }
				public void inserir(UsuarioSistema usuario) throws Exception { escrita(); estado.usuario = usuario; }
				public void inserir(UsuarioOrigemLogin vinculo) throws Exception { escrita(); estado.vinculo = vinculo; }
				public void inserir(ConfirmacaoEmail confirmacao) throws Exception {
					escrita();
					exigir(confirmacao.getIdConfirmacaoEmail() == null, "UUID da confirmação deve ser gerado na inclusão");
					exigir(ConfirmacaoEmailNegocioEspecifico.HASH_AGUARDANDO.equals(confirmacao.getCdHashToken()), "Inserção deve usar hash provisório");
					confirmacao.setIdConfirmacaoEmail(UUID.randomUUID());
					estado.confirmacoes.add(confirmacao);
				}
				public void alterar(UsuarioOrigemLogin vinculo) throws Exception { escrita(); }
				public void alterar(ConfirmacaoEmail confirmacao) throws Exception {
					escrita();
					exigir(!ConfirmacaoEmailNegocioEspecifico.HASH_AGUARDANDO.equals(confirmacao.getCdHashToken()), "Hash provisório não pode ser confirmado");
				}
			};
		}
	}
}
