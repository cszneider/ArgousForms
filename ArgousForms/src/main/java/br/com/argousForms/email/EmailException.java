package br.com.argousForms.email;

/** Mensagens desta exceção não devem conter credenciais nem o código de confirmação. */
public final class EmailException extends Exception {

	private static final long serialVersionUID = 1L;

	public EmailException(String mensagem) {
		super(mensagem);
	}
}
