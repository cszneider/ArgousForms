# ArgousDocs — Modelo de dados: avaliação e plano de evolução

**Versão 1.3.2 · 20/11/2026**
**Base analisada:** `estrutura-inicial.sql` (Cadastro), `estrutura-docs.sql` (Docs), `estrutura-processos.sql` (Processos), `estrutura-notificacoes.sql` (Notificacoes) e os scripts de validação listados em `tabela.txt`.
Também analisado: `ajuste-instituicao-processos-2026-10-29.sql` (recebido na versão 1.1).

Documento vivo: cada nova decisão de produto atualiza a seção 5 e o registro de mudanças (seção 8). Os tickets citam os itens pelo código (ex.: **M-07**).

---

## 1. Visão geral do modelo atual

| Schema | O que guarda |
|---|---|
| **Cadastro** | Pessoas, usuários, login e sessões; programas, permissões, papéis e perfis; grupos, vínculos e tags; instituição (registro único), recursos e variáveis da instituição; integrações (webhooks). |
| **Docs** | Pastas (árvore com raiz única), arquivos, versões com SHA-256, permissões, gestores de pasta, atributos de arquivo, tags de arquivo, lixeira. |
| **Processos** | Protocolos, versões (rascunho `-1` e publicadas), formulários, etapas, encaminhamentos, destinatários, gestores elegíveis, variáveis versionadas, modelos de documento (HTML com partes e CSS, PDF com campos posicionados); processos, etapas executadas, valores por etapa, responsáveis, consultas (pareceres), fórum, anexos, convidados, documentos gerados, transferência de gestão. |
| **Notificacoes** | Eventos (com chave de idempotência) e notificações por usuário (de ação ou informativas). |

**Leitura geral:** o modelo é **maduro e cuidadoso**. A integridade fica no banco (*triggers* de imutabilidade, chaves compostas contra associações cruzadas, histórico em vez de exclusão), e boa parte do que desenhamos na UX **já existe na estrutura**. A maior parte do trabalho é **acrescentar**, não refazer. A exceção é o fluxo (seção 4.1), que precisa de uma decisão de arquitetura.

---

## 2. O que já está alinhado com o desenho (pontos fortes)

| Conceito da UX | Onde já existe | Observação |
|---|---|---|
| Campo definido uma vez, versionado | `PROTOCOLO_VARIAVEIS` (identidade + `CD_VARIAVEL` + `TP_DADO`) → `PROTOCOLO_VARIAVEL_VERSOES` (`DS_NOME`, `JS_DEFINICAO`) → `PROTOCOLO_VERSAO_VARIAVEIS` | Excelente. "Nome apresentado" = `DS_NOME`; regras, formato e exemplo cabem em `JS_DEFINICAO`. |
| Tipo do campo bloqueado após publicação | `trg_variavel_identidade_publicada` | Exatamente a regra da tela 07. |
| Comportamento do campo por etapa | `FORMULARIO_VARIAVEIS.TP_ACESSO`, `SN_OBRIGATORIA`, `NR_ORDEM`, `TP_APRESENTACAO` | Preenche / Só exibe / Pode corrigir cabe em `TP_ACESSO`. |
| "Pode corrigir" com histórico | `PROCESSO_VARIAVEL_VALORES` por **etapa** + `PROCESSO_VARIAVEIS_ATUAIS` (ponteiro) | Cada correção fica registrada com etapa, usuário e data. Atende à recomendação de auditoria. |
| Versões imutáveis, um rascunho por protocolo | `NR_VERSAO = -1` + índice único + `bloquear_definicao_publicada` | Muito bem feito, inclusive para os filhos indiretos. |
| Processo roda na versão em que começou | `PROCESSOS.ID_PROTOCOLO_VERSAO` + `validar_processo_protocolo` | ✓ |
| Gestores elegíveis obrigatórios para publicar | `exigir_gestor_elegivel_publicacao` | ✓ (validação T06). |
| Partes do documento HTML | `PROTOCOLO_DOCUMENTO_HTML_PARTES.TP_PARTE` (A, H, B, X, F; vários B) | Idêntico ao desenho da tela 15. |
| CSS importado com o HTML | `PROTOCOLO_DOCUMENTO_HTML_CSS` + `INSTITUICAO.DS_DOMINIOS_CSS_IMPORTACAO` | ✓ (camada 3, "ajustes do modelo"). |
| PDF com página por campo | `PROTOCOLO_DOCUMENTO_PDF_CAMPOS.NR_PAGINA` + X/Y/L/A + `JS_APRESENTACAO` | Confirma a decisão da tela 14. |
| Hash dos arquivos | `ARQUIVO_VERSOES.CD_HASH_SHA256` | Base pronta para o manifesto e o OpenTimestamps. |
| Pedido de parecer | `PROCESSO_CONSULTAS` (+ `ID_MENSAGEM_PARECER` no fórum) | ✓ |
| Visibilidade de quem é consultado ou convidado | `PROCESSO_CONVIDADOS.JS_VISIBILIDADE` + `ID_PROCESSO_CONSULTA` | Exatamente o "O que esta pessoa poderá ver" da tela 33. |
| Conversa com eventos do sistema | `PROCESSO_FORUM.TP_REGISTRO` | ✓ |
| Avisos sem repetição | `EVENTOS.CD_CHAVE_EVENTO UNIQUE` | Idempotência pronta para os avisos de vigência. |
| Recursos da empresa | `RECURSOS_INSTITUICAO` + `INSTITUICAO.ID_PASTA` | Base para a tela 18. |
| Papéis e perfis de sistema protegidos | `validar-papeis-perfis.sql` | Bom modelo para replicar nas tags de sistema. |

---

## 3. Problemas encontrados no modelo atual (corrigir independentemente das novidades)

| Cód. | Onde | Problema | Correção sugerida |
|---|---|---|---|
| **P-01** | `USUARIO_PERFIS` | Índice único `(ID_USUARIO_SISTEMA, ID_PERFIL)` + trigger que proíbe excluir: depois de **revogar** um perfil, não é possível **atribuí-lo de novo** à mesma pessoa. | Único parcial: `WHERE DT_REVOGACAO IS NULL`. |
| **P-02** | `ARQUIVO_TAGS` | Mesma situação: a PK `(ID_ARQUIVO, CD_TAG)` + `DT_REMOCAO` impede reassociar uma tag removida. | PK própria (UUID) + único parcial `WHERE DT_REMOCAO IS NULL`. |
| **P-03** | `PESSOA_IDENTIFICACOES` | Índice único `PessoaPais (ID_PESSOA, ID_PAIS)` permite **um único documento por país**: uma pessoa não pode ter CPF **e** RG. | Remover `PessoaPais` (a PK `(pessoa, tipo)` já basta). Confirmar se foi intencional. |
| **P-04** | `PROCESSO_ETAPAS` | `DT_ASSUMIU > DT_DISPONIBILIZACAO` e `DT_FINALIZACAO > DT_ASSUMIU` são **estritos**. Uma atribuição automática no mesmo instante viola a regra. | Usar `>=`. |
| **P-05** | Vários | Mistura de `Timestamp` **sem fuso** (PROTOCOLOS, PROTOCOLO_VERSOES, FORMULARIOS, Cadastro, `PASTAS.DT_EXCLUSAO`) com `Timestamp with time zone`. Para auditoria e para o registro de emissão ("13:20:05 UTC−3"), isso é risco real. | Padronizar `timestamptz` (migração com `AT TIME ZONE` usando `INSTITUICAO.CD_FUSO_HORARIO`). |
| **P-06** | `PESSOAS` × `USUARIOS_SISTEMA` | Nome, e-mail e nascimento **duplicados** nas duas tabelas, com risco de divergência. `DT_NASCIMENTO` como `Timestamp`. | Fonte única em `PESSOAS`; em `USUARIOS_SISTEMA`, só o e-mail de login. Nascimento como `Date`. Pela LGPD (minimização), avaliar se o nascimento é necessário. |
| **P-07** | `PASTA_PERMISSOES` | `TP_ACAO` e `TP_DESTINATARIO` sem `CHECK`; nenhuma regra garante coerência (tipo `U` ⇒ usuário preenchido, etc.). | `CHECK` de domínio + `CHECK` de coerência, como em `ARQUIVO_PERMISSOES`. |
| **P-08** | `ARQUIVO_PERMISSOES` | `ID_GRUPO` e `CD_TAG` **sem chave estrangeira** (`PASTA_PERMISSOES` tem). | Acrescentar as FKs. |
| **P-09** | Permissões × destinatários | Duas modelagens para o mesmo conceito: permissões usam **um** `CD_TAG` (sem dizer se é tag de pessoa, grupo ou vínculo); destinatários usam **três** colunas. | Unificar na "regra de pessoas" (M-05). |
| **P-10** | Tags | Dois catálogos: `Cadastro.TAGS` (30 caracteres, organização) e `Docs.TAGS_ARQUIVO` (60, arquivos). | Manter separados, mas renomear para deixar claro (`TAGS_ORGANIZACAO` × `TAGS_ARQUIVO`). Na interface, chamar as de arquivo de **"marcadores"**. |
| **P-11** | Vínculos | Inativar um vínculo, grupo ou usuário **não inativa** as tags do vínculo; as consultas de rota precisam filtrar todos os níveis. | *Trigger* de cascata lógica ou *view* `vw_vinculos_vigentes` usada por toda resolução de rota. |
| **P-12** | Domínios | Vários `TP_*` sem `CHECK`: `ARQUIVOS.TP_CLASSIFICACAO`, `ARQUIVO_VERSOES.TP_ORIGEM`, `FORMULARIO_VARIAVEIS.TP_ACESSO`, `PROCESSOS.TP_SITUACAO`, `PROCESSO_ETAPAS.TP_SITUACAO`, `PROCESSO_FORUM.TP_REGISTRO`, `PROCESSO_CONSULTAS.TP_SITUACAO`, `PROCESSO_DOCUMENTO.TP_SITUACAO` e outros. | Documentar os códigos (`COMMENT ON COLUMN`) e criar os `CHECK`. |
| **P-13** | `PASTAS`, `PASTA_GESTORES` | Nenhum impedimento a duas subpastas ativas com o mesmo nome nem a gestor duplicado ativo. | Únicos parciais, como em `ARQUIVOS`. |
| **P-14** | Nomes | "Atributo" significa duas coisas: `Docs.ATRIBUTOS` (metadados de arquivo, UUID) e `Cadastro.VARIAVEIS_INSTITUICAO.ID_ATRIBUTO` (variáveis da instituição, serial), referenciada como `PDF_CAMPOS.ID_ATRIBUTO`. | Renomear a coluna para `ID_VARIAVEL_INSTITUICAO` numa janela de migração. |
| **P-15** | `PROCESSO_FORUM` | Nada impede `UPDATE`/`DELETE` de mensagens, e a conversa é trilha de auditoria. | *Trigger* de imutabilidade + tabela `PROCESSO_FORUM_EDICOES` para as edições. |
| **P-16** | Papel do banco | O usuário da aplicação se chama `carlos`. | Papel técnico (`argous_app`), sem nome de pessoa. |
| **P-17** | Cabeçalho | "Database PostgreSQL 7" (gerado pela ferramenta). O código usa `EXECUTE FUNCTION` (PG ≥ 11). | Corrigir o comentário para a versão real. |
| **P-18** | `ajuste-instituicao-processos-2026-10-29.sql` | O script acrescenta `SN_PERMITIR_DESTINATARIOS_UNICOS` e uma *constraint* de lixeira que **já existem** no `estrutura-inicial.sql` atual. Numa instalação nova, ele **falha** (coluna duplicada) e, se rodar, cria um `CHECK` repetido. | Torná-lo idempotente (`ADD COLUMN IF NOT EXISTS`; criar a *constraint* só se não existir) ou marcá-lo como "somente para bases anteriores a 29/10/2026" e retirá-lo da sequência de instalação nova. |

---

## 4. Decisões de arquitetura necessárias

### 4.1 Como o fluxo é guardado — DECIDIDO (v1.2)

**Decisão:** o fluxo continua guardado em **etapas + cadeias de `ENCAMINHAMENTOS`**. Não haverá tabela de conexões nem blocos de tipo Decisão, Paralelo, Gerar documento, Notificar ou Fim. A única novidade estrutural é o **concentrador** (`TP_BLOCO = 'J'`, ver M-01).

**Como a cadeia funciona (regra do motor):**
- Cada etapa aponta para o **primeiro** encaminhamento da sua cadeia (`PROTOCOLOS_ETAPAS.ID_ENCAMINHAMENTO`). Os demais seguem por `ID_PROXIMO_ENCAMINHAMENTO`.
- **`TP_ENCAMINHAMENTO = 'E'` (direto):** dispara para `ID_PROXIMA_ETAPA` e **continua** a cadeia.
- **`TP_ENCAMINHAMENTO = 'T'` (teste):** executa `TX_TESTE`, uma função JavaScript que devolve verdadeiro ou falso. Verdadeiro → dispara para `ID_PROXIMA_ETAPA` e **para** a cadeia. Falso → segue para `ID_PROXIMO_ENCAMINHAMENTO`.
- **`TP_ENCAMINHAMENTO = 'C'` (condicional, decidido em 20/11/2026):** executa `TX_TESTE`. Verdadeiro → dispara para `ID_PROXIMA_ETAPA` e **continua** a cadeia. Falso → continua sem disparar.
- `TX_TESTE` é obrigatório em `T` e `C` e proibido em `E`.
- `ID_PROXIMA_ETAPA` aponta tanto para uma etapa (`'E'`) quanto para um concentrador (`'J'`).

**Tipos de cadeia permitidos na v1 (sem mistura):**

| Tipo | Forma da cadeia | Como aparece no editor |
|---|---|---|
| Direta | um único `E` | uma seta |
| Paralela | dois ou mais `E`, só `E` | bloco visual "Em paralelo" |
| Paralela condicional | dois ou mais encaminhamentos, só `E` e `C`, com **pelo menos um `E`** (garante que algum ramo sempre dispara) | bloco "Em paralelo" com condição nos ramos |
| Decisão | um ou mais `T`, terminando obrigatoriamente em um `E` ("caso contrário") | bloco visual "Decisão" |

- **Decisão sem "caso contrário" é proibida.** Garante que o processo nunca fica parado sem destino.
- **`T` não se mistura com `E`/`C` na mesma cadeia** na v1. Ramos que não disparam não ficam ativos, e o concentrador dinâmico não os espera.
- **O fim é implícito:** a etapa sem encaminhamento (`ID_ENCAMINHAMENTO IS NULL`) é uma etapa final. O editor desenha o ícone de fim ao lado dela.
- **Liberdade de modelagem:** um fluxo pode se dividir e não se juntar, ter vários concentradores e vários finais. Quem garante que não há beco sem saída é o modelador. O sistema ajuda com **avisos na publicação** e com a **simulação**.
- Os blocos "Decisão", "Em paralelo" e o ícone de fim são **apenas representação visual** da cadeia. O banco não os guarda como nós.
- Geração de documento e notificação são **atividades da etapa** (documento: M-02; notificação: função disponível nos scripts).

> Histórico: a v1.1 recomendava generalizar a etapa em "bloco" com uma tabela de conexões (opção A). Descartada na v1.2: a cadeia de encaminhamentos já resolve direta, paralela e decisão, e a mudança seria muito maior.

### 4.2 Uma instituição por banco

`INSTITUICAO` tem registro único (`ID_INSTITUICAO = 1`). Ou seja, **cada cliente tem um banco (ou schema) próprio**. Isso é bom para isolamento e LGPD, mas tem consequências para o SaaS: atualização de N bancos, catálogo da loja de modelos e estilos da coleção (que precisam viver **fora** do banco do cliente), e métricas consolidadas.

> **Pergunta:** o "multiempresa" é um banco por cliente? Se sim, os itens globais (estilos da coleção, loja, tags de sistema) devem vir de um **catálogo central** sincronizado.

---

## 5. Mudanças propostas, por tema

Os nomes seguem a convenção do projeto (`ID_`, `DS_`, `CD_`, `TP_`, `SN_`, `DT_`, `NR_`, `VL_`, `JS_`, `TX_`). As referências a tickets (T02…T18) nesta seção são do primeiro conjunto, **descartado na v1.2**; serão refeitas quando a discussão da modelagem terminar. Só o T01 (navegação e vocabulário) foi implementado. O DDL é um esboço, a ser refinado na migração.

### M-01 · Concentrador, prazo da etapa e resultado do processo — DECIDIDO (v1.2), exceto onde indicado

**a) Tipo do nó: etapa ou concentrador**

```sql
ALTER TABLE Processos.PROTOCOLOS_ETAPAS
  ADD COLUMN TP_BLOCO Char(1) NOT NULL DEFAULT 'E'
    CHECK (TP_BLOCO IN ('E','J')),          -- E etapa · J concentrador (junção)
  ALTER COLUMN ID_FORMULARIO DROP NOT NULL,
  ADD CONSTRAINT ck_etapa_formulario
    CHECK ((TP_BLOCO = 'E') = (ID_FORMULARIO IS NOT NULL)),
  ADD CONSTRAINT ck_concentrador_sem_documento
    CHECK (TP_BLOCO = 'E' OR JS_GERACAO_DOCUMENTOS IS NULL);
```

Regras do concentrador (`'J'`):
- Não tem formulário, não gera documento e **não tem ação humana** (sem destinatários, sem prazo).
- Pode ter `TX_SCRIPT_INICIALIZACAO` e `TX_SCRIPT_FINALIZACAO`.
- **Liberação dinâmica (decidido em 20/11/2026):** o concentrador libera o fluxo pelo seu próprio encaminhamento quando **nenhuma etapa ativa do processo ainda consegue alcançá-lo** pelo desenho da versão publicada. Não espera entradas que não podem mais chegar (ramo desviado por uma decisão, ramo encerrado em outro fim). Não exige tabela nova: as chegadas já ficam em `PROCESSO_ETAPA_ENCAMINHAMENTOS`, e a alcançabilidade é calculada sobre `ENCAMINHAMENTOS` da versão.
- **Aviso ao gestor:** quando o concentrador libera sem a chegada de algum ramo que aponta para ele, o sistema notifica o gestor do processo ("o ramo X terminou sem passar por J; o processo segue"). Nada fica parado; o gestor pode cancelar o processo a qualquer momento. Se os ramos terminarem com resultados diferentes, vale a regra dos finais conflitantes (finalização obrigatória pelo gestor).
- Se um desvio deve encerrar o processo inteiro, isso deve ser **desenhado** no fluxo pelo modelador.
- Não pode ser a etapa inicial nem uma etapa final.

Ajustes na trigger de publicação:
- "Exatamente uma inicial" passa a contar só `TP_BLOCO = 'E'`, e o concentrador nunca pode ficar sem entrada.
- "Ao menos uma regra de destinatário por etapa" passa a valer só para `TP_BLOCO = 'E'`.
- Cadeias validadas pelos três tipos permitidos (seção 4.1), incluindo o "caso contrário" obrigatório na decisão.
- Avisos (não bloqueiam): ramos paralelos que terminam sem passar por um concentrador; concentrador alcançável por um único caminho.

**b) Prazo da etapa — DECIDIDO (20/11/2026).** Unidades: `U` dias úteis (segunda a sexta, por enquanto sem feriados), `C` dias corridos, `H` horas. `U` e `C` vencem no fim do dia (23:59:59) no fuso da instituição; `H` é exato. O banco grava `PROCESSO_ETAPAS.DT_LIMITE` ao disponibilizar a etapa, para mudanças no protocolo não alterarem processos em andamento. Feriados ficam para um cadastro próprio. `SN_AVISAR_GESTOR_VENCIDA` não entrou (avisos serão tratados com as notificações).

```sql
-- PROTOCOLOS_ETAPAS: NR_PRAZO Smallint (> 0), TP_UNIDADE_PRAZO Char(1) ('U','C','H'), ck_etapa_prazo
-- PROCESSO_ETAPAS:   DT_LIMITE timestamptz, calculado por Processos.definir_limite_etapa()
```

**c) Resultado do processo**

Domínio universal, igual em todos os protocolos:

| `TP_RESULTADO` | Significado |
|---|---|
| `P` | Positivo: atingiu o objetivo (aprovado, concluído, contratado) |
| `N` | Negativo: terminou sem atingir o objetivo (reprovado, indeferido) |
| `C` | Cancelado: interrompido antes do fim |

```sql
-- Resultado padrão de cada etapa final (definido pelo modelador)
ALTER TABLE Processos.PROTOCOLOS_ETAPAS
  ADD COLUMN TP_RESULTADO_PADRAO Char(1) NULL CHECK (TP_RESULTADO_PADRAO IN ('P','N')),
  ADD CONSTRAINT ck_resultado_padrao_so_final
    CHECK (TP_RESULTADO_PADRAO IS NULL OR (TP_BLOCO = 'E' AND ID_ENCAMINHAMENTO IS NULL));

-- Resultado gravado no processo
ALTER TABLE Processos.PROCESSOS
  ADD COLUMN TP_RESULTADO Char(1) NULL CHECK (TP_RESULTADO IN ('P','N','C')),
  ADD COLUMN DS_RESULTADO Text NULL,
  ADD CONSTRAINT ck_processo_resultado
    CHECK ((DT_ENCERRAMENTO IS NULL) = (TP_RESULTADO IS NULL)),
  ADD CONSTRAINT ck_processo_resultado_motivo
    CHECK (TP_RESULTADO NOT IN ('N','C') OR NULLIF(btrim(DS_RESULTADO), '') IS NOT NULL);
```

Quem preenche:
- **Protocolo com `SN_GESTOR_FINALIZA = true`:** ao chegar ao fim, o processo aguarda o gestor. Ele escolhe P ou N e escreve `DS_RESULTADO` (obrigatório se N).
- **Protocolo sem finalização pelo gestor:** vale o `TP_RESULTADO_PADRAO` da etapa final alcançada. O script de finalização pode sobrescrever. Na publicação, toda etapa final deve ter resultado padrão. Uma decisão pode levar a dois finais, um P e outro N.
- **Cancelamento:** feito pelo gestor a qualquer momento; resultado `C`, com `DS_RESULTADO` obrigatório.
- **Motivo do negativo automático (decisão do Carlos, 20/11/2026):** quando o processo encerra sozinho numa etapa final com resultado padrão `N`, `DS_RESULTADO` recebe o texto fixo do sistema: "Resultado negativo definido pelo Protocolo para esta etapa final."
- **Dois ou mais finais alcançados com resultados diferentes** (só possível com ramos paralelos que não se juntam): o processo passa obrigatoriamente pela finalização do gestor, mesmo que o protocolo não a exija. Caso raro na prática; costuma indicar concentrador esquecido, por isso também gera aviso na publicação.
- O processo só encerra quando **nenhum ramo estiver ativo**.

> Verificar: qual valor de `PROCESSOS.TP_SITUACAO` representa "aguardando finalização do gestor"? O domínio de `TP_SITUACAO` não tem `CHECK` (ver P-12).

### M-02 · Geração de documento: atividade da etapa — PROPOSTA (a discutir)

A geração continua sendo **uma atividade da etapa** (não é bloco do fluxo). O ponto em aberto é só o formato: hoje é um JSON (`JS_GERACAO_DOCUMENTOS`), sem integridade com o modelo de documento. Proposta: trocar por uma tabela filha, uma linha por documento gerado na etapa.

```sql
CREATE TABLE Processos.PROTOCOLO_ETAPA_DOCUMENTOS (
  ID_PROTOCOLO_ETAPA_DOCUMENTO UUID PRIMARY KEY,
  ID_PROTOCOLO_ETAPA UUID NOT NULL,                    -- só TP_BLOCO = 'E'
  ID_PROTOCOLO_DOCUMENTO UUID NOT NULL,                -- com FK: o JSON atual não tem integridade
  NR_ORDEM Smallint NOT NULL,
  TP_FINALIDADE Char(1) NOT NULL CHECK (TP_FINALIDADE IN ('I','F')),   -- intermediário | final
  SN_MOSTRAR_PROXIMA_ETAPA Boolean NOT NULL DEFAULT false,
  SN_ENVIAR_SOLICITANTE Boolean NOT NULL DEFAULT false,
  TX_PADRAO_NOME_ARQUIVO Varchar(255) NOT NULL,        -- "Resumo_{{numeroProcesso}}_{{dsNomeCandidato}}.pdf"
  JS_VIGENCIA JSONB NULL                               -- M-12: vigência do documento emitido
);
```

### M-03 · Número do processo — DECIDIDO (20/11/2026)

- Formato: `PREFIXO-AAAA-NNNNNN` na sequência anual (padrão) e `PREFIXO-NNNNNN` na contínua. O modelador escolhe por protocolo (`PROTOCOLOS.TP_SEQUENCIA` A/C); a troca vale a partir do próximo processo e os formatos não colidem.
- `PROTOCOLOS.CD_PREFIXO`: 2 a 6 letras maiúsculas ou dígitos, único entre todos os protocolos (ativos ou não), obrigatório para publicar.
- Sequência por protocolo (`PROTOCOLO_SEQUENCIAS`, `NR_ANO = 0` na contínua), incremento atômico.
- `PROCESSOS.CD_NUMERO` gerado pelo banco no início do processo; imutável; nunca reutilizado, nem em cancelamento.
- Fora por enquanto: `ID_GRUPO_ORIGEM` (depende da discussão de organização, M-06).

### M-04 · Formulário: elementos visuais, ajuda e condição — T08

```sql
ALTER TABLE Processos.FORMULARIO_VARIAVEIS
  ADD CONSTRAINT ck_formulario_acesso CHECK (TP_ACESSO IN ('P','E','C')),  -- preenche | só exibe | pode corrigir
  ADD COLUMN DS_NOME_ALTERNATIVO Varchar(255) NULL,
  ADD COLUMN DS_AJUDA Varchar(500) NULL,
  ADD COLUMN JS_CONDICAO_EXIBICAO JSONB NULL,
  ADD COLUMN ID_SECAO UUID NULL;
CREATE TABLE Processos.FORMULARIO_ELEMENTOS (          -- seções, textos de orientação, imagens, divisores
  ID_ELEMENTO UUID PRIMARY KEY, ID_FORMULARIO UUID NOT NULL,
  TP_ELEMENTO Char(1) NOT NULL CHECK (TP_ELEMENTO IN ('S','T','I','D')),
  NR_ORDEM Smallint NOT NULL, DS_TITULO Varchar(255) NULL, TX_CONTEUDO Text NULL,
  ID_PROTOCOLO_RECURSO UUID NULL);
```
- A ordem final do formulário intercala elementos e campos. Sugestão: `NR_ORDEM` numa sequência única por formulário, cobrindo as duas tabelas, ou um índice de ordem só em `FORMULARIO_ELEMENTOS`, com os campos referenciados como elemento tipo `'V'`.

### M-05 · Regra de pessoas: "quem executa" — T03, T04 e visão de equipe

Substitui as colunas soltas de `PROTOCOLO_ETAPA_DESTINATARIOS` e de `PROTOCOLO_GESTORES_ELEGIVEIS`, e serve também às permissões de pasta e arquivo (P-09).

```sql
-- Em PROTOCOLO_ETAPA_DESTINATARIOS (e equivalentes):
ADD COLUMN TP_REFERENCIA Char(1) NOT NULL DEFAULT 'F'
  CHECK (TP_REFERENCIA IN ('F','O','S','U')),
  -- F grupo fixo (ID_GRUPO) · O grupo de origem do processo · S grupo superior ao de origem
  -- U subir a partir da origem até um grupo com a tag CD_TAG_GRUPO_ALVO
ADD COLUMN NR_NIVEIS Smallint NULL,                    -- para 'S': quantos níveis acima
ADD COLUMN CD_TAG_GRUPO_ALVO Varchar(30) NULL;         -- para 'U'

-- Políticas da etapa (PROTOCOLOS_ETAPAS):
ADD COLUMN TP_MULTIPLOS Char(1) NOT NULL DEFAULT 'F' CHECK (TP_MULTIPLOS IN ('F','T','U')),
  -- F fila (qualquer um assume) · T todos concluem · U basta um aprovar
ADD COLUMN TP_SEM_DESTINATARIO Char(1) NOT NULL DEFAULT 'G' CHECK (TP_SEM_DESTINATARIO IN ('G','S','B')),
  -- G gestores elegíveis do protocolo · S sobe um nível · B bloqueia com aviso
ADD COLUMN TP_AUTOAPROVACAO Char(1) NOT NULL DEFAULT 'P' CHECK (TP_AUTOAPROVACAO IN ('P','S','O','G'));
  -- P permite · S substituto · O outro gestor do grupo · G gestores elegíveis
```
- **Política da instituição já existente:** `INSTITUICAO.SN_PERMITIR_DESTINATARIOS_UNICOS = false` obriga cada etapa a ter ao menos uma regra **não nominal** (grupo ou tag). Manter a política e refleti-la na UX: ao escolher uma pessoa específica em "Quem executa", o painel avisa e a validação da publicação (T06) aponta a pendência.
- **Fotografia da resolução:** `PROCESSO_ETAPA_CANDIDATOS (ID_PROCESSO_ETAPA, ID_USUARIO_SISTEMA, DT_RESOLUCAO, CD_REGRA)`. Grava quem era elegível no momento em que a etapa ficou disponível. Mudanças futuras nos vínculos não reescrevem a história.

### M-06 · Organização: hierarquia de grupos e tags de sistema

> **Diretriz de produto (Carlos, 20/11/2026):** toda decisão de modelo precisa fazer sentido para qualquer tipo de empresa; exemplos de saúde servem para testar, não para definir.

**a) Hierarquia — DECIDIDO (20/11/2026)**

```sql
ALTER TABLE Cadastro.GRUPOS
  ADD COLUMN ID_GRUPO_SUPERIOR Integer NULL REFERENCES Cadastro.GRUPOS (ID_GRUPO),
  ADD CONSTRAINT ck_grupo_superior CHECK (ID_GRUPO_SUPERIOR IS NULL OR ID_GRUPO_SUPERIOR <> ID_GRUPO);
```
- **Regra do ArgousForms:** cada grupo responde a **no máximo um** grupo. O superior é **opcional** (topo da organização, comissões, grupos de projeto).
- Por trigger: **sem ciclos**; o superior precisa estar ativo; **não se desativa um grupo com subordinados ativos** — a tela lista os subordinados para serem movidos ou desligados da hierarquia.
- É a hierarquia usada para "subir níveis", "gestor do grupo acima" e alçada.
- **Sem tabela de relações entre grupos** (`GRUPO_RELACOES` descartada): as demais características de um grupo são **tags de grupo** (`GRUPO_TAGS`, já existente). Consequência aceita na v1: não há relação dirigida entre dois grupos ("X apoia Y"); se surgir a necessidade, a tabela entra depois sem afetar a hierarquia.
- Mudanças de hierarquia não reescrevem a história: quem era elegível em cada etapa fica gravado (M-05, fotografia da resolução).

**b) Tags de sistema**

```sql
ALTER TABLE Cadastro.TAGS
  ADD COLUMN SN_SISTEMA Boolean NOT NULL DEFAULT false,
  ADD COLUMN DS_NOME_EXIBICAO Varchar(60) NULL,        -- apelido por empresa ("Coordenador" para gestor)
  ADD COLUMN SN_RESTRITA Boolean NOT NULL DEFAULT false;        -- etiqueta de pessoa com dado sensível
```
- **Tags de sistema — DECIDIDO (20/11/2026)** (carga inicial, protegidas como os papéis):

  | Código | Aplica-se a | Comportamento no sistema |
  |---|---|---|
  | `departamento` | grupo | marca os grupos que são setores da estrutura |
  | `lotacao` | vínculo | setor **oficial** da pessoa; só em grupo `departamento`; **no máximo uma lotação ativa por pessoa** (índice único); define o grupo de origem do processo |
  | `gestor` | vínculo | gestor do grupo ("gestor do setor de origem", subida na hierarquia) |
  | `substituto` | vínculo | responde pelo gestor nas ausências (M-07) |
  | `supervisor` | vínculo | nível intermediário entre gestor e equipe |

- **Grupo de origem do processo:** `PROCESSOS.ID_GRUPO_ORIGEM Integer NULL` = lotação de quem inicia, gravada no início e imutável. Sem lotação → nulo; regras que dependem da origem seguem a política de etapa sem destinatário (M-05). Pessoa cedida a outro setor abre processos em nome da lotação (escolha de setor fica para depois, se necessária).
- O nome exibido de cada tag de sistema é editável por instituição (`DS_NOME_EXIBICAO`); o código não muda.
- **Tag sensível — DECIDIDO (20/11/2026):** `TAGS.SN_RESTRITA` existe **apenas como aviso de cuidado**. Quando marcada, as telas que aplicam ou mostram a tag exibem um alerta de dado sensível (LGPD). **Não há controle de visibilidade na v1.** O cadastro de tags orienta a não criar tags que revelem dados pessoais sensíveis (saúde, deficiência, religião, filiação sindical etc.). Controle de visibilidade e auditoria de quem aplica fica para versão futura, se necessário.
- Proteção: as tags de sistema não podem ser excluídas nem desativadas, e o código e as aplicações não mudam; só `DS_NOME_EXIBICAO` é editável. Mesmo padrão de `validar_papel`.

### M-07 · Ausências e delegação — visão de equipe

```sql
CREATE TABLE Cadastro.AUSENCIAS (
  ID_AUSENCIA UUID PRIMARY KEY, ID_USUARIO_SISTEMA UUID NOT NULL,
  DT_INICIO timestamptz NOT NULL, DT_FIM timestamptz NOT NULL CHECK (DT_FIM > DT_INICIO),
  ID_USUARIO_DELEGADO UUID NULL,                       -- se nulo: substituto do grupo
  ID_USUARIO_REGISTROU UUID NOT NULL, DT_INCLUSAO timestamptz NOT NULL, DT_CANCELAMENTO timestamptz NULL);
-- Não registra o motivo da ausência (LGPD: pode revelar saúde).
```

### M-08 · Partes condicionais e estilos — T11, T12

```sql
ALTER TABLE Processos.PROTOCOLO_DOCUMENTO_HTML_PARTES
  ADD COLUMN DS_ROTULO Varchar(80) NULL,               -- "Cláusula de dados sensíveis"
  ADD COLUMN JS_CONDICAO JSONB NULL,                   -- nulo = sempre
  ADD COLUMN SN_NOVA_PAGINA Boolean NOT NULL DEFAULT false;

CREATE TABLE Cadastro.ESTILOS_DOCUMENTO (              -- estilos da empresa (camadas 1 e 2)
  ID_ESTILO UUID PRIMARY KEY, DS_NOME Varchar(60) NOT NULL, ID_ARQUIVO_VERSAO UUID NOT NULL,
  SN_BASE Boolean NOT NULL DEFAULT false,              -- único estilo base (índice único parcial)
  CD_ESTILO_COLECAO Varchar(40) NULL,                  -- se veio da coleção ArgousDocs (catálogo central)
  SN_DISPONIVEL Boolean NOT NULL DEFAULT true);
ALTER TABLE Processos.PROTOCOLO_DOCUMENTO_HTML ADD COLUMN ID_ESTILO UUID NULL;   -- camada 2
-- Camada 3 continua em PROTOCOLO_DOCUMENTO_HTML_CSS.
```
- No documento emitido, o CSS das três camadas já está "embutido" no PDF, então mudanças futuras não afetam o que foi emitido.

### M-09 · PDF: unidade, origem e ajuste de texto — T13

- `COMMENT ON COLUMN` deixando explícito: **unidade = ponto tipográfico (1/72")** e **origem = canto superior esquerdo da página** (a conversão para a origem inferior do PDF é feita na renderização).
- `JS_APRESENTACAO` passa a incluir `ajuste: "reduzir" | "quebrar" | "cortar"`.

### M-10 · Emissão: registro, manifesto e OpenTimestamps — T16, T17

```sql
ALTER TABLE Processos.PROTOCOLO_VERSOES
  ADD COLUMN SN_HISTORICO_NO_REGISTRO Boolean NOT NULL DEFAULT true,
  ADD COLUMN SN_CARIMBO_TEMPO Boolean NOT NULL DEFAULT false;
ALTER TABLE Processos.PROCESSO_DOCUMENTO
  ADD COLUMN TP_FINALIDADE Char(1) NOT NULL DEFAULT 'F' CHECK (TP_FINALIDADE IN ('I','F'));

CREATE TABLE Processos.PROCESSO_DOCUMENTO_PROVAS (
  ID_PROCESSO_DOCUMENTO UUID PRIMARY KEY,
  ID_PASTA_PACOTE UUID NOT NULL,                       -- a "pasta do documento"
  ID_ARQUIVO_VERSAO_REGISTRO UUID NOT NULL,            -- Registro_de_emissao.pdf
  ID_ARQUIVO_VERSAO_MANIFESTO UUID NOT NULL,           -- manifesto.json
  CD_HASH_MANIFESTO Char(64) NOT NULL,
  TP_SITUACAO_CARIMBO Char(1) NOT NULL CHECK (TP_SITUACAO_CARIMBO IN ('N','E','P','C','F')),
    -- N não se aplica · E aguardando envio · P pendente no calendário · C confirmado no Bitcoin · F falha
  ID_ARQUIVO_VERSAO_OTS UUID NULL,                     -- versão do .ots (nova versão a cada upgrade)
  NR_BLOCO_BITCOIN Integer NULL, DT_CONFIRMACAO timestamptz NULL,
  DT_ULTIMA_TENTATIVA timestamptz NULL, NR_TENTATIVAS Smallint NOT NULL DEFAULT 0);
CREATE INDEX ix_provas_pendentes ON Processos.PROCESSO_DOCUMENTO_PROVAS (DT_ULTIMA_TENTATIVA)
  WHERE TP_SITUACAO_CARIMBO IN ('E','P');               -- fila da rotina de upgrade
```
- *Trigger:* depois de criada, só as colunas de situação e prova mudam; os arquivos da pasta do pacote não aceitam nova versão.

### M-11 · Simulação — T18

- **Preferência: não persistir.** O motor roda em memória e devolve o percurso.
- Se o motor exigir persistência: `PROCESSOS.SN_SIMULACAO`. Processos simulados não consomem `CD_NUMERO`, não geram `EVENTOS`, não gravam em `Docs` e são excluídos ao fim da sessão. É o único caso em que excluir é permitido.

### M-12 · Vigência de documentos — T21, T22, T23

`ARQUIVOS.DT_VENCIMENTO` e `PROTOCOLO_DOCUMENTO_VERSOES.NR_DIAS_VENCIMENTO` já são o começo; o módulo pede mais:

```sql
CREATE TABLE Docs.TIPOS_DOCUMENTO (                    -- Contrato, Política, Licença, Procuração…
  ID_TIPO_DOCUMENTO UUID PRIMARY KEY, DS_NOME Varchar(60) NOT NULL,
  JS_PADROES JSONB NOT NULL,                           -- avisos e protocolo de renovação sugeridos
  SN_ATIVO Boolean NOT NULL);
CREATE TABLE Docs.ARQUIVO_VIGENCIAS (
  ID_ARQUIVO UUID PRIMARY KEY,
  ID_TIPO_DOCUMENTO UUID NULL,
  DT_INICIO Date NULL, DT_TERMINO Date NULL,           -- substitui ARQUIVOS.DT_VENCIMENTO
  TP_AO_TERMINO Char(1) NOT NULL CHECK (TP_AO_TERMINO IN ('M','A','X')),   -- manual | automática | arquivar
  NR_MESES_REVISAO Smallint NULL, DT_PROXIMA_REVISAO Date NULL,
  JS_AVISOS JSONB NOT NULL,                            -- [60, 30, 7, 0]
  TP_RESPONSAVEL Char(1) NOT NULL, ID_USUARIO_RESPONSAVEL UUID NULL, ID_GRUPO_RESPONSAVEL Integer NULL,
  SN_AVISAR_GESTOR Boolean NOT NULL DEFAULT false,
  ID_PROTOCOLO_RENOVACAO UUID NULL, NR_DIAS_INICIO_AUTOMATICO Smallint NULL,
  ID_PROCESSO_RENOVACAO UUID NULL,                     -- processo em andamento ("Em revisão")
  ID_ARQUIVO_SUBSTITUTO UUID NULL,                     -- preenchido quando o novo documento é emitido
  ID_PROCESSO_ORIGEM UUID NULL);                       -- se a vigência veio de um processo
ALTER TABLE Notificacoes.EVENTOS ADD COLUMN ID_ARQUIVO UUID NULL;   -- avisos de vigência não têm processo
-- CD_CHAVE_EVENTO = 'vigencia:{arquivo}:{antecedencia}:{data}' garante aviso único.
ALTER TABLE Cadastro.INSTITUICAO ADD COLUMN SN_MODULO_VIGENCIA Boolean NOT NULL DEFAULT false;
```

### M-13 · Consultas (pareceres): prazo — DECIDIDO (20/11/2026)

- `PROCESSO_CONSULTAS.DT_LIMITE` opcional, informado por quem pede; a tela sugere 2 dias.
- **Pergunta ainda aberta:** o que é `ID_USUARIO_APROVADOR` na consulta? Existe aprovação para pedir parecer?

### M-14 · Tipos de valor que faltam

- **Opção única:** a coluna atual é `CD_OPCAO Text` (chave da opção; decisão do Carlos no DDL de 19/11/2026). `VL_OPCAO` fica obsoleto e será removido.
- **Múltipla escolha:** ainda a definir (ver notas do antigo T02 em `Tickets/_arquivo/`).
- **Anexo como campo:** `VL_ARQUIVO_VERSAO UUID` com FK para `Docs.ARQUIVO_VERSOES`.
- **Pessoa/perfil como campo:** `VL_USUARIO UUID`.
- Documentar os códigos de `TP_DADO` (`S, I, R, M, V, B, O, D, H, T`) e mapear para os tipos da tela 06.

---

## 6. Ordem sugerida das migrações

| Etapa | Mudanças | Por quê nesta ordem |
|---|---|---|
| 1 | P-01 a P-18 | Correções independentes, de baixo risco e sem mudar comportamento. |
| 2 | M-06, M-07 | A organização é a base das regras de rota. |
| 3 | M-01 (concentrador, prazo, resultado), M-03, M-05 | O núcleo do fluxo. |
| 4 | M-02, M-04, M-13, M-14 | Documentos da etapa e formulários. |
| 5 | M-08, M-09 | Modelos e estilos. |
| 6 | M-10, M-11 | Emissão e simulação. |
| 7 | M-12 | Módulo Vigência. |

Em todas: scripts **idempotentes**, com `BEGIN`/`COMMIT`, sem apagar dados, e com um passo de verificação antes (como já fazem `validar-aplicacoes-tags.sql` e `validar-vinculos-organizacao.sql`).

---

## 7. Perguntas abertas

1. **Multiempresa:** um banco (ou schema) por cliente? Como serão atualizadas as estruturas e o catálogo central (coleção de estilos, loja, tags de sistema)?
2. **`PESSOAS` × `USUARIOS_SISTEMA`:** existirão pessoas sem usuário (no futuro, participantes externos)? Isso afeta P-06.
3. **`PessoaPais` (P-03):** uma identificação por país foi intencional?
4. **Consultas:** para que serve `ID_USUARIO_APROVADOR`?
5. **`VARIAVEIS_INSTITUICAO`:** são os "campos da empresa" (razão social, CNPJ…)? Se forem, entram na Biblioteca › Campos como origem **"Da empresa"**. A UX ainda não os mostrava.
6. **Códigos de domínio:** posso receber (ou você confirma) a lista dos `TP_*` sem `CHECK` (P-12)?

---

## 8. Registro de mudanças deste documento

| Versão | Data | Mudança |
|---|---|---|
| 1 | 20/11/2026 | Primeira avaliação a partir dos scripts de Cadastro, Docs, Processos e Notificacoes. |
| 1.1 | 20/11/2026 | Incluído `ajuste-instituicao-processos-2026-10-29.sql`: novo P-18 (script não idempotente) e nota sobre a política de destinatários únicos em M-05. Arquivo passa a ter nome fixo (`ArgousDocs-modelo-de-dados.md`); a versão fica no cabeçalho e no registro de mudanças. |
| 1.2 | 20/11/2026 | Fluxo decidido (4.1): mantém etapas + cadeias de encaminhamentos com tipos Direta, Paralela e Decisão (com "caso contrário" obrigatório); fim implícito. M-01 reescrito: `TP_BLOCO` só `E`/`J` (concentrador), prazo da etapa, `TP_RESULTADO_PADRAO` na etapa final e `TP_RESULTADO`/`DS_RESULTADO` em `PROCESSOS` (P/N/C; finais conflitantes → gestor finaliza). Removidos a tabela de conexões e os blocos G/N/F/D/P. M-02 passa a ser atividade da etapa (tabela filha, a discutir). Novas perguntas: paralelo condicional e contagem do concentrador. Tickets T02–T18 descartados. |
| 1.2.1 | 20/11/2026 | Gestor confirmou que as decisões desta revisão prevalecem sobre as notas do antigo T02 (`Tickets/_arquivo/T02-NOTAS-MODELAGEM-2026-11-20.md`) onde houver conflito: (1) etapa `E` sempre tem formulário (`ck_etapa_formulario`), inclusive no rascunho; (2) o processo tem resultado geral (`TP_RESULTADO`/`DS_RESULTADO`). Demais itens das notas serão avaliados na revisão. Documento passa a morar em `ArgousForms/banco/modelo-de-dados.md`. |
| 1.2.2 | 20/11/2026 | Contagem do concentrador decidida: liberação dinâmica (libera quando nenhuma etapa ativa ainda o alcança), com aviso ao gestor quando um ramo não chega. Pergunta removida da seção 7. |
| 1.2.3 | 20/11/2026 | Paralelo condicional decidido: novo `TP_ENCAMINHAMENTO = 'C'` (dispara se verdadeiro e continua a cadeia). Nova cadeia "Paralela condicional" (só `E` e `C`, ao menos um `E`). `TX_TESTE` obrigatório em `T`/`C`, proibido em `E`. Pergunta removida da seção 7. |
| 1.2.4 | 20/11/2026 | M-01 (a) e (c) e as regras de 4.1 escritos nos scripts oficiais (`estrutura/estrutura-processos.sql`, `regras/validar-processos.sql`) e em `ajustes/2026-11-20-adequar-fluxo-concentrador-resultado.sql`; testes em `testes/testar-fluxo-resultado.sql`. `TP_BLOCO` com `DEFAULT 'E'`. M-01 (b), prazo da etapa, ainda não entrou no CASE nem nos scripts. A liberação dinâmica do concentrador e o aviso ao gestor são do motor (aplicação), não do banco. |
| 1.2.5 | 20/11/2026 | Dúvidas do T02: (D2) texto fixo no motivo do negativo automático; (D3) `CD_OPCAO` em `PROCESSO_VARIAVEL_VALORES`, `VL_OPCAO` obsoleto (`estrutura` e `ajustes/2026-11-20-adequar-cd-opcao.sql`). |
| 1.3 | 20/11/2026 | M-03 (número do processo), M-01 (b) (prazo da etapa) e M-13 (prazo do parecer) decididos e escritos nos scripts oficiais e em `ajustes/2026-11-20-adequar-numero-prazo.sql`; testes em `testes/testar-numero-prazo.sql`. |
| 1.3.1 | 20/11/2026 | M-06 (a) decidido: hierarquia por `GRUPOS.ID_GRUPO_SUPERIOR` opcional (no máximo um superior, sem ciclos, sem desativar grupo com subordinados ativos); `GRUPO_RELACOES` descartada, características de grupo como tags. M-06 (b) tags de sistema em discussão. |
| 1.3.2 | 20/11/2026 | M-06 (b): tags de sistema decididas (`departamento`, `lotacao`, `gestor`, `substituto`, `supervisor`); lotação única por pessoa define `PROCESSOS.ID_GRUPO_ORIGEM`. Diretriz: o modelo deve servir a qualquer tipo de empresa. `SN_RESTRITA` só como aviso de cuidado (sem controle de visibilidade na v1). |
