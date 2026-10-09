package br.com.argousForms.api;

import java.io.ByteArrayInputStream;
import java.io.PrintWriter;
import java.io.StringWriter;
import java.lang.reflect.Proxy;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;
import javax.servlet.ReadListener;
import javax.servlet.ServletInputStream;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import org.json.JSONObject;

/** Verificação executável sem servidor, banco, SMTP ou dependências de teste adicionais. */
public final class ArgousFormsResolverVerificacao {

	public static void main(String[] args) throws Exception {
		verificar("GET", "application/json", "", 405, "METODO_NAO_PERMITIDO");
		verificar("POST", "application/json-invalido", "{}", 415, "CONTENT_TYPE_INVALIDO");
		verificar("POST", "application/json", "", 400, "JSON_INVALIDO");
		verificar("POST", "application/json", "[]", 400, "JSON_INVALIDO");
		verificar("POST", "application/json", "{}{}", 400, "JSON_INVALIDO");
		verificar("POST", "application/json", "{", 400, "JSON_INVALIDO");
		verificar("POST", "application/json", "{}", 400, "CAMPO_INVALIDO");
		verificar("POST", "application/json", "{\"operacao\":\"CADASTRAR_USUARIO\",\"dados\":[]}", 400, "REQUISICAO_INVALIDA");
		verificar("POST", "application/json; charset=UTF-8", "{\"operacao\":\"DESCONHECIDA\",\"dados\":{}}", 404, "OPERACAO_NAO_ENCONTRADA");
		verificar("POST", "application/json", " ".repeat(65537), 413, "PAYLOAD_MUITO_GRANDE");

		Resposta utf8 = chamar("POST", "application/json", new byte[] { (byte) 0xC3, 0x28 });
		exigir(utf8.status == 400, "UTF-8 inválido deve ser rejeitado");

		JSONObject senha = new JSONObject("{\"senha\":\" senha com espaços \"}");
		exigir(" senha com espaços ".equals(ArgousFormsJson.getStringObrigatoria(senha, "senha", false)), "Senha deve preservar espaços");
		System.out.println("12 verificações concluídas: transporte HTTP, limites, JSON, UTF-8 e preservação da senha.");
	}

	private static void verificar(String metodo, String tipo, String corpo, int status, String codigo) throws Exception {
		
		Resposta resposta = chamar(metodo, tipo, corpo.getBytes(StandardCharsets.UTF_8));
		exigir(resposta.status == status, "Status esperado: " + status + "; recebido: " + resposta.status);
		JSONObject json = new JSONObject(resposta.corpo.toString());
		exigir(codigo.equals(json.getString("codigoErro")), "Código de erro inesperado");
		exigir("no-store".equals(resposta.headers.get("Cache-Control")), "Resposta não deve ser armazenada em cache");
		if (status == 405) {
			exigir("POST".equals(resposta.headers.get("Allow")), "Cabeçalho Allow deve ser preservado");
		}
	}

	private static Resposta chamar(String metodo, String tipo, byte[] corpo) throws Exception {
		
		ByteArrayInputStream bytes = new ByteArrayInputStream(corpo);
		ServletInputStream entrada = new ServletInputStream() {
			@Override
			public int read() {
				return bytes.read();
			}

			@Override
			public boolean isFinished() {
				return bytes.available() == 0;
			}

			@Override
			public boolean isReady() {
				return true;
			}

			@Override
			public void setReadListener(ReadListener listener) {
				throw new UnsupportedOperationException();
			}
		};

		HttpServletRequest request = (HttpServletRequest) Proxy.newProxyInstance(HttpServletRequest.class.getClassLoader(), new Class<?>[] { HttpServletRequest.class }, (proxy, method, args) -> {
			return switch (method.getName()) {
				case "getMethod" -> metodo;
				case "getContentType" -> tipo;
				case "getContentLengthLong" -> -1L; // Verifica o limite mesmo sem Content-Length.
				case "getInputStream" -> entrada;
				default -> null;
			};
		});

		Resposta resultado = new Resposta();
		HttpServletResponse response = (HttpServletResponse) Proxy.newProxyInstance(HttpServletResponse.class.getClassLoader(), new Class<?>[] { HttpServletResponse.class }, (proxy, method, args) -> {
			switch (method.getName()) {
				case "setStatus" -> resultado.status = (Integer) args[0];
				case "setHeader" -> resultado.headers.put((String) args[0], (String) args[1]);
				case "getWriter" -> { return new PrintWriter(resultado.corpo); }
				case "isCommitted" -> { return false; }
				case "resetBuffer" -> resultado.corpo.getBuffer().setLength(0);
			}
			return null;
		});

		new ArgousFormsResolver().service(request, response);
		return resultado;
	}

	private static void exigir(boolean condicao, String mensagem) {
		if (!condicao) {
			throw new AssertionError(mensagem);
		}
	}

	private static final class Resposta {
		private int status;
		private final StringWriter corpo = new StringWriter();
		private final Map<String, String> headers = new HashMap<>();
	}
}
