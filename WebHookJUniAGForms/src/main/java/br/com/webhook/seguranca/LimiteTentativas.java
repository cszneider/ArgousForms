package br.com.webhook.seguranca;

import java.util.HashMap;
import java.util.Map;

/** Limite local por IP, sem persistir identificadores de contas ou senhas. */
public final class LimiteTentativas {

    private final Map<String, Janela> janelas = new HashMap<>();
    private static final long INTERVALO_MS = 300_000;

    public synchronized boolean permitir( String ip ) {

        long agora = System.currentTimeMillis();
        Janela janela = janelas.get( ip );
        if( janela == null || agora - janela.inicio >= INTERVALO_MS ) {
            if( janelas.size() >= 10_000 ) janelas.entrySet().removeIf( entrada -> agora - entrada.getValue().inicio >= INTERVALO_MS );
            if( janela == null && janelas.size() >= 10_000 ) return false;
            janelas.put( ip, new Janela( agora, 1 ) );
            return true;
        }
        if( janela.tentativas >= 10 ) return false;
        janelas.put( ip, new Janela( janela.inicio, janela.tentativas + 1 ) );

        return true;
    }

    private record Janela( long inicio, int tentativas ) {}
}
