# ArgousDocs — frontend do ArgousForms

## Governança e contexto

Este arquivo complementa o `../../AGENTS.md`, sem substituir suas regras. Antes de mudanças, ler `../../DECISOES_GERAIS.md` e `../../DESENVOLVIMENTO_FRONTEND.md`; para integração Java, ler também `../../DESENVOLVIMENTO_BACKEND.md`. Não consultar outros projetos sem autorização. Preservar alterações existentes e limitar o trabalho ao pedido do gestor. Propostas não são decisões aprovadas.

Este é o frontend principal, em `ArgousForms/frontend` dentro do repositório. O nome de apresentação atual é ArgousDocs. A antiga cópia do projeto é apenas backup e não deve receber alterações ou sincronização automática.

## Definições aprovadas nesta conversa

- Componentes e arquivos de implementação em `.js`, incluindo JSX. Não converter para TypeScript sem autorização.
- React, Material UI 9, temas claro/escuro e português padrão, inglês e espanhol.
- Execução local na porta 3002.
- Landing page, login e ferramenta separados. Seletor de idioma com bandeira e idioma; marca lateral sem ação.
- Planos Básico 39,90, Pro 59,90, Premium 89,90 e Empresarial 119,90; Premium destacado como mais usado. São apresentação comercial, sem cobrança implementada. Duração do período gratuito pendente.
- Editor de documentos com texto, imagens, cabeçalho e rodapé; importação de PDF e Word, com preferência por PDF para fidelidade visual.
- Marcações com nome, tipo e obrigatoriedade; campos independentes podem ter o mesmo tipo; responsabilidade por grupo ou usuário específico no protótipo.
- Salvamento parcial, histórico em fluxo, acompanhamento de gargalos e dashboards.
- Não repovoar documentos, modelos, grupos e pessoas fictícios removidos. Preservar os registros criados pelo usuário.
- Conta de teste da empresa é administradora de uma empresa, não da plataforma.
- Conta `adm@argous.com.br` administra a ferramenta em área própria: clientes, indicadores de acesso e controle de usuários.
- Aprovada uma primeira versão local dessa separação, usando o mecanismo de demonstração existente. Não registrar senhas neste documento.

## Estado técnico observado

- Consultar `package.json` e lockfile para versões efetivas. Atualmente React 19, Material UI 9, Vinext/Vite e TipTap.
- `src/app/`: rotas e layout; `/` landing, `/login`, `/app` empresa e `/plataforma` administração da ferramenta.
- `src/interface/`: telas; `src/programas/`: regras e operações; `src/components/`: componentes compartilhados; `src/css/`: estilos; `src/utils/`: utilitários e traduções.
- `src/programas/documentos/domain.js`: regras documentais; `storage.js`: armazenamento local e remoção pontual dos dados de exemplo; `seed.js`: estado inicial vazio, com administrador da empresa.
- `src/programas/editor/`: importação, edição e exportação documental. Os originais binários ficam no IndexedDB.
- `src/programas/plataforma/access.js`: sessões de demonstração, registros de login e ativação de participantes. A conta da plataforma não integra a lista de participantes da empresa.
- O workspace da empresa permanece em `argousdocs:workspace:v1`. Metadados administrativos locais ficam separados em `argousdocs:platform:v1`. Não apagar armazenamento para efetuar atualizações.
- A seleção de participantes é um recurso de simulação, não autenticação individual. Bloqueio local e proteção de rotas não constituem segurança de produção.
- Os indicadores representam logins bem-sucedidos neste navegador desde a implementação, não usuários online, tráfego global ou histórico anterior. A lista inicial contém somente a empresa de teste; não inventar clientes ou métricas.
- Os depoimentos da landing são exemplos ilustrativos, não avaliações verificadas.

## Limites e decisões pendentes

- O frontend continua um protótipo local, sem autenticação real nem integração com o backend Java. LocalStorage pode ser alterado pelo usuário.
- A área de plataforma aprovada não autoriza mudar o SaaS dedicado para banco compartilhado ou implementar provisionamento remoto. Contratos, isolamento, coleta de indicadores e permissões entre instalações precisam de definição própria.
- Autorização efetiva deverá ocorrer no backend para cada operação. Não usar a conta de demonstração ou suas credenciais em produção.
- A distinção futura entre modelos de formulário e documento, fórum, assinaturas avançadas, versionamento e concorrência deve seguir os documentos gerais. Não tratar todos os recursos previstos como já implementados.
- Há diferenças entre o protótipo e documentos anteriores (ferramentas frontend, responsabilidade por grupo versus responsável individual). Preservar o funcionamento aprovado; explicitar e submeter conciliações ao gestor, sem reescrever as decisões gerais implicitamente.
- Imagens de assinatura no editor não equivalem a assinatura eletrônica avançada. OpenTimestamps continua pendente.

## Verificação e entrega

- `npm run dev`: desenvolvimento; `npm run build`: build; `npm start`: execução do build; porta 3002.
- `npm test`: testes Node em `tests/`. Executar validações proporcionais às alterações e relatar resultados reais.
- Não adicionar dependências sem justificar e obter autorização.
- `npm run enviar`: valida, cria commit e publica branch no remoto `principal`, com PR via GitHub CLI. Por reunir essas ações, só executar após aprovação explícita do commit concreto e autorização para push e abertura de PR, com autenticação válida. Um pedido genérico de envio não dispensa a apresentação prévia do commit para aprovação. Não enviar segredos ou artefatos gerados; não fazer merge automático.
- Não editar `target/`, não conectar bases externas e não alterar backend por conveniência de implementação do frontend.

## Governança Git — aprovação individual de commits

- A autorização para implementar uma atividade não autoriza criar commits, publicar alterações ou fazer merge. Cada commit exige autorização explícita do gestor, inclusive commits locais e alterações de commits existentes (`--amend`).
- Antes de alterar arquivos, verificar a branch atual, o `git status` e as diferenças existentes. Preservar alterações do gestor, arquivos não rastreados e conteúdo já preparado no índice; não incluí-los automaticamente na atividade.
- Para atividades autorizadas, preferir branches `codex/<descricao>`. Não criar ou trocar branches por causa desta regra sem autorização para a atividade correspondente; não alterar diretamente a branch principal sem autorização específica.
- Antes de solicitar aprovação de um commit, concluir a implementação e as verificações proporcionais, revisar o diff e apresentar a branch, os arquivos e alterações que entrarão no commit, a mensagem proposta em português e os resultados das validações, incluindo falhas ou verificações não realizadas.
- Após aprovação, adicionar somente os arquivos ou trechos aprovados, usando caminhos explícitos e conferindo o diff do índice. Não usar `git add .` ou incluir alterações alheias ao escopo. Se o conteúdo aprovado mudar materialmente, apresentar a mudança e obter nova aprovação antes do commit.
- Push e abertura de PR exigem autorização explícita própria; podem ser aprovados junto com o commit quando o gestor identificar claramente as ações. Aprovação de um commit local não autoriza publicação.
- Merge permanece sob decisão do gestor. Não fazer merge automático nem considerar a abertura de PR como autorização para merge.
- Não executar descarte de alterações, `reset --hard`, `git clean`, exclusão de branches, force push ou reescrita de histórico sem autorização específica para a operação e seu alcance.
- Não versionar senhas, tokens, chaves privadas, credenciais reais, dependências instaladas ou artefatos gerados. Revisar os arquivos destinados ao commit sem expor valores sensíveis na conversa ou nos logs.
- Na entrega, informar a branch, as alterações e validações; quando houver commit autorizado, informar seu hash e mensagem, e quando houver publicação autorizada, informar o remoto e o link do PR. Não afirmar que houve commit ou publicação sem confirmação da operação.

## Escopo dos ajustes de interface

- Solicitações gerais de interface devem ser aplicadas globalmente aos ambientes que compartilham o elemento. Restringir a um programa ou ambiente somente quando o usuário indicar explicitamente esse escopo. Preferir estilos e componentes compartilhados para manter o padrão.

## Documentação do frontend

- O projeto mantém o `AGENTS.md` como arquivo de orientação, sem base de conhecimento visual, galeria de componentes ou simulações de documentação na interface.

### Padrão aprovado para TextField

- Todos os `TextField` usam `variant="outlined"`, `size="medium"` e `fullWidth`, em todos os ambientes da interface.
- O tema compartilhado define esses valores em `MuiTextField.defaultProps`.

### Arquitetura aprovada para telas com contexto e dispatch

- Telas com estado compartilhado, navegação interna ou filhos específicos seguem o padrão funcional: contexto exportado no arquivo principal, `initialState` com `useMemo`, `initialStateRef` com `useRef`, estado com `useReducer` e `contextValues` com `useMemo`.
- O reducer recebe `dispatch({ field, value })`, incluindo função em `value` calculada a partir do valor anterior do campo. Atualizações de objetos e listas devem preservar os demais valores sem mutação.
- O Provider fica na raiz visual do componente principal. Filhos específicos consomem `useContext`; não repassar por props estado e ações já disponíveis nesse contexto. Componentes genéricos reutilizáveis podem continuar recebendo props e mantendo estado local quando apropriado.
- O contexto expõe `telaAtual`, `loading`, `value`, `dispatch` e `initialStateRef`. A navegação e as ações da tela devem manter uma única fonte de estado. Memoizações devem declarar todas as dependências utilizadas.
- Não importar o componente Programa, serviços ou dependências do projeto de referência para o ArgousDocs. Aqui, o Provider envolve a estrutura visual existente em Material UI.
- A migração autorizada está aplicada às telas com estado: login, configurações do usuário, administração da plataforma, lista e detalhes de usuários, workspace da empresa, editor de modelos, documento e dashboards.
- `src/utils/page-state.js` contém o reducer compartilhado das telas. Ele preserva a referência do estado quando o campo não muda (`Object.is`), inclusive para notificações repetidas de edição; funções em `value` devem ser puras, sem gravações ou outros efeitos.
- `WorkspaceContext` fornece as operações documentais ao editor, documento e dashboards. `TemplateEditorContext` também controla a edição visual em `ModelDesigner`; `DocumentViewContext` controla a seleção, o relógio e a análise de `ProcessFlow`, `TimingSummary` e `TimingComparison`. `PlatformContext` fornece navegação e atualização administrativa; `PlatformUsersContext` fornece o usuário selecionado aos detalhes.
- Componentes sem estado, como a landing, não precisam de contexto artificial. Calendário, editor de texto, visualizador de PDF, componentes de UI e provedores globais de tema/idioma mantêm seu estado independente quando reutilizáveis, conforme a exceção aprovada acima.
- O estado inicial é usado somente na montagem. Trocas de documento, pessoa ou etapa continuam utilizando as chaves existentes; reinicializações durante a navegação devem usar ações explícitas, sem apagar armazenamento.
