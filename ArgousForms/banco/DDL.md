# Complementos ao DDL exportado pelo CASE

Este arquivo concentra as diferenças a preservar nos DDLs do CASE e as pendências de estrutura, índices, restrições e triggers. A seção de `Processos` acompanha o export de 26/10/2026; ele é a fonte da estrutura modelada e os complementos abaixo serão aplicados **ao gerar o script executável**, sem executar o export diretamente. Os comandos de `Processos` ainda não foram aplicados ao banco.

## Cadastro e Docs: preservar nos próximos exports

- O índice único de identificação pessoal por país já foi aplicado pelo gestor ao banco; conferir sua presença no próximo export de `Cadastro` para não perdê-lo ao recriar a estrutura.
- `estrutura-inicial.sql` e `estrutura-docs.sql` já contêm ajustes posteriores aos exports de 13 e 15/10/2026, incluindo dois campos novos de `Cadastro.INSTITUICAO` e a possibilidade de a pasta RAIZ não ter pai. Comparar os próximos exports com esses scripts antes de regenerá-los.
- `estrutura-docs.sql` e `adequar-estrutura-documentos-2026-10-15.sql` criam índices únicos para nome de arquivo ativo na pasta e número de versão no arquivo. Preservá-los no modelo ou no ajuste posterior do script gerado.
- Os scripts existentes `validar-papeis-perfis.sql`, `validar-pais-identificacao.sql`, `validar-aplicacoes-tags.sql` e `validar-alteracao-tags.sql` implementam regras adicionais de banco. Conferir sua aplicação na instalação e não perdê-los na regeneração. As regras de atribuição inicial de tags a grupos, usuários e vínculos ainda dependem de definição funcional; não acrescentar restrições por inferência.
- Novos objetos criados por outro papel proprietário precisarão das mesmas concessões de acesso de dados ao usuário da aplicação; `ALTER DEFAULT PRIVILEGES` de um proprietário não abrange objetos criados por outro.

## Questões de modelagem ainda abertas

- Decidir se o instante com fuso horário também deverá preservar o nome original do fuso. O tipo `T` já foi definido como instante com fuso; não acrescentar coluna sem decisão.
- Confirmar se cada passagem por uma etapa que reutiliza um formulário cria preenchimento independente. Não acrescentar relacionamentos ou restrições presumindo a resposta.
- O alcance do catálogo de tipos de atributo de arquivo entre pastas ainda será detalhado; não alterar o esquema `Docs` por inferência.

`Processos` nos comandos SQL é um identificador não delimitado e, no PostgreSQL, corresponde ao schema `processos`. O pré-processamento deverá qualificar com esse schema todos os `CREATE TABLE`, índices, referências e `ALTER TABLE` do export, como já é feito para `Cadastro` e `Docs`. A ordem final será: criação das tabelas, índices e restrições do export; alterações estruturais indicadas abaixo; FKs complementares; funções e triggers. Antes de gerar o script, conferir se o novo export do CASE já incorporou algum item para não duplicá-lo.

## Alteração estrutural aprovada

Em `Processos.PROTOCOLO_DOCUMENTO_PDF`, substituir `CD_ARQUIVO_GRIDFS CHAR(24)` por `ID_ARQUIVO_VERSAO UUID NOT NULL`. Esse campo aponta para a versão exata do PDF de origem em `Docs.ARQUIVO_VERSOES`. O arquivo pertence a `Docs.ARQUIVOS`, na subpasta `MODELOS` da pasta associada ao Protocolo por `PROTOCOLOS.ID_PASTA`. Não alterar a estrutura das tabelas de `Docs` por causa desse vínculo.

Enquanto a versão do documento for rascunho, a troca do PDF deverá criar uma nova versão em `Docs.ARQUIVO_VERSOES` e atualizar o ponteiro em `PROTOCOLO_DOCUMENTO_PDF`. Uma versão publicada conservará o ponteiro para o PDF usado na publicação. As versões anteriores de `Docs` permanecem no histórico, conforme a política já definida para arquivos. A operação entre PostgreSQL e GridFS e sua compensação deverão ser implementadas no serviço, sem presumir transação distribuída.

Em `Cadastro.INSTITUICAO`, acrescentar a política aprovada `SN_PERMITIR_DESTINATARIOS_UNICOS BOOLEAN NOT NULL DEFAULT TRUE` quando a modelagem de Cadastro for atualizada. O `estrutura-inicial.sql` atual ainda não possui essa coluna; a regra de publicação abaixo depende dela. Conferir o próximo export do CASE antes de acrescentá-la ao script executável.

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

Adicionar depois que os schemas `Cadastro` e `Docs` e suas tabelas referenciadas estiverem disponíveis. Uma FK para campo opcional aceita `NULL`; quando preenchido, exige registro existente. `PROTOCOLO_DOCUMENTO_PDF.ID_ARQUIVO_VERSAO` depende da alteração estrutural acima.

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
ALTER TABLE Processos.PROTOCOLO_DOCUMENTO_PDF ADD FOREIGN KEY (ID_ARQUIVO_VERSAO) REFERENCES Docs.ARQUIVO_VERSOES (ID_ARQUIVO_VERSAO) ON UPDATE RESTRICT ON DELETE RESTRICT;
ALTER TABLE Processos.PROCESSO_ANEXOS ADD FOREIGN KEY (ID_ARQUIVO_VERSAO) REFERENCES Docs.ARQUIVO_VERSOES (ID_ARQUIVO_VERSAO) ON UPDATE RESTRICT ON DELETE RESTRICT;
```

## Regras a materializar após o fechamento da modelagem

Escrever as restrições declarativas possíveis e as funções/triggers necessárias **depois** que o gestor enviar o DDL definitivo. Não executar scripts parciais desta seção. As regras já aprovadas a considerar incluem:

- `PROTOCOLO_VERSOES`: um rascunho por Protocolo; `NR_VERSAO = -1` somente para rascunho, número positivo somente para publicação; coerência com publicador/data e imutabilidade da versão publicada e das definições vinculadas.
- Na publicação, exigir uma etapa inicial e pelo menos uma final; etapa final sem encaminhamento; validar que formulários, variáveis, encaminhamentos, destinatários e documentos referenciados pertençam ao mesmo Protocolo e à versão adequada. Aplicar `INSTITUICAO.SN_PERMITIR_DESTINATARIOS_UNICOS` às regras de destinatários das etapas.
- `PROCESSO_ETAPAS`: garantir que a etapa pertença à versão de Protocolo do Processo. `PROCESSO_ETAPA_ENCAMINHAMENTOS` registra a definição de destino e a passagem; a instância de destino só é criada quando chegam todos os antecedentes efetivamente ativados. Garantir coerência de processo, origem, destino e passagem.
- `PROCESSO_ETAPA_RESPONSAVEIS`: manter o responsável vigente de `PROCESSO_ETAPAS.ID_USUARIO_RESPONSAVEL` sincronizado com o único vínculo sem `DT_FIM`. O índice parcial único `ResponsavelVigentePorEtapa` já consta do export.
- `PROTOCOLO_DOCUMENTO_PDF`: validar que a versão de `Docs` apontada é um PDF e pertence à subpasta `MODELOS` da pasta do Protocolo. Impedir que operações de pasta, lixeira, vencimento ou exclusão permanente tornem indisponível um PDF ainda referenciado por uma versão do documento, especialmente uma versão publicada. A FK sozinha não protege o conteúdo do GridFS.
- Verificar as regras de aplicação das tags de grupo, usuário e vínculo nas definições do Protocolo; a existência do código em `Cadastro.TAGS` não garante que a aplicação correspondente esteja habilitada.

O desenho específico de cada trigger, seus eventos e a ordem de execução serão definidos ao fechar o DDL. Não converter recomendações ou requisitos ainda não decididos em restrições definitivas.

## Decisão ainda pendente

`PROCESSO_VARIAVEL_VALORES.ID_USUARIO_ULTIMA_GRAVACAO` permanece `NOT NULL` no export. Foi **recomendado**, mas ainda não aprovado pelo gestor, torná-lo opcional para gravações automáticas por scripts, sem atribuir a um usuário uma escrita feita pelo sistema. A FK para `Cadastro.USUARIOS_SISTEMA` permanece válida em qualquer das opções; não alterar a nulidade antes da decisão.

Também permanece pendente o desenho exato das referências, em `Docs.ARQUIVO_VERSOES`, ao Processo e à etapa que produzirem uma versão de arquivo. A identificação de ambos foi aprovada, mas as colunas e FKs não devem ser inventadas antes de fechar essa parte da modelagem; arquivos enviados diretamente não terão origem em Processo.
