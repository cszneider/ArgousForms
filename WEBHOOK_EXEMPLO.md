# Webhook de exemplo — contrato e evolução proposta

Este documento orienta o projeto que implementará um webhook de exemplo para o ArgousForms. O [guia de GET_DATA](ArgousForms/src/main/resources/integracao/WEBHOOK.md) traz exemplos completos de verificação HMAC em Java, Python e Node.js. **Apenas `GET_DATA` está implementado no ArgousForms hoje.** As chamadas informativas descritas adiante são uma proposta; seu formato e sua lista de eventos ainda precisam de aprovação e implementação.

## Configuração comum

- O ArgousForms envia `POST` com corpo JSON UTF-8 à URL principal cadastrada na instituição. A URL alternativa implementa o mesmo contrato e é acionada em falhas de rede, timeout ou HTTP `5xx` da principal. HTTP `4xx` e respostas de negócio negativas não acionam a alternativa.
- As URLs de instalações de clientes usam HTTPS. O uso de HTTP existe apenas no ambiente de desenvolvimento do produto, mediante configuração própria.
- As requisições e respostas usam os cabeçalhos `X-Argous-Request-Id`, `X-Argous-Timestamp` e `X-Argous-Signature`. O ID é um UUID e permite correlacionar os registros dos dois sistemas.
- A assinatura é HMAC-SHA-256 com uma chave compartilhada, decodificada de Base64, de pelo menos 32 bytes. O hash é calculado sobre os **bytes exatos** do corpo HTTP. O texto assinado, em UTF-8, é composto pelas cinco linhas abaixo, unidas por `\n`, sem quebra final:

```text
ARGOUS-HMAC-V1
REQUISICAO ou RESPOSTA
<X-Argous-Request-Id>
<X-Argous-Timestamp>
<SHA-256 do corpo em hexadecimal minúsculo>
```

O resultado do HMAC é enviado em Base64 padrão. Para conferir uma requisição, o webhook verifica a assinatura em tempo constante, compara o ID do cabeçalho com o do corpo e aceita timestamp dentro de cinco minutos. Para responder, serializa o JSON uma vez, assina esses bytes com o tipo `RESPOSTA`, informa um timestamp novo e envia os mesmos bytes. A chave nunca aparece no corpo, na URL ou nos logs.

## Chamada vigente: `GET_DATA`

O ArgousForms consulta dados do sistema da instituição. O desenvolvedor do webhook decide o significado de cada `codigo`, os parâmetros aceitos e os campos devolvidos. O código começa com letra ASCII, tem até 100 caracteres e pode conter letras, dígitos, `_`, `.` e `-`.

```json
{
  "acao": "GET_DATA",
  "idRequisicao": "814e0c9d-8a41-4ca4-8b17-73f116fc92c9",
  "idProtocolo": "0f742ae1-3dca-4744-889c-6eb4966c726f",
  "codigo": "DADOS_FUNCIONARIO",
  "parametros": { "email": "ana@example.com" }
}
```

`idProtocolo` pode estar ausente na chamada direta da tela de testes. `parametros` é sempre um objeto JSON, podendo ser `{}`. Uma resposta encontrada usa HTTP `200`:

```json
{
  "idRequisicao": "814e0c9d-8a41-4ca4-8b17-73f116fc92c9",
  "codigo": "DADOS_FUNCIONARIO",
  "status": true,
  "dados": { "dsNome": "Ana Exemplo", "dsSetor": "Contabilidade" },
  "validadeCacheEm": "2026-11-12T12:00:00Z"
}
```

Se o registro não existir, responder HTTP `200` com `status:false` e `erro` contendo `codigo` e `mensagem`. `validadeCacheEm` é opcional e controla apenas o cache do ArgousForms. Sem ela, cada consulta chama o webhook. O cache é compartilhado por processos do mesmo Protocolo quando o código e os parâmetros são iguais; não substitui os valores já gravados em um Processo. A resposta não pode exceder 1 MiB; a chamada tem timeout de dez segundos. O webhook deve verificar a assinatura antes de acessar seus dados e assinar inclusive respostas de negócio negativas. Requisições inválidas recebem HTTP `4xx`; falhas técnicas recebem HTTP `5xx`.

No produto atual, a tela **Integração → Testar integração** permite disparar essa chamada. A função `getData(...)` dos scripts ainda depende do futuro executor de scripts.

## Proposta: avisos de eventos do ArgousForms

### Finalidade e comportamento

Recomendo uma chamada informativa `EVENTO` para **fatos de negócio confirmados**, e não para cada clique ou atualização visual. Exemplos: Processo iniciado, etapa assumida ou finalizada e Processo concluído. O aviso não concede acesso ao Processo nem autoriza o sistema cliente a modificar o ArgousForms. O webhook pode usar o aviso para atualizar uma fila, registrar auditoria própria ou iniciar uma integração, mas o resultado dessas ações não altera retroativamente o fato ocorrido.

A chamada deve ser **assíncrona**: primeiro o ArgousForms confirma sua transação no PostgreSQL; depois um entregador envia o aviso. Uma falha do webhook não desfaz a operação do usuário. Para não perder avisos entre o `COMMIT` e o envio, a implementação deverá registrar o evento e sua entrega pendente na mesma transação da ação de negócio (padrão *outbox*). O envio pode ocorrer mais de uma vez; o webhook deve deduplicar pelo `idEvento`.

Formato inicial sugerido, **ainda não aprovado**:

```json
{
  "acao": "EVENTO",
  "idRequisicao": "79202b32-f4af-4f37-8bdf-98cd930c511f",
  "idEvento": "d2d27583-8b9c-47a6-a2d7-ea66919cf6b5",
  "versaoContrato": 1,
  "tipoEvento": "PROCESSO_INICIADO",
  "ocorridoEm": "2026-11-14T15:25:00Z",
  "idProtocolo": "0f742ae1-3dca-4744-889c-6eb4966c726f",
  "idProtocoloVersao": "6e9721d5-2200-4335-9e40-5d10aa7b54cf",
  "idProcesso": "c98b09b7-7a2a-40bf-93c6-a5d13091fc3f",
  "idEtapa": null,
  "idUsuarioAtor": "16be1f26-0dc4-4fe6-97a6-cfb6fd192032",
  "dados": {}
}
```

`idEvento` identifica o fato e permanece igual em novas tentativas ou na URL alternativa. `idRequisicao` identifica a tentativa de comunicação para correlação dos logs; sua política exata em novas tentativas ainda precisa ser fechada. `dados` contém apenas os detalhes necessários daquele tipo de evento. Campos sem relação com o evento podem ser omitidos ou `null`, conforme o contrato definitivo. Nenhuma resposta deve conter documentos, valores de formulário, senhas ou outros dados sensíveis por padrão.

Resposta proposta para aceite de recebimento:

```json
{
  "idRequisicao": "79202b32-f4af-4f37-8bdf-98cd930c511f",
  "idEvento": "d2d27583-8b9c-47a6-a2d7-ea66919cf6b5",
  "status": true
}
```

O webhook responderia HTTP `200`, com assinatura HMAC `RESPOSTA` e os cabeçalhos comuns. O ArgousForms só consideraria a entrega aceita após validar HTTP, assinatura e IDs. O recebimento repetido do mesmo `idEvento` deveria devolver sucesso sem repetir efeitos de negócio. Falhas de rede, timeout e HTTP `5xx` permitiriam nova tentativa; HTTP `4xx` indicaria erro de contrato ou autorização para investigação. Prazo de retenção, limites de tentativas e destino de falhas definitivas ainda precisam ser definidos.

### Catálogo inicial de eventos candidatos

| Evento | Quando ocorre | Dados adicionais candidatos |
| --- | --- | --- |
| `PROCESSO_INICIADO` | Criação confirmada de um Processo | Gestor inicial, primeira etapa |
| `ETAPA_DISPONIBILIZADA` | Uma etapa fica disponível para assumir | Etapa e passagem |
| `ETAPA_ASSUMIDA` | Um responsável assume a etapa | Responsável |
| `ETAPA_SALVA` | Preenchimento é salvo ou validado | Estado do salvamento; **avaliar se o volume justifica o aviso** |
| `ETAPA_FINALIZADA` | A etapa é finalizada e seus efeitos são confirmados | Próxima etapa, quando houver |
| `ETAPA_DEVOLVIDA` | Uma etapa retorna no fluxo | Etapa de origem e destino, sem expor o conteúdo da justificativa por padrão |
| `DOCUMENTO_GERADO` | Arquivo resultante é registrado/publicado | ID do documento e do arquivo, sem conteúdo |
| `PROCESSO_AGUARDA_GESTOR` | Última etapa termina e o Protocolo requer confirmação | Gestor atual |
| `PROCESSO_CONCLUIDO` | Conclusão confirmada pelo gestor ou automática | Forma de conclusão |
| `PROCESSO_CANCELADO` | Cancelamento confirmado | Código de motivo, se houver |
| `GESTAO_TRANSFERIDA` | Novo gestor assume a gestão | Gestor anterior e novo gestor |
| `CONSULTA_SOLICITADA` / `CONSULTA_RESPONDIDA` | Consulta a colaborador é aberta ou encerrada | Identificadores da consulta e do consultor |
| `CONVIDADO_ADICIONADO` / `CONVIDADO_REMOVIDO` | Participação de convidado muda | Identificador do convite |
| `AVISO_CUSTOMIZADO` | Um script solicita um aviso explícito | Código e dados definidos pelo Criador, após validação |

Este catálogo reúne **candidatos**, inclusive ações ainda não implementadas. A primeira entrega pode começar pelos fatos de Processo e etapa já executáveis. Recomendo não enviar cada alteração de campo, abertura de tela, leitura de notificação ou tentativa de validação que terminou em erro: isso geraria alto volume sem representar um fato confirmado. Eventos detalhados podem ser acrescentados por versão do contrato.

Se a instituição precisar acompanhar outras áreas, o catálogo pode crescer por categorias: `PROTOCOLO_PUBLICADO`, `USUARIO_ATIVADO`, `GRUPO_ALTERADO`, `ARQUIVO_ENVIADO`, `ARQUIVO_VENCIDO` e `ARQUIVO_EXCLUIDO`, por exemplo. Esses nomes **não estão aprovados**. Os avisos internos mostrados aos usuários do ArgousForms não equivalem automaticamente a eventos para o sistema cliente; cada integração externa precisa de significado, payload e autorização próprios.

### Função proposta para scripts

Sugestão de nome: `emitClientEvent(codigo, dados)`. Ela expressa que o script **registra um evento para entrega posterior**, sem fazer HTTP durante sua execução. Exemplo conceitual:

```javascript
emitClientEvent('PEDIDO_APROVADO', { idPedido: get('idPedido') });
```

O código deve ser limitado a um formato estável, como o de `GET_DATA`, e `dados` deve ser um objeto JSON com tamanho limitado. O registro ocorreria na mesma transação da ação do script; se ela falhar, o aviso não será enviado. Se for aprovado um aviso que aguarde resposta do cliente para decidir o fluxo, isso será **outro contrato**, pois um evento informativo não deve bloquear a conclusão da etapa. `notifyClient` pode ser usado como nome amigável na interface, mas `emitClientEvent` descreve melhor o comportamento assíncrono.

## Decisões pendentes antes de implementar `EVENTO`

1. Quais tipos do catálogo inicial devem ser entregues por padrão e se a instituição poderá selecionar os tipos de interesse. Recomendo habilitar por categoria para evitar volume e exposição desnecessários.
2. Se eventos informativos usarão as mesmas URLs e a mesma chave HMAC de `GET_DATA`. Isso simplifica a instalação, mas o webhook deve distinguir a ação no corpo. Segredos separados só se justificam se houver exigência concreta de isolamento.
3. Política de tentativas: intervalo, prazo máximo, ordenação por Processo e tratamento de falhas definitivas. Recomendo entrega **ao menos uma vez**, deduplicação por `idEvento` e ordenação por Processo quando ela for necessária ao cliente.
4. Conteúdo permitido em `dados`, tamanho máximo e acesso a informações pessoais. Recomendo enviar identificadores e metadados mínimos, com inclusão explícita de campos adicionais por tipo de evento.
5. Regra do script para registrar `AVISO_CUSTOMIZADO`: quem pode definir o código e se há revisão na publicação do Protocolo. O executor de scripts ainda não existe.
6. Uso de `idRequisicao` entre tentativas. Recomendo um identificador novo para cada tentativa e um `idEvento` fixo para o fato, mantendo ambos no histórico para correlação.

O projeto de webhook de exemplo pode implementar **agora** `GET_DATA` conforme o contrato vigente. Pode também organizar um despachante por `acao` e preparar tratamento idempotente de `EVENTO`, mas não deve depender do recebimento desses avisos até o contrato ser aprovado e o ArgousForms passar a enviá-los.
