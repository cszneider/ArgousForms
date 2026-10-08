package br.com.argousForms.api;

import java.io.IOException;
import java.util.Map;
import javax.servlet.http.HttpServletResponse;
import org.json.JSONObject;

public final class ArgousFormsJson {

	private ArgousFormsJson() {
	}

	public static String getStringObrigatoria(JSONObject dados, String campo, boolean removerEspacos) throws ArgousFormsApiException {
		Object valor = dados.opt(campo);
		if (!(valor instanceof String texto) || texto.isBlank()) {
			throw new ArgousFormsApiException(400, "CAMPO_INVALIDO", "Informe um texto válido para o campo " + campo + ".");
		}

		return removerEspacos ? texto.strip() : texto;
	}

	public static void enviarSucesso(HttpServletResponse response, int statusHttp, JSONObject dados) throws IOException {
		enviar(response, statusHttp, new JSONObject(Map.of("status", "ok", "dados", dados)));
	}

	public static void enviarErro(HttpServletResponse response, int statusHttp, String codigo, String mensagem) throws IOException {
		if (response.isCommitted()) {
			return;
		}

		response.resetBuffer();
		JSONObject json = new JSONObject(Map.of("status", "erro", "codigoErro", codigo, "statusCode", statusHttp, "mensagem", mensagem));
		enviar(response, statusHttp, json);
	}

	private static void enviar(HttpServletResponse response, int statusHttp, JSONObject json) throws IOException {
		response.setStatus(statusHttp);
		response.setCharacterEncoding("UTF-8");
		response.setContentType("application/json");
		response.setHeader("Cache-Control", "no-store");
		response.setHeader("X-Content-Type-Options", "nosniff");
		response.getWriter().write(json.toString());
	}
}
