package br.com.webhook.configuracao;

import java.nio.file.Path;
import java.nio.file.Files;

import jakarta.servlet.ServletContextEvent;
import jakarta.servlet.ServletContextListener;

public class ConfiguracaoListener implements ServletContextListener {

    @Override
    public void contextInitialized( ServletContextEvent evento ) {

        var contexto = evento.getServletContext();
        try {
            String diretorio = contexto.getRealPath( "/WEB-INF" );
            if( diretorio == null ) {
                throw new IllegalStateException( "Implantacao explodida necessaria." );
            }

            Path pasta = Path.of( diretorio );
            ConfiguracaoPermanente configuracao = ConfiguracaoPermanente.carregarOuCriar( pasta );
            boolean instalou = InstalacaoBanco.inicializar( configuracao, pasta );
            contexto.setAttribute( ConfiguracaoPermanente.ATRIBUTO_CONTEXTO, configuracao );
            contexto.log( instalou ? "Webhook: instalacao concluida. Schema agforms, tabelas, Administrador e configuracao criados." : "Webhook: instalacao existente verificada. Nenhum dado inicial foi recriado." );

            try {
                Files.deleteIfExists( pasta.resolve( "startup.xml" ) );
            } catch ( Exception erro ) {
                contexto.log( "Webhook: banco pronto, mas nao foi possivel remover WEB-INF/startup.xml. Remova o arquivo manualmente." );
            }
        } catch ( InstalacaoBanco.FalhaInstalacao erro ) {
            contexto.log( "Webhook: falha na instalacao do banco; " + erro.getMessage() + ". Startup preservado. Verifique conexao, permissoes e estado do schema agforms." );
        } catch ( Exception erro ) {
            // Não registrar mensagens ou stack traces que possam conter configuração sensível.
            contexto.log( "Webhook: configuracao indisponivel. Verifique WEB-INF/configuracao.xml ou startup.xml e as permissoes de escrita." );
        }
    }
}
