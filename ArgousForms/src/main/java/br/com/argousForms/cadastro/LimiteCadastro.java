package br.com.argousForms.cadastro;

import java.time.Clock;
import java.util.HashMap;
import java.util.Map;
import br.com.argousForms.api.ArgousFormsApiException;

/** Proteção local por IP. Em múltiplas instâncias, requer limitação compartilhada no ingresso. */
public final class LimiteCadastro {

	private final Map<String, Janela> janelas = new HashMap<>();
	private final Clock relogio;

	public LimiteCadastro() {
		this(Clock.systemUTC());
	}

	LimiteCadastro(Clock relogio) {
		this.relogio = relogio;
	}

	public synchronized void verificar(String ip) throws ArgousFormsApiException {
		long agora = relogio.millis();
		janelas.entrySet().removeIf(entrada -> entrada.getValue().fim <= agora);
		String chave = ip == null ? "desconhecido" : ip;
		Janela janela = janelas.get(chave);
		if (janela == null) {
			if (janelas.size() >= 10_000) throw limitado();
			janela = new Janela(agora + 600_000);
			janelas.put(chave, janela);
		}
		if (janela.tentativas >= 30) throw limitado();
		janela.tentativas++;
	}

	private static ArgousFormsApiException limitado() {
		return new ArgousFormsApiException(429, "LIMITE_CADASTRO", "Muitas solicitações. Aguarde antes de tentar novamente.");
	}

	private static final class Janela {
		private final long fim;
		private int tentativas;

		private Janela(long fim) {
			this.fim = fim;
		}
	}
}
