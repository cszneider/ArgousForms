# Ajustes da base existente

Cada script desta pasta levou a base de desenvolvimento já existente de uma versão da estrutura à seguinte, sem recriá-la. Nome: `AAAA-MM-DD-objetivo.sql`.

**Banco novo não executa ajustes.** A estrutura e as regras atuais (`../estrutura/`, `../regras/`, `../cargas/`) já contêm o resultado de todos os ajustes marcados como *incorporado*.

Situações:
- **incorporado**: o efeito já está em `estrutura/`, `regras/` ou `cargas/`. Mantido só como histórico.
- **pendente**: ainda não está nos scripts oficiais; deve ser incorporado ou executado.
- **só base antiga**: corrigiu um estado intermediário da base antiga (renomeação, correção pontual); não tem efeito em banco novo.

Conferência de 20/11/2026: cada coluna, tabela, índice, função, trigger, restrição e registro de carga citado nos scripts foi procurado nos scripts oficiais. Restrições que os ajustes nomeiam (`ck_*`, `fk_*`) aparecem na estrutura como `CHECK` ou `FOREIGN KEY` equivalentes, sem nome.

| Data | Script | Objetivo | Situação |
|---|---|---|---|
| 2026-10-12 | `2026-10-12-ajuste-papeis-perfis.sql` | Papéis e perfis padrão; perfil `ESSENCIAL` | incorporado (`cargas/carga-manual-teste.sql`) |
| 2026-10-15 | `2026-10-15-adequar-estrutura-documentos.sql` | Lixeira, tamanho máximo, índices únicos de Docs, RAIZ | incorporado |
| 2026-10-15 | `2026-10-15-ajuste-gestao-documentos.sql` | Papel `GESTAO_DOCUMENTOS` no perfil `ADMINISTRADOR` | incorporado (carga) |
| 2026-10-29 | `2026-10-29-ajuste-instituicao-processos.sql` | `SN_PERMITIR_DESTINATARIOS_UNICOS` e lixeira positiva | incorporado |
| 2026-10-29 | `2026-10-29-corrigir-responsavel-vigente.sql` | Corrige função (`max(uuid)` inexistente) | incorporado (`regras/validar-processos.sql`) |
| 2026-11-02 | `2026-11-02-adequar-protocolos.sql` | `PROTOCOLOS.ID_PASTA` opcional | incorporado |
| 2026-11-03 | `2026-11-03-ajuste-etapas-sem-tipo.sql` | Funções de validação após remover `TP_ETAPA` | incorporado (regras) |
| 2026-11-04 | `2026-11-04-adequar-campos-pdf-variaveis-instituicao.sql` | Campo de PDF com origem na instituição | incorporado |
| 2026-11-04 | `2026-11-04-adequar-html-partes.sql` | Partes do documento HTML | incorporado |
| 2026-11-04 | `2026-11-04-adequar-instituicao-webhook.sql` | Fuso, URLs de webhook e restrições da instituição | incorporado |
| 2026-11-04 | `2026-11-04-adequar-publicacao-protocolos.sql` | `ck_protocolo_versao_publicacao` | incorporado |
| 2026-11-04 | `2026-11-04-habilitar-publicacao-protocolos.sql` | Papel/perfil `GESTOR_DE_PROTOCOLOS` | incorporado (carga) |
| 2026-11-05 | `2026-11-05-adequar-recursos.sql` | Recursos da instituição e do Protocolo | incorporado |
| 2026-11-05 | `2026-11-05-ajuste-administrador-instituicao.sql` | Papel `ADMINISTRADOR_INSTITUICAO` no perfil `ADMINISTRADOR` | incorporado (carga) |
| 2026-11-05 | `2026-11-05-renomear-chave-recurso-protocolo.sql` | Renomeia chave e índice de recurso | só base antiga |
| 2026-11-06 | `2026-11-06-ajuste-gestores-elegiveis.sql` | Publicação exige gestor elegível | incorporado (regras) |
| 2026-11-09 | `2026-11-09-adequar-validade-sessoes.sql` | Dias de sessão móvel e absoluta | incorporado |
| 2026-11-11 | `2026-11-11-ajuste-desenvolvedor.sql` | Papel/perfil `DESENVOLVEDOR` | incorporado (carga) |
| 2026-11-13 | `2026-11-13-adequar-integracao.sql` | Chaves de webhook, consultas e tentativas de integração | incorporado |
| 2026-11-14 | `2026-11-14-adequar-finalizacao-vencimento-protocolos.sql` | `SN_GESTOR_FINALIZA` e dias de vencimento | incorporado |
| 2026-11-14 | `2026-11-14-adequar-notificacoes-documentos.sql` | Schema Notificacoes e `ARQUIVOS.DT_ALTERACAO` | incorporado |
| 2026-11-14 | `2026-11-14-renomear-eventos-notificacoes.sql` | Renomeia `Notificacoes_EVENTOS` para `EVENTOS` | só base antiga |
| 2026-11-16 | `2026-11-16-adequar-dominios-css-importacao.sql` | Domínios permitidos para importar CSS | incorporado |
| 2026-11-17 | `2026-11-17-adequar-html-css.sql` | CSS separado do documento HTML | incorporado |
| 2026-11-20 | `2026-11-20-adequar-fluxo-concentrador-resultado.sql` | Concentrador (`TP_BLOCO`), encaminhamento `C`, resultado do processo, regras de publicação das cadeias | aplicado na base atual pelo Carlos em 20/11/2026 |
| 2026-11-20 | `2026-11-20-adequar-cd-opcao.sql` | `PROCESSO_VARIAVEL_VALORES.CD_OPCAO` (substitui `VL_OPCAO`, que fica obsoleto) | **pendente**: aplicar antes de testar campos de opção (T02, D3) |
| 2026-11-20 | `2026-11-20-adequar-numero-prazo.sql` | Número do processo (prefixo, sequência, `CD_NUMERO`) e prazos de etapa e de parecer | **pendente**: aplicar junto com a aplicação do T03; protocolos sem prefixo recebem P001, P002… |

Pendentes em 20/11/2026: `2026-11-20-adequar-cd-opcao.sql` e `2026-11-20-adequar-numero-prazo.sql`. Os ajustes de 20/11 foram testados em cópia da estrutura anterior com dados e podem ser reexecutados.

## Próximos ajustes

Enquanto não houver banco de produção, o banco de desenvolvimento é recriado a partir de `estrutura/`, e as mudanças entram direto nos scripts oficiais. Quando existir um banco com dados a preservar, cada mudança passará a ter também um script nesta pasta, idempotente, entre `BEGIN` e `COMMIT`, e esta lista ganhará uma linha.
