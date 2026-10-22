# ArgousForms — Desenvolvimento do backend

## Escopo deste registro

Este documento reúne as definições e questões relacionadas ao backend. Recomendações e alternativas permanecem pendentes até aprovação expressa do gestor.

## Definições aprovadas

- O backend será desenvolvido em Java.
- Frontend e backend permanecerão claramente separados.
- A comunicação principal será feita por um endpoint central que aceitará requisições `POST`.
- PostgreSQL armazenará dados relacionais e transacionais.
- MongoDB armazenará documentos e estruturas documentais dinâmicas.
- Redis será utilizado para cache e dados efêmeros.
- Cada cliente terá sua própria instalação SaaS dedicada.
- A instalação inicial criará instituição, primeiro administrador, perfis e origens de autenticação em uma única transação.
- O documento final será PDF.
- Haverá autenticação local, Argous, Google e Microsoft.
- Senhas locais usarão PBKDF2-HMAC-SHA-256.
- Somente o hash SHA-256 do bearer de sessão será armazenado.
- O login local exige senha válida e vínculo de origem com e-mail confirmado. A sessão inicial vale sete dias, usa cookie `HttpOnly` e persiste apenas o hash SHA-256 do segredo em `Cadastro.HISTORICO_LOGINS`. A consulta da sessão e o encerramento estão disponíveis pelo resolver; os demais métodos de login e a autorização dos módulos ainda não foram integrados.
- As respostas de login local e consulta da sessão informam os papéis efetivos por vínculos vigentes com perfis e papéis ativos. O frontend usa `EDITOR_DE_DOCUMENTOS` para encaminhar à interface documental provisória; essa informação não substitui a autorização por operação, documento e etapa no backend.

## Responsabilidades principais

- Instalação e configuração inicial.
- Autenticação, identidades externas e sessões.
- Usuários, grupos, perfis, papéis e permissões.
- Modelos e versões de formulários.
- Modelos e versões de documentos.
- Modelos e versões de workflow.
- Execuções documentais e tarefas.
- Controle de responsabilidade sobre partes do formulário.
- Persistência de conteúdo e histórico de versões.
- Fórum documental e convites.
- Geração e armazenamento de PDFs.
- Assinaturas e preservação de evidências.
- Auditoria.
- Integrações e notificações.

## Regras de negócio específicas com o Quatro

Regras de integridade que possam ser garantidas pelo PostgreSQL devem ser implementadas no banco, preferindo restrições declarativas e usando funções ou triggers quando necessário. O frontend deve repetir, sempre que possível, as verificações relevantes durante a interação, para dar retorno antes da gravação; essa antecipação não substitui a proteção do banco. A API e as classes de negócio podem validar previamente quando isso melhorar o fluxo ou a mensagem de erro e devem tratar as rejeições do banco.

Os scripts de estrutura e regras do banco serão mantidos em `ArgousForms/banco/`. Futuras instalações em produção precisarão de um mecanismo para aplicar alterações versionadas automaticamente, sem recriar tabelas nem perder dados. A escolha e a implementação desse mecanismo permanecem pendentes.

Na modelagem em andamento do schema `Processos`, a integridade de `PROTOCOLO_VERSOES` deverá garantir um único rascunho por Protocolo, unicidade de `(ID_PROTOCOLO, NR_VERSAO)`, `NR_VERSAO = -1` no rascunho e positivo na publicação, coerência entre situação e dados de publicação, e imutabilidade da versão publicada e de suas definições dependentes. Definir as restrições declarativas e escrever as triggers apenas após o gestor concluir a modelagem e enviar o DDL completo.

`PROTOCOLO_ETAPAS` terá tipos `I` (inicial), `O` (operacional) e `F` (final), com exatamente uma inicial e ao menos uma final por versão publicada. Cada etapa terá exatamente um formulário, por `ID_FORMULARIO`, e guardará suas coordenadas `X` e `Y` no canvas. Um formulário poderá ser referenciado por várias etapas da mesma versão. Dois campos `TEXT` opcionais guardarão os scripts de inicialização e finalização da etapa. Os scripts usarão um subconjunto controlado de JavaScript com `if`/`else`, `for`, `while` e `switch` e funções do sistema como `get`, `set`, `sendEmail`, `writeOnForum` e `sendMessage`. O executor, o contrato das funções, o momento de execução e os limites de recursos ainda não foram definidos. A execução em serviço Node com retorno de resultados e lista de ações ao backend Java é uma possibilidade apreciada pelo gestor, ainda sem aprovação como arquitetura. O backend deverá validar e autorizar toda ação antes de aplicá-la, qualquer que seja o executor escolhido.

Na publicação de novas versões do Protocolo, consultar `INSTITUICAO.SN_PERMITIR_DESTINATARIOS_UNICOS` (valor inicial `TRUE`). Se estiver `FALSE`, cada etapa deverá possuir ao menos uma regra de destinatários não limitada exclusivamente a um usuário nominal. A validação não altera versões já publicadas nem Processos em andamento. A modelagem completa da tabela de destinatários ainda está em discussão.

Cada variável tem identidade, código, descrição e tipo estáveis em `PROTOCOLO_VARIAVEIS`, ligada ao Protocolo. `TP_DADO` é `CHAR(1)`, com os códigos `S` texto, `I` inteiro, `R` decimal, `M` moeda, `V` valor monetário, `B` booleano, `O` opção, `D` data, `H` hora e `T` data e hora. O tipo `T` representa um instante com fuso horário; o eventual armazenamento do nome do fuso original permanece pendente. `PROTOCOLO_VARIAVEL_VERSOES` guarda em `JSONB` os atributos flexíveis versionados, inclusive limites, valor padrão e opções fixas como pares chave/valor. Variáveis do tipo `O` armazenam a chave textual escolhida e exigem validação das opções. `PROTOCOLO_VERSAO_VARIAVEIS` fixa a versão de cada variável utilizada por uma versão do Protocolo, sem copiar as definições que não mudaram. Uma versão publicada do Protocolo e suas referências a versões de variáveis são imutáveis. Os valores preenchidos nos Processos serão gravados em tabelas relacionais para permitir consultas e agregações gerenciais; sua estrutura ainda será modelada. `VALOR_MONETARIO` será um valor lógico composto por código da moeda e quantia decimal. O formulário referencia as variáveis selecionadas e determina, para cada uma, acesso de leitura ou leitura e escrita. O valor corrente pertence ao Processo e as passagens anteriores permanecem no histórico. O backend deverá conferir a permissão definida no formulário antes de aceitar alterações. O tratamento de duas etapas paralelas que tentem alterar a mesma variável ainda será definido.

Ao criar o rascunho de uma nova versão do Protocolo, copiar o conjunto de variáveis da última versão publicada e apontar cada uma para sua versão mais recente. Variáveis retiradas da última versão publicada não retornam automaticamente; novas variáveis podem ser incluídas no rascunho. O vínculo poderá ser alterado durante a edição do rascunho, mas será congelado na publicação. A associação formulário–variável guarda apenas `ID_VARIAVEL`; variáveis usadas somente em scripts também devem integrar o vínculo da versão do Protocolo. A publicação deverá conferir que todas as variáveis referenciadas pertencem ao mesmo Protocolo, constam desse vínculo e são compatíveis com os formulários e scripts.

- Inclusões, alterações e exclusões passam pela classe `*Negocio` correspondente.
- Regras específicas da aplicação ficam na classe `*NegocioEspecifico`, usando o gancho apropriado do ciclo de persistência, como `antesDeInserir`, `depoisDeInserir`, `antesDeAlterar` ou `depoisDeAlterar`. A classe `*Negocio` gerada não deve ser editada para acrescentar essas regras.
- Se uma regra valer para mais de uma operação, os ganchos envolvidos devem chamar um método compartilhado que receba a entidade. Na confirmação de e-mail, `checaRegrasDeNegocio( ConfirmacaoEmail )` valida o hash antes da inclusão e da alteração.

## API central

O formato conceitual será:

```json
{
  "operacao": "NOME_DA_OPERACAO",
  "dados": {}
}
```

O ArgousForms deverá futuramente permitir que outros sistemas, como ERPs, utilizem suas funcionalidades de fluxo documental por API. Ao desenvolver serviços de domínio, considerar esse uso sem exigir a presença da interface React para executar a regra de negócio. As operações, os contratos e a forma de autenticar e autorizar sistemas externos serão definidos quando a integração for desenvolvida; não há implementação de integração aprovada nesta etapa.

### Recomendação pendente de aprovação

O endpoint central deve cuidar apenas de transporte, autenticação, validações gerais e despacho. Cada operação deverá ser implementada em um handler próprio ou em serviços separados por domínio, evitando um único resolver de grande porte.

Também deverão ser avaliados:

- Identificador de correlação.
- Idempotência em operações críticas.
- Paginação e filtros.
- Limites de payload.
- Upload e download fora do corpo JSON quando apropriado.
- Versionamento do contrato.
- Respostas de erro padronizadas.
- Rate limiting.
- Controle de versão otimista.

## Distribuição sugerida dos dados

### PostgreSQL

- Instituição e configuração da instalação.
- Usuários e identidades.
- Origens de autenticação.
- Sessões e histórico de login.
- Perfis, papéis, grupos e permissões.
- Metadados e versões publicadas dos modelos.
- Definições relacionais do workflow.
- Instâncias de processo, tarefas, atribuições e estados.
- Convites e participantes do fórum.
- Índices e metadados documentais.
- Assinaturas, evidências e auditoria.

### MongoDB

- Estruturas dinâmicas dos formulários.
- Conteúdo dos modelos de documento.
- Respostas preenchidas.
- Snapshots de partes do formulário.
- Representações intermediárias usadas para gerar o PDF.
- Conteúdo estruturado que não se adapte bem ao modelo relacional.

### Redis

- Cache.
- Dados temporários.
- Controle de concorrência de curta duração.
- Rate limiting.
- Presença e notificações em tempo real, se aprovadas.
- Coordenação de tarefas assíncronas, se apropriado.

Para a primeira fase da gestão de documentos, foi escolhido o GridFS do MongoDB para armazenar os arquivos enviados pelos usuários. Os metadados e as permissões permanecem no PostgreSQL. O driver síncrono oficial `org.mongodb:mongodb-driver-sync:5.13.0` foi aprovado. O endpoint `GET /arquivo-conteudo` transmite a versão atual após conferir sessão, papel e permissões no PostgreSQL. `CONSULTAR_ARQUIVO` e `SALVAR_ARQUIVO` expõem e alteram título, descrição, classificação e, apenas para gestores da pasta, validade; o MIME permanece fixo. A disponibilidade e a entrega de conteúdo devem ser verificadas na instalação pelo gestor.

O endpoint central oferece `LISTAR_PASTA`, `CRIAR_PASTA` e `VERIFICAR_MONGODB`. `LISTAR_PASTA` recebe opcionalmente `idPasta`; sem ele, consulta a RAIZ. A listagem aplica papel `CONSULTA_DOCUMENTOS`, permissões de pasta e de arquivo e nomeações de gestores. `CRIAR_PASTA` exige `GESTAO_DOCUMENTOS` e nomeação herdada na pasta pai. `VERIFICAR_MONGODB` responde disponibilidade e limite vigente de upload, sem expor credenciais. Essas operações dependem da carga inicial da RAIZ e das permissões.

A RAIZ é identificada por `ID_PASTA_PAI` nulo. O leitor de configuração do MongoDB usa `mongodb-uri` sem credenciais, `mongodb-banco`, `mongodb-banco-autenticacao`, `mongodb-usuario`, `mongodb-senha` e `mongodb-bucket` em `/WEB-INF/agforms.xml`. Usuário e senha são decodificados com `BDUtil.decodifica()`; os demais parâmetros são lidos diretamente.

O servlet `POST /upload-arquivo` recebe multipart, autentica a sessão e exige `EDITOR_DE_DOCUMENTOS` mais permissão de inclusão na pasta, dispensada apenas para gestores nomeados. Aplica o limite `INSTITUICAO.NR_TAMANHO_MAXIMO_ARQUIVO_BYTES`, calcula SHA-256, grava `ARQUIVOS` e `ARQUIVO_VERSOES` pelas classes de negócio e envia a versão ao GridFS com identificador igual ao UUID da versão. Em conflito de nome, o cliente escolhe novo arquivo com sufixo numerado ou nova versão; esta exige acesso ao arquivo e o mesmo MIME. Se o GridFS gravar mas os metadados falharem, o serviço confere o resultado da transação e remove a versão do GridFS quando a ausência no PostgreSQL é confirmada. Falhas de compensação ou resultado indeterminado são registrados com o UUID para reconciliação. A instalação não foi acessada nem testada contra MongoDB nesta etapa.

## Modelo de formulário e responsabilidade

Cada parte do formulário deverá possuir, no mínimo:

- Identificação da instância documental.
- Identificação da parte.
- Responsável vigente.
- Subconjunto de campos autorizado.
- Estado funcional.
- Versão para controle de concorrência.
- Datas de disponibilização, início, salvamento e finalização.
- Histórico de alterações e transferências.

Os estados definidos são:

1. Pronto para iniciar o preenchimento.
2. Preenchendo.
3. Parcialmente salvo.
4. Salvo.
5. Finalizado.

Os gatilhos e transições exatas ainda dependem de aprovação.

## Workflow

O workflow deverá suportar fases, transições, regras, divisões paralelas, convergências e devoluções autorizadas.

### Recomendações pendentes de aprovação

- Representar o workflow como grafo versionado.
- Tornar versões publicadas imutáveis.
- Fixar cada execução na versão publicada com que começou.
- Usar estados próprios por parte e calcular o estado agregado da fase.
- Avançar somente quando as condições de convergência forem atendidas.
- Configurar devolução por transição e preservar cada ciclo executado.
- Exigir justificativa quando configurado.
- Não apagar ou sobrescrever execuções anteriores.

## Fórum documental

- O fórum pertencerá a uma instância documental específica.
- Responsabilidade de preenchimento e participação no fórum serão independentes.
- Convidados poderão visualizar e comentar conforme permissões próprias.
- Acesso ao fórum não concede edição de campos.

### Segurança necessária

- Convites com identificação inequívoca, validade e revogação.
- Autorização aplicada no backend para cada leitura e escrita.
- Escopo de visualização por documento ou parte.
- Auditoria de convites, acessos e mensagens.
- Verificação de anexos.
- Proteção contra conteúdo ativo ou malicioso.
- Política de retenção e edição de mensagens.
- Notificações sem conteúdo sensível desnecessário.

## Geração e ciclo do PDF

Devem ser preservados separadamente:

- Modelo visual utilizado.
- Dados consolidados.
- PDF preliminar.
- PDF final.
- PDF assinado.
- Pacote de evidências.

Cada artefato deverá possuir identificação, versão, hash, data de geração e referências à instância documental, ao modelo e ao workflow.

Uma nova geração não deverá sobrescrever silenciosamente uma versão anterior. Alterações posteriores à assinatura deverão produzir uma nova versão e invalidar formalmente o fluxo anterior, sem modificar o PDF já assinado.

## Assinatura avançada

O mecanismo deverá combinar:

- Identificação do signatário.
- Autenticação com nível de confiança adequado.
- Manifestação explícita de vontade.
- Associação entre signatário e versão exata do documento.
- Detecção de qualquer modificação posterior.
- Preservação das evidências.
- Revogação ou cancelamento do meio de assinatura quando aplicável.

### OpenTimestamps — proposta em avaliação

O OpenTimestamps pode ser usado para ancorar o hash do PDF ou, preferencialmente, o hash de um manifesto que represente o PDF e as evidências da assinatura.

Ele não substitui identidade, autenticação, consentimento ou associação unívoca ao signatário. Também exige tratamento assíncrono, pois a prova pode permanecer pendente durante algumas horas até sua confirmação.

Caso aprovado, deverão existir estados próprios, como:

1. Carimbo solicitado.
2. Prova pendente.
3. Prova ancorada.
4. Prova verificada.
5. Falha ou necessidade de nova tentativa.

Deverão ser preservados o arquivo de prova, o hash carimbado, as informações de verificação e o vínculo com o documento. A adoção permanece pendente de aprovação.

## Autenticação e autorização

- Usuário interno independente da origem de login.
- Login local explícito.
- Login Argous explícito.
- Google e Microsoft por OpenID Connect Authorization Code, com `state`, `nonce` e PKCE.
- Possibilidade de associar mais de uma identidade ao mesmo usuário.
- Perfis e permissões separados das origens de autenticação.
- Sessões revogáveis e com validade definida.
- Histórico de login.
- DTOs próprios, sem exposição direta das entidades de persistência.
- O autocadastro local atribui os perfis ativos `ESSENCIAL` e `PARTICIPANTE` na mesma transação que inclui o usuário. Se qualquer um não estiver disponível, a inclusão falha sem deixar cadastro parcial.
- O vínculo de login local permanece sem e-mail verificado até a confirmação do código. A política de login permitirá acesso após essa confirmação, sem aprovação administrativa e sem autenticação automática na confirmação.
- `ESSENCIAL` combina `AUTOGESTAO` e `CONSULTA_DOCUMENTOS`; `PARTICIPANTE` combina `EDITOR_DE_DOCUMENTOS`; `ADMINISTRADOR` inclui `ADMINISTRADOR_USUARIOS`, `GESTOR_ACESSOS` e `GESTOR_GRUPOS_TAGS`. `MODELADOR` e `GESTOR` combinam, respectivamente, `MODELADOR` e `ANALISTA_INDICADORES`. Os papéis não têm hierarquia.
- `ENTRAR_LOCAL` e `SESSAO_ATUAL` retornam papéis efetivos e perfis ativos do usuário. A interface usa os papéis para a navegação e os perfis apenas para a identificação exibida. `LISTAR_ORGANIZACAO`, `SALVAR_GRUPO` e `CRIAR_TAG` consultam a sessão e exigem `GESTOR_GRUPOS_TAGS` no backend. `CRIAR_TAG` recebe três indicadores booleanos (`grupo`, `usuario`, `vinculo`), permite várias aplicações simultâneas e exige ao menos uma. A listagem devolve os três indicadores registrados. Escritas em `Cadastro.GRUPOS` e `Cadastro.TAGS` usam as classes `*Negocio` na transação da operação. A autorização das futuras operações de documentos, vínculos de usuários e pessoas continuará necessária no backend.
- `LISTAR_ACESSOS`, `SALVAR_PAPEL`, `SALVAR_PERFIL`, `REMOVER_PAPEL` e `REMOVER_PERFIL` exigem `GESTOR_ACESSOS` no resolver. A gravação usa classes `*Negocio` em uma única transação. O serviço preserva os códigos, protege os registros padrão e decide entre exclusão física e inativação com base nos vínculos históricos. `validar-papeis-perfis.sql` repete as proteções possíveis no banco e deve ser aplicado manualmente após a carga dos padrões. O catálogo e a atribuição de permissões aos papéis permanecem pendentes.
- Novas senhas no autocadastro e na operação `ALTERAR_SENHA` seguem `PoliticaSenha`: 8 a 1024 caracteres e pelo menos 3 de 4 categorias (maiúscula, minúscula, numeral, símbolo). A senha antiga continua aceita no login e na retomada do cadastro. `ALTERAR_SENHA` exige sessão local com `AUTOGESTAO`, verifica a senha atual, grava novo hash pela classe `UsuarioSistemaNegocio` e revoga as demais sessões na mesma transação; mantém a sessão em uso. `LISTAR_PESSOAS_USUARIOS` exige `ADMINISTRADOR_USUARIOS` e consulta apenas os registros não excluídos, sem expor hashes de senha.
- A listagem de Pessoas omite somente quem tem conta não excluída. Identificações pessoais são persistidas sem formatação; o gestor aplicou no banco um índice único de identificação por país e o incluirá na modelagem. `RegexIdentificacao` verifica a sintaxe portátil de `CD_REGEX` e a correspondência integral do identificador, com limite de 50 caracteres conforme a modelagem atual. `TipoIdentificacaoNegocioEspecifico` valida a expressão em inclusão e alteração; quando ela muda, verifica todas as identificações existentes do tipo e recusa uma expressão incompatível. `PessoaIdentificacaoNegocioEspecifico` aplica o formato ao inserir e alterar identificações. A execução depende de `CD_REGEX` também estar presente na tabela do banco. Ao reativar uma conta excluída, reutilizar seu `ID_USUARIO_SISTEMA`, invalidar senha e sessões anteriores e exigir novo convite com definição de senha e confirmação de e-mail. Nessa reativação, `ESSENCIAL` e `PARTICIPANTE` são atribuídos sem restaurar outros perfis; um vínculo revogado em `USUARIO_PERFIS` é reativado na linha antiga, respeitando a chave única por usuário e perfil.
- `SALVAR_PESSOA` grava Pessoa sem conta. `SALVAR_USUARIO` inclui ou edita conta e Pessoa vinculada numa transação; `SALVAR_MEUS_DADOS` limita a alteração à conta autenticada. Convites e mudanças de e-mail utilizam `CONFIRMACOES_EMAIL` com hash HMAC, código de oito dígitos, validade de dez minutos, até cinco tentativas e confirmação sem login automático. A emissão do e-mail ocorre após o commit; falha SMTP deixa a confirmação pendente. A mudança de endereço só atualiza `USUARIOS_SISTEMA`, `PESSOAS` e a origem local depois da confirmação.
- `LISTAR_CONEXOES_ATIVAS` exige sessão válida com `AUTOGESTAO` e devolve apenas conexões do próprio usuário que não foram revogadas nem expiraram. A resposta identifica a conexão atual e inclui início, validade, IP e agente do navegador, sem retornar bearer ou hash. `DT_ULTIMO_ACESSO` só terá valor quando houver atualização efetiva desse campo; a interface não o usa por enquanto.
- `ENCERRAR_CONEXAO` também exige `AUTOGESTAO`, confirma que a sessão de destino pertence ao usuário autenticado e grava sua revogação por `HistoricoLoginNegocio` em uma transação. Quando o destino é a sessão atual, o resolver remove o cookie e informa ao frontend para voltar ao login.
- `ALTERAR_TAG` exige o mesmo papel, mantém `CD_TAG` fixo e atualiza descrição, aplicações e situação ativa via `TagNegocio`. A operação consulta as três tabelas de vínculos antes de desmarcar qualquer aplicação. O script `ArgousForms/banco/validar-alteracao-tags.sql` reforça essas regras no banco quando executado pelo proprietário do esquema; não é aplicado automaticamente. As atribuições de tags a usuários e a vínculos ainda precisam de regras próprias.
- `SALVAR_GRUPO` atualiza nome, situação ativa e lista de tags na mesma transação. Apenas tags ativas e habilitadas para grupos podem ser vinculadas ou reativadas. A retirada desativa o vínculo em `GRUPO_TAGS`, preservando sua data de inclusão; uma seleção posterior reativa o mesmo registro. A atualização do vínculo usa `GrupoTagNegocioSeguro`, pois o persistor gerado usa `LIKE` em `CD_TAG` e poderia alcançar outros códigos que contivessem `_` ou `%`. O script de validação das tags também protege inserções e reativações de vínculos quando instalado.
- A futura operação de remover uma Tag ou um Grupo deverá consultar seu uso em fluxos de modelos de documento: sem uso, poderá excluir fisicamente o cadastro e seus vínculos; com uso, deverá apenas inativar o cadastro. Esse critério se aplica por analogia a outros cadastros com referências históricas. A modelagem dos fluxos e a operação de remoção ainda não existem; não inferir ausência de uso apenas pelas tabelas atuais de vínculos.
- A carga manual inicial está em `ArgousForms/banco/carga-manual-teste.sql`; `ArgousForms/perfis-papeis-iniciais.sql` é uma carga complementar alternativa. O banco de desenvolvimento já carregado deve usar `ArgousForms/banco/ajuste-papeis-perfis-2026-10-12.sql`. A instalação futura deverá inserir automaticamente os papéis, perfis e vínculos padrão. O login local existe; as permissões concretas dos papéis e a autorização dos módulos ainda precisam ser implementadas.

A necessidade de vínculo Argous deverá ser determinada pela funcionalidade ou pela configuração do cliente; não foi definido que todo usuário do ArgousForms dependerá desse vínculo.

## Auditoria

### Recomendação pendente de aprovação

Utilizar registros append-only para eventos relevantes:

- Criação e publicação de modelos.
- Início, salvamento, finalização e reabertura de partes.
- Transferência de responsabilidade.
- Transições e devoluções do workflow.
- Convites e revogações.
- Mensagens relevantes do fórum.
- Geração e invalidação de PDFs.
- Assinaturas e verificações.
- Alterações de permissões.

## Segurança obrigatória

- Validação do bearer e da sessão em todas as operações protegidas.
- Autorização por operação e por recurso.
- Menor privilégio.
- Proteção contra acesso horizontal a documentos de outros usuários.
- Segredos fora do código-fonte.
- TLS obrigatório.
- Hash e assinatura dos artefatos críticos.
- Validação de tipo, tamanho e conteúdo de uploads.
- Consultas parametrizadas.
- Proteção contra repetição de operações críticas.
- Logs sem senhas, tokens ou conteúdo documental sensível.
- Backup e restauração testados por instalação.
- Política de retenção e exclusão compatível com obrigações contratuais e legais.

## Decisões pendentes específicas do backend

- Versão do Java.
- Servidor Java e empacotamento.
- Framework ou uso direto de Servlet.
- Uso ou não da biblioteca Quatro.
- Versões e drivers de PostgreSQL, MongoDB e Redis.
- Modelo relacional inicial.
- Formato dos documentos armazenados no MongoDB.
- Armazenamento de PDFs e anexos.
- Motor de workflow: próprio ou biblioteca existente.
- Motor de geração de PDF.
- Fila e execução de tarefas assíncronas.
- Estratégia de notificações.
- Implementação da assinatura avançada.
- Aprovação ou rejeição do OpenTimestamps.
- Modelo inicial de perfis, papéis e permissões.
