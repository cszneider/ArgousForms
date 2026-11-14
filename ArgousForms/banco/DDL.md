# Complementos ao DDL exportado pelo CASE

Este arquivo concentra as diferenças a preservar nos DDLs do CASE e as pendências de estrutura, índices, restrições e triggers. A seção histórica de `Processos` acompanha o export de 26/10/2026. A estrutura executável e suas validações estão em `estrutura-processos.sql` e `validar-processos.sql`; o gestor informou sua aplicação ao banco em 29/10/2026. Antes de uma nova geração, comparar o export com esses scripts para não duplicar complementos.

## Cadastro e Docs: preservar nos próximos exports

- O export corrigido de 14/11/2026 acrescenta `Docs.ARQUIVOS.DT_ALTERACAO TIMESTAMPTZ NOT NULL` e as tabelas `Notificacoes.EVENTOS` e `Notificacoes.NOTIFICACOES`. `estrutura-docs.sql` e `estrutura-notificacoes.sql` contêm a estrutura qualificada, sem marcadores `AUTO`. Na base existente ainda sem essas tabelas, aplicar `adequar-notificacoes-documentos-2026-11-14.sql` após a adequação de integração. Se a adequação anterior já criou `Notificacoes.Notificacoes_EVENTOS`, aplicar somente `renomear-eventos-notificacoes-2026-11-14.sql`; não reaplicar a adequação completa. A migração preenche a data dos arquivos anteriores com `DT_INCLUSAO`; uma trigger inicializa a data nos novos arquivos e a atualiza quando título, descrição ou classificação mudarem.
- O CASE não contém as duas restrições entre `TP_NATUREZA`, `TP_SITUACAO` e `DT_ENCERRAMENTO` de `Notificacoes.NOTIFICACOES`; preservá-las do script executável. A referência composta de `ID_PROCESSO_ETAPA` com `ID_PROCESSO` em `Notificacoes.EVENTOS` exige o índice único `EtapaDeProcesso`, já existente em `estrutura-processos.sql`.
- O export de 13/11/2026 definiu `NR_DIAS_SESSAO_MOVEL SMALLINT NOT NULL DEFAULT 7` e `NR_DIAS_SESSAO_ABSOLUTA SMALLINT NOT NULL DEFAULT 60` em `Cadastro.INSTITUICAO`. A estrutura executável acompanha os tipos; `adequar-integracao-2026-11-13.sql` converte os campos da base existente.
- `Cadastro.INSTITUICAO.NR_DIAS_RETENCAO_LOG_INTEGRACAO` tem o padrão de **90 dias** aprovado na conversa. O export CASE de 13/11/2026 traz `DEFAULT 60`; corrigir essa divergência na modelagem. A estrutura executável e a adequação usam 90.
- O export CASE de `Cadastro.CHAVES_WEBHOOK` contém um `CHECK` de `DT_INVALIDACAO` com `DT_INVALIDACAO IS NULL` repetido nos dois ramos; isso impede invalidar uma chave. Corrigir a modelagem para o par `DT_INVALIDACAO`/`ID_USUARIO_INVALIDACAO` estar ambos nulos ou ambos preenchidos, com invalidação posterior à inclusão. A estrutura executável e a adequação já corrigem a regra.
- `Cadastro.CHAVES_WEBHOOK`, `Cadastro.INTEGRACAO_CONSULTAS` e `Cadastro.INTEGRACAO_TENTATIVAS` entraram em `estrutura-inicial.sql`, sem os `AUTO` indevidos. As FKs de consultas para `Processos.PROTOCOLOS` e `Processos.PROCESSOS` ficam em `estrutura-processos.sql`; a adequação aplica todas as FKs à base atual. `Cadastro.limpar_historico_integracao()` remove consultas concluídas após o prazo configurado; a execução periódica ainda deve ser agendada pela aplicação ou por um mecanismo operacional escolhido.
- `Cadastro.HISTORICO_LOGINS.DT_VALIDADE` não deve manter o default fixo de sete dias. A aplicação calcula a validade pelos parâmetros da instituição; o script de adequação remove o default da instalação existente.

- Em `Processos.PROTOCOLO_DOCUMENTO_PDF_CAMPOS`, o CASE não gera a restrição entre colunas. Após cada export, preservar `CONSTRAINT ck_pdf_campo_origem CHECK ((ID_VARIAVEL IS NULL) <> (ID_ATRIBUTO IS NULL))` na definição da tabela. `ID_VARIAVEL` e `ID_ATRIBUTO` permanecem individualmente opcionais; exatamente um deles deve ser preenchido. A restrição já consta de `estrutura-processos.sql` e do script de adequação da base existente.

- O índice único de identificação pessoal por país já foi aplicado pelo gestor ao banco; conferir sua presença no próximo export de `Cadastro` para não perdê-lo ao recriar a estrutura.
- `estrutura-inicial.sql` e `estrutura-docs.sql` já contêm ajustes posteriores aos exports de 13 e 15/10/2026, incluindo dois campos novos de `Cadastro.INSTITUICAO` e a possibilidade de a pasta RAIZ não ter pai. Comparar os próximos exports com esses scripts antes de regenerá-los.
- `estrutura-docs.sql` e `adequar-estrutura-documentos-2026-10-15.sql` criam índices únicos para nome de arquivo ativo na pasta e número de versão no arquivo. Preservá-los no modelo ou no ajuste posterior do script gerado.
- Os scripts existentes `validar-papeis-perfis.sql`, `validar-pais-identificacao.sql`, `validar-aplicacoes-tags.sql`, `validar-alteracao-tags.sql` e `validar-vinculos-organizacao.sql` implementam regras adicionais de banco. Conferir sua aplicação na instalação e não perdê-los na regeneração. `validar-vinculos-organizacao.sql` foi preparado para os cadastros de vínculos e ainda depende de aplicação manual pelo proprietário do schema.
- Novos objetos criados por outro papel proprietário precisarão das mesmas concessões de acesso de dados ao usuário da aplicação; `ALTER DEFAULT PRIVILEGES` de um proprietário não abrange objetos criados por outro.

## Questões de modelagem ainda abertas

- Na publicação, `PROTOCOLO_VERSOES.TP_SITUACAO` usa `R` para rascunho e `P` para publicada. Preservar `ck_protocolo_versao_publicacao` de `estrutura-processos.sql` após o export do CASE. Na base existente, aplicar manualmente `adequar-publicacao-protocolos-2026-11-04.sql` antes do primeiro teste de publicação.
- O DDL de `Cadastro.INSTITUICAO` recebido em 04/11/2026 foi incorporado a `estrutura-inicial.sql`: prazo da lixeira positivo, tamanho máximo `BIGINT` positivo, política de destinatários únicos, fuso obrigatório e URLs de webhook principal e alternativo com as restrições aprovadas. Para a instalação de desenvolvimento existente, `adequar-instituicao-webhook-2026-11-04.sql` preserva o registro e preenche o fuso `America/Sao_Paulo`; instalações novas deverão informar seu próprio fuso ao criar a instituição.

- O CASE não cria os índices, a FK e a trigger de `Processos.PROTOCOLO_DOCUMENTO_HTML_PARTES`: preservar `uk_html_partes_ordem`, `uk_html_partes_cabecalho_rodape` e `fk_html_partes_documento` de `estrutura-processos.sql`, além de `trg_documento_html_parte_publicada` de `validar-processos.sql`, após cada export. Os `CHECK`s de `TP_PARTE`, `NR_ORDEM` e `TX_HTML` constam do script executável e ainda devem ser preservados na modelagem pelo gestor. A tabela principal `PROTOCOLO_DOCUMENTO_HTML` também requer FK para `PROTOCOLO_DOCUMENTO_VERSOES`. Na base atual, o gestor já criou as tabelas e a FK entre partes e documento; `adequar-html-partes-2026-11-04.sql` pode ser reaplicado para garantir os demais complementos e os `GRANT`s.

- O export de 05/11/2026 substitui a proposta anterior de recursos por `Processos.PROTOCOLO_RECURSOS`, compartilhados entre os documentos do Protocolo, e `Cadastro.RECURSOS_INSTITUICAO`, compartilhados na instituição. `INSTITUICAO.ID_PASTA` é opcional e referencia `Docs.PASTAS`. As duas tabelas de recursos referenciam versões exatas em `Docs.ARQUIVO_VERSOES`. O modelo foi corrigido para a PK `ID_PROTOCOLO_RECURSO` e o índice único `CodigoDoRecursoNoProtocolo` sobre `(ID_PROTOCOLO, CD_RECURSO)`. Como a base de desenvolvimento recebeu a estrutura com os nomes antigos, aplicar `renomear-chave-recurso-protocolo-2026-11-05.sql` antes de usar o novo JAR. Um recurso já utilizado por versão publicada não poderá mudar de código/arquivo nem ser excluído; a verificação requer a definição de como cada documento registrará o uso do código, ainda não modelada. O contrato para resolver recursos na prévia e no PDF ainda precisa ser desenvolvido.

- `Cadastro.VARIAVEIS_INSTITUICAO` já consta da estrutura inicial. Seus códigos devem ficar separados dos códigos nativos reservados `sistema.*`, `instituicao.nome`, `usuarioAtual.*`, `processo.*` e `etapa.*`; o catálogo nativo não requer linhas nessa tabela.
- `Cadastro.INSTITUICAO` já contém `DS_URL_WEBHOOK`, `DS_URL_WEBHOOK_ALTERNATIVO` e `CD_FUSO_HORARIO`. Cada instalação informa seu fuso; não há valor padrão universal. O script de adequação da instalação de desenvolvimento usa `America/Sao_Paulo`, confirmado pelo gestor.
- Decidir se o instante com fuso horário também deverá preservar o nome original do fuso. O tipo `T` já foi definido como instante com fuso; não acrescentar coluna sem decisão.
- Confirmar se cada passagem por uma etapa que reutiliza um formulário cria preenchimento independente. Não acrescentar relacionamentos ou restrições presumindo a resposta.
- O alcance do catálogo de tipos de atributo de arquivo entre pastas ainda será detalhado; não alterar o esquema `Docs` por inferência.

`Processos` nos comandos SQL é um identificador não delimitado e, no PostgreSQL, corresponde ao schema `processos`. O pré-processamento deverá qualificar com esse schema todos os `CREATE TABLE`, índices, referências e `ALTER TABLE` do export, como já é feito para `Cadastro` e `Docs`. A ordem final será: criação das tabelas, índices e restrições do export; alterações estruturais indicadas abaixo; FKs complementares; funções e triggers. Antes de gerar o script, conferir se o novo export do CASE já incorporou algum item para não duplicá-lo.

## Alteração estrutural aprovada

O nome aprovado para a tabela de campos do PDF é `Processos.PROTOCOLO_DOCUMENTO_PDF_CAMPOS`, conforme a classe gerada `ProtocoloDocumentoPdfCampo`. `estrutura-processos.sql` foi ajustado para esse nome. Nas instalações existentes que ainda tenham a tabela no singular, executar `ALTER TABLE Processos.PROTOCOLO_DOCUMENTO_PDF_CAMPO RENAME TO PROTOCOLO_DOCUMENTO_PDF_CAMPOS;` antes de gravar os campos pelo aplicativo.

Em `Processos.PROTOCOLO_DOCUMENTO_PDF`, o campo atual `ID_ARQUIVO_MODELO_PDF UUID NOT NULL` aponta para a versão exata do PDF de origem em `Docs.ARQUIVO_VERSOES`. O arquivo pertence a `Docs.ARQUIVOS`, na subpasta `MODELOS` da pasta associada ao Protocolo por `PROTOCOLOS.ID_PASTA`. Não alterar a estrutura das tabelas de `Docs` por causa desse vínculo.

Enquanto a versão do documento for rascunho, a troca do PDF deverá criar uma nova versão em `Docs.ARQUIVO_VERSOES` e atualizar o ponteiro em `PROTOCOLO_DOCUMENTO_PDF`. Uma versão publicada conservará o ponteiro para o PDF usado na publicação. As versões anteriores de `Docs` permanecem no histórico, conforme a política já definida para arquivos. A operação entre PostgreSQL e GridFS e sua compensação deverão ser implementadas no serviço, sem presumir transação distribuída.

`Cadastro.INSTITUICAO.SN_PERMITIR_DESTINATARIOS_UNICOS BOOLEAN NOT NULL DEFAULT TRUE` já consta da modelagem recebida e de `estrutura-inicial.sql`; a regra de publicação depende dela.

## PROCESSO_DOCUMENTO: revisão do DDL recebido

O DDL revisto da tabela `PROCESSO_DOCUMENTO` foi recebido em 26/10/2026. Preservar o nome singular escolhido pelo gestor. Já constam do DDL: `ID_PROCESSO_DOCUMENTO` como chave primária, `ID_ARQUIVO_VERSAO` único, `ID_PROCESSO_ETAPA` opcional, `NR_GERACAO SMALLINT` positivo e o índice único **do conjunto** `(ID_PROCESSO, ID_PROTOCOLO_DOCUMENTO_VERSAO, NR_GERACAO)`. Não duplicar esses elementos no script executável.

`ID_PROCESSO_ETAPA` é opcional porque os scripts de inicialização ou finalização do próprio Processo também podem gerar documentos, sem passagem de etapa associada. Acrescentar somente as FKs abaixo ao script executável **após** a criação das tabelas e dos índices de origem. Nenhuma delas foi executada no banco; conferir o próximo export para evitar duplicidade:

```sql
ALTER TABLE Processos.PROCESSO_DOCUMENTO ADD CONSTRAINT fk_pd_processo FOREIGN KEY (ID_PROCESSO) REFERENCES Processos.PROCESSOS (ID_PROCESSO) ON UPDATE RESTRICT ON DELETE RESTRICT;
ALTER TABLE Processos.PROCESSO_DOCUMENTO ADD CONSTRAINT fk_pd_modelo_versao FOREIGN KEY (ID_PROTOCOLO_DOCUMENTO_VERSAO) REFERENCES Processos.PROTOCOLO_DOCUMENTO_VERSOES (ID_PROTOCOLO_DOCUMENTO_VERSAO) ON UPDATE RESTRICT ON DELETE RESTRICT;
ALTER TABLE Processos.PROCESSO_DOCUMENTO ADD CONSTRAINT fk_pd_etapa_processo FOREIGN KEY (ID_PROCESSO_ETAPA, ID_PROCESSO) REFERENCES Processos.PROCESSO_ETAPAS (ID_PROCESSO_ETAPA, ID_PROCESSO) ON UPDATE RESTRICT ON DELETE RESTRICT;
ALTER TABLE Processos.PROCESSO_DOCUMENTO ADD CONSTRAINT fk_pd_arquivo_versao FOREIGN KEY (ID_ARQUIVO_VERSAO) REFERENCES Docs.ARQUIVO_VERSOES (ID_ARQUIVO_VERSAO) ON UPDATE RESTRICT ON DELETE RESTRICT;
```

A FK composta da etapa usa o índice único `EtapaDeProcesso` já presente no export anterior. A FK de arquivo exige que `Docs.ARQUIVO_VERSOES` já exista. A versão do modelo deve ser uma das selecionadas pela versão do Protocolo usada pelo Processo; as FKs simples acima não garantem isso, portanto validar essa coerência quando forem escritas as regras de integridade. A combinação de `TP_SITUACAO`, `DT_PUBLICACAO` e `DT_INVALIDACAO` também precisa de códigos e transições aprovados antes de criar `CHECK`s ou triggers para esses campos.

Na geração automática, preencher `Docs.ARQUIVO_VERSOES.ID_USUARIO_INCLUIU` com `PROCESSOS.ID_USUARIO_INICIOU` para script do Processo; para script de etapa, usar o usuário que iniciou aquela passagem ou o que efetivamente a finalizou/cancelou, conforme o evento. Capturar esse usuário no momento da ação, sem inferi-lo depois apenas do responsável atual.

## FKs compostas a acrescentar após o export

Os índices únicos `DocumentoVersaoPertenceDocumento` e `EtapaDeProcesso` já constam do export de 26/10/2026. A chave primária de `PROCESSO_VARIAVEL_VALORES` também já indexa `(ID_PROCESSO_ETAPA, ID_VARIAVEL)`. Manter os índices de origem `ProtocoloVersaoPorDocumento`, `VariavelAtualValor` e `VariavelAtualEtapaProcesso` como **não únicos**. Acrescentar somente as FKs que ainda não estiverem no novo export:

```sql
ALTER TABLE Processos.PROTOCOLO_VERSAO_DOCUMENTOS ADD CONSTRAINT fk_versao_documento_correspondente FOREIGN KEY (ID_PROTOCOLO_DOCUMENTO_VERSAO, ID_PROTOCOLO_DOCUMENTO) REFERENCES Processos.PROTOCOLO_DOCUMENTO_VERSOES (ID_PROTOCOLO_DOCUMENTO_VERSAO, ID_PROTOCOLO_DOCUMENTO) ON UPDATE RESTRICT ON DELETE RESTRICT;
ALTER TABLE Processos.PROCESSO_VARIAVEIS_ATUAIS ADD CONSTRAINT fk_variavel_atual_valor FOREIGN KEY (ID_PROCESSO_ETAPA, ID_VARIAVEL) REFERENCES Processos.PROCESSO_VARIAVEL_VALORES (ID_PROCESSO_ETAPA, ID_VARIAVEL) ON UPDATE RESTRICT ON DELETE RESTRICT;
ALTER TABLE Processos.PROCESSO_VARIAVEIS_ATUAIS ADD CONSTRAINT fk_variavel_atual_etapa_processo FOREIGN KEY (ID_PROCESSO_ETAPA, ID_PROCESSO) REFERENCES Processos.PROCESSO_ETAPAS (ID_PROCESSO_ETAPA, ID_PROCESSO) ON UPDATE RESTRICT ON DELETE RESTRICT;
```

## FKs entre schemas aprovadas

Adicionar depois que os schemas `Cadastro` e `Docs` e suas tabelas referenciadas estiverem disponíveis. Uma FK para campo opcional aceita `NULL`; quando preenchido, exige registro existente. `PROTOCOLO_DOCUMENTO_PDF.ID_ARQUIVO_MODELO_PDF` já consta do DDL atual.

### Usuários

```sql
ALTER TABLE Processos.PROTOCOLOS ADD FOREIGN KEY (ID_USUARIO_CRIADOR) REFERENCES Cadastro.USUARIOS_SISTEMA (ID_USUARIO_SISTEMA) ON UPDATE RESTRICT ON DELETE RESTRICT;
ALTER TABLE Processos.PROTOCOLO_VERSOES ADD FOREIGN KEY (ID_USUARIO_ABRIU) REFERENCES Cadastro.USUARIOS_SISTEMA (ID_USUARIO_SISTEMA) ON UPDATE RESTRICT ON DELETE RESTRICT;
ALTER TABLE Processos.PROTOCOLO_VERSOES ADD FOREIGN KEY (ID_USUARIO_RESPONSAVEL) REFERENCES Cadastro.USUARIOS_SISTEMA (ID_USUARIO_SISTEMA) ON UPDATE RESTRICT ON DELETE RESTRICT;
ALTER TABLE Processos.PROTOCOLO_VERSOES ADD FOREIGN KEY (ID_USUARIO_PUBLICOU) REFERENCES Cadastro.USUARIOS_SISTEMA (ID_USUARIO_SISTEMA) ON UPDATE RESTRICT ON DELETE RESTRICT;
ALTER TABLE Processos.PROTOCOLO_ETAPA_DESTINATARIOS ADD FOREIGN KEY (ID_USUARIO_SISTEMA) REFERENCES Cadastro.USUARIOS_SISTEMA (ID_USUARIO_SISTEMA) ON UPDATE RESTRICT ON DELETE RESTRICT;
ALTER TABLE Processos.PROTOCOLO_GESTORES_ELEGIVEIS ADD FOREIGN KEY (ID_USUARIO_SISTEMA) REFERENCES Cadastro.USUARIOS_SISTEMA (ID_USUARIO_SISTEMA) ON UPDATE RESTRICT ON DELETE RESTRICT;
ALTER TABLE Processos.PROCESSOS ADD FOREIGN KEY (ID_USUARIO_INICIOU) REFERENCES Cadastro.USUARIOS_SISTEMA (ID_USUARIO_SISTEMA) ON UPDATE RESTRICT ON DELETE RESTRICT;
ALTER TABLE Processos.PROCESSOS ADD FOREIGN KEY (ID_USUARIO_GESTOR) REFERENCES Cadastro.USUARIOS_SISTEMA (ID_USUARIO_SISTEMA) ON UPDATE RESTRICT ON DELETE RESTRICT;
ALTER TABLE Processos.PROCESSO_ETAPAS ADD FOREIGN KEY (ID_USUARIO_RESPONSAVEL) REFERENCES Cadastro.USUARIOS_SISTEMA (ID_USUARIO_SISTEMA) ON UPDATE RESTRICT ON DELETE RESTRICT;
ALTER TABLE Processos.PROCESSO_VARIAVEL_VALORES ADD FOREIGN KEY (ID_USUARIO_ULTIMA_GRAVACAO) REFERENCES Cadastro.USUARIOS_SISTEMA (ID_USUARIO_SISTEMA) ON UPDATE RESTRICT ON DELETE RESTRICT;
ALTER TABLE Processos.PROCESSO_ETAPA_RESPONSAVEIS ADD FOREIGN KEY (ID_USUARIO_SISTEMA) REFERENCES Cadastro.USUARIOS_SISTEMA (ID_USUARIO_SISTEMA) ON UPDATE RESTRICT ON DELETE RESTRICT;
ALTER TABLE Processos.PROCESSO_CONSULTAS ADD FOREIGN KEY (ID_USUARIO_SOLICITANTE) REFERENCES Cadastro.USUARIOS_SISTEMA (ID_USUARIO_SISTEMA) ON UPDATE RESTRICT ON DELETE RESTRICT;
ALTER TABLE Processos.PROCESSO_CONSULTAS ADD FOREIGN KEY (ID_USUARIO_CONSULTOR) REFERENCES Cadastro.USUARIOS_SISTEMA (ID_USUARIO_SISTEMA) ON UPDATE RESTRICT ON DELETE RESTRICT;
ALTER TABLE Processos.PROCESSO_CONSULTAS ADD FOREIGN KEY (ID_USUARIO_APROVADOR) REFERENCES Cadastro.USUARIOS_SISTEMA (ID_USUARIO_SISTEMA) ON UPDATE RESTRICT ON DELETE RESTRICT;
ALTER TABLE Processos.PROCESSO_CONSULTAS ADD FOREIGN KEY (ID_USUARIO_ENCERROU) REFERENCES Cadastro.USUARIOS_SISTEMA (ID_USUARIO_SISTEMA) ON UPDATE RESTRICT ON DELETE RESTRICT;
ALTER TABLE Processos.PROCESSO_FORUM ADD FOREIGN KEY (ID_USUARIO_AUTOR) REFERENCES Cadastro.USUARIOS_SISTEMA (ID_USUARIO_SISTEMA) ON UPDATE RESTRICT ON DELETE RESTRICT;
```

### Grupos e tags

```sql
ALTER TABLE Processos.PROTOCOLO_ETAPA_DESTINATARIOS ADD FOREIGN KEY (ID_GRUPO) REFERENCES Cadastro.GRUPOS (ID_GRUPO) ON UPDATE RESTRICT ON DELETE RESTRICT;
ALTER TABLE Processos.PROTOCOLO_GESTORES_ELEGIVEIS ADD FOREIGN KEY (ID_GRUPO) REFERENCES Cadastro.GRUPOS (ID_GRUPO) ON UPDATE RESTRICT ON DELETE RESTRICT;
ALTER TABLE Processos.PROTOCOLO_ETAPA_DESTINATARIOS ADD FOREIGN KEY (CD_TAG_GRUPO) REFERENCES Cadastro.TAGS (CD_TAG) ON UPDATE RESTRICT ON DELETE RESTRICT;
ALTER TABLE Processos.PROTOCOLO_ETAPA_DESTINATARIOS ADD FOREIGN KEY (CD_TAG_USUARIO) REFERENCES Cadastro.TAGS (CD_TAG) ON UPDATE RESTRICT ON DELETE RESTRICT;
ALTER TABLE Processos.PROTOCOLO_ETAPA_DESTINATARIOS ADD FOREIGN KEY (CD_TAG_VINCULO) REFERENCES Cadastro.TAGS (CD_TAG) ON UPDATE RESTRICT ON DELETE RESTRICT;
ALTER TABLE Processos.PROTOCOLO_GESTORES_ELEGIVEIS ADD FOREIGN KEY (CD_TAG_GRUPO) REFERENCES Cadastro.TAGS (CD_TAG) ON UPDATE RESTRICT ON DELETE RESTRICT;
ALTER TABLE Processos.PROTOCOLO_GESTORES_ELEGIVEIS ADD FOREIGN KEY (CD_TAG_USUARIO) REFERENCES Cadastro.TAGS (CD_TAG) ON UPDATE RESTRICT ON DELETE RESTRICT;
ALTER TABLE Processos.PROTOCOLO_GESTORES_ELEGIVEIS ADD FOREIGN KEY (CD_TAG_VINCULO) REFERENCES Cadastro.TAGS (CD_TAG) ON UPDATE RESTRICT ON DELETE RESTRICT;
```

### Pastas e versões de arquivos

```sql
ALTER TABLE Processos.PROTOCOLOS ADD FOREIGN KEY (ID_PASTA) REFERENCES Docs.PASTAS (ID_PASTA) ON UPDATE RESTRICT ON DELETE RESTRICT;
ALTER TABLE Processos.PROTOCOLO_DOCUMENTO_PDF ADD FOREIGN KEY (ID_ARQUIVO_MODELO_PDF) REFERENCES Docs.ARQUIVO_VERSOES (ID_ARQUIVO_VERSAO) ON UPDATE RESTRICT ON DELETE RESTRICT;
ALTER TABLE Processos.PROCESSO_ANEXOS ADD FOREIGN KEY (ID_ARQUIVO_VERSAO) REFERENCES Docs.ARQUIVO_VERSOES (ID_ARQUIVO_VERSAO) ON UPDATE RESTRICT ON DELETE RESTRICT;
```

## Regras a materializar após o fechamento da modelagem

Escrever as restrições declarativas possíveis e as funções/triggers necessárias **depois** que o gestor enviar o DDL definitivo. Não executar scripts parciais desta seção. As regras já aprovadas a considerar incluem:

- `PROTOCOLO_VERSOES`: um rascunho por Protocolo; `NR_VERSAO = -1` somente para rascunho, número positivo somente para publicação; coerência com publicador/data e imutabilidade da versão publicada e das definições vinculadas.
- A publicação exige ao menos uma linha em `Processos.PROTOCOLO_GESTORES_ELEGIVEIS` para a versão. A regra consta de `validar-processos.sql`; na instalação existente, aplicar `ajuste-gestores-elegiveis-2026-11-06.sql` após conferir o seu conteúdo. O script não altera versões já publicadas.
- `PROTOCOLOS_ETAPAS.TP_ETAPA` foi removido: etapa de entrada é identificada pelo fluxo e etapa de saída para o fim não tem encaminhamento. Na publicação, exigir uma única etapa de entrada e pelo menos uma etapa sem encaminhamento; validar que formulários, variáveis, encaminhamentos, destinatários e documentos referenciados pertençam ao mesmo Protocolo e à versão adequada. Aplicar `INSTITUICAO.SN_PERMITIR_DESTINATARIOS_UNICOS` às regras de destinatários das etapas. No banco existente, remover a restrição `ck_protocolo_etapa_tipo` e a coluna `TP_ETAPA`; reaplicar a função de validação atualizada.
- Para a base já alterada com `DROP COLUMN TP_ETAPA`, executar `ajuste-etapas-sem-tipo-2026-11-03.sql` antes de salvar ou publicar fluxos. Ele substitui as duas funções das triggers existentes sem criar triggers duplicadas.
- `PROCESSO_ETAPAS`: garantir que a etapa pertença à versão de Protocolo do Processo. `PROCESSO_ETAPA_ENCAMINHAMENTOS` registra a definição de destino e a passagem; a instância de destino só é criada quando chegam todos os antecedentes efetivamente ativados. Garantir coerência de processo, origem, destino e passagem.
- `PROCESSO_ETAPA_RESPONSAVEIS`: manter o responsável vigente de `PROCESSO_ETAPAS.ID_USUARIO_RESPONSAVEL` sincronizado com o único vínculo sem `DT_FIM`. O índice parcial único `ResponsavelVigentePorEtapa` já consta do export.
- `PROTOCOLO_DOCUMENTO_PDF`: validar que a versão de `Docs` apontada é um PDF e pertence à subpasta `MODELOS` da pasta do Protocolo. Impedir que operações de pasta, lixeira, vencimento ou exclusão permanente tornem indisponível um PDF ainda referenciado por uma versão do documento, especialmente uma versão publicada. A FK sozinha não protege o conteúdo do GridFS.
- Verificar as regras de aplicação das tags de grupo, usuário e vínculo nas definições do Protocolo; a existência do código em `Cadastro.TAGS` não garante que a aplicação correspondente esteja habilitada.

O desenho específico de cada trigger, seus eventos e a ordem de execução serão definidos ao fechar o DDL. Não converter recomendações ou requisitos ainda não decididos em restrições definitivas.

## Decisão ainda pendente

`PROCESSO_VARIAVEL_VALORES.ID_USUARIO_ULTIMA_GRAVACAO` permanece `NOT NULL` no export. Foi **recomendado**, mas ainda não aprovado pelo gestor, torná-lo opcional para gravações automáticas por scripts, sem atribuir a um usuário uma escrita feita pelo sistema. A FK para `Cadastro.USUARIOS_SISTEMA` permanece válida em qualquer das opções; não alterar a nulidade antes da decisão.

Também permanece pendente o desenho exato das referências, em `Docs.ARQUIVO_VERSOES`, ao Processo e à etapa que produzirem uma versão de arquivo. A identificação de ambos foi aprovada, mas as colunas e FKs não devem ser inventadas antes de fechar essa parte da modelagem; arquivos enviados diretamente não terão origem em Processo.
