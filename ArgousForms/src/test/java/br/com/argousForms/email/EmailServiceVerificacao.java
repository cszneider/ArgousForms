package br.com.argousForms.email;

/** Verifica a validação antes do envio; não carrega configuração nem conecta ao SMTP. */
public final class EmailServiceVerificacao {

	public static void main(String[] args) throws Exception {
		EmailService.validarEndereco("pessoa@example.com");
		String[] invalidos = { "", "sem-dominio", "a@example.com,b@example.com", "Pessoa <a@example.com>", "a@example.com\r\nBcc: b@example.com" };
		for (String endereco : invalidos) {
			try {
				EmailService.validarEndereco(endereco);
				throw new AssertionError("Endereço inválido foi aceito");
			} catch (EmailException esperada) {
				// Rejeição antes de construir ou enviar a mensagem.
			}
		}

		try {
			new EmailService().enviarConfirmacao("pessoa@example.com", "1234");
			throw new AssertionError("Código inválido foi aceito");
		} catch (EmailException esperada) {
			if (!esperada.getMessage().contains("oito dígitos")) {
				throw new AssertionError("A validação do código deve ocorrer antes da configuração SMTP");
			}
		}
		System.out.println("7 verificações concluídas: destinatário único, rejeição de cabeçalhos e validação do código.");
	}
}
