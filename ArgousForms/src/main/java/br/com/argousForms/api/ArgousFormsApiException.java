package br.com.argousForms.api;

public final class ArgousFormsApiException extends Exception {

	private static final long serialVersionUID = 1L;
	private final int statusHttp;
	private final String codigoErro;

	public ArgousFormsApiException(int statusHttp, String codigoErro, String mensagem) {
		super(mensagem);
		this.statusHttp = statusHttp;
		this.codigoErro = codigoErro;
	}

	public int getStatusHttp() {
		return statusHttp;
	}

	public String getCodigoErro() {
		return codigoErro;
	}
}
