package br.com.argousForms.email;

import quatro.util.ParametrosSistema;

/** Lê a configuração da instalação existente, sem carregar ou modificar arquivos. */
public final class EmailConfiguracao {

	private final String host;
	private final int porta;
	private final String conta;
	private final String senha;

	private EmailConfiguracao(String host, int porta, String conta, String senha) {
		this.host = host;
		this.porta = porta;
		this.conta = conta;
		this.senha = senha;
	}

	public static EmailConfiguracao carregar() throws EmailException {
		if (!ParametrosSistema.isParametrosInicializados()) {
			throw new EmailException("Os parâmetros da instalação ainda não foram carregados.");
		}

		ParametrosSistema parametros = ParametrosSistema.getInstance();
		String host = obrigatorio(parametros, "SMTP-Host").strip();
		String conta = obrigatorio(parametros, "contaEMail").strip();
		String senha = obrigatorio(parametros, "senhaEMail");
		int porta;

		try {
			porta = Integer.parseInt(obrigatorio(parametros, "SMTP-Port").strip());
		} catch (NumberFormatException e) {
			throw new EmailException("O parâmetro SMTP-Port deve ser uma porta numérica válida.");
		}

		if (porta < 1 || porta > 65535) {
			throw new EmailException("O parâmetro SMTP-Port deve estar entre 1 e 65535.");
		}

		return new EmailConfiguracao(host, porta, conta, senha);
	}

	private static String obrigatorio(ParametrosSistema parametros, String nome) throws EmailException {
		String valor = parametros.getParametro(nome);
		if (valor == null || valor.isBlank()) {
			throw new EmailException("Parâmetro de e-mail não configurado: " + nome + ".");
		}

		return valor;
	}

	public String getHost() {
		return host;
	}

	public int getPorta() {
		return porta;
	}

	public String getConta() {
		return conta;
	}

	String getSenha() {
		return senha;
	}
}
