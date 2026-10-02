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
- `npm run enviar`: valida, cria commit e publica branch no remoto `principal`, com PR via GitHub CLI. Exige autorização de publicação e autenticação válida. Não enviar segredos ou artefatos gerados; não fazer merge automático.
- Não editar `target/`, não conectar bases externas e não alterar backend por conveniência de implementação do frontend.

## Escopo dos ajustes de interface

- Solicitações gerais de interface devem ser aplicadas globalmente aos ambientes que compartilham o elemento. Restringir a um programa ou ambiente somente quando o usuário indicar explicitamente esse escopo. Preferir estilos e componentes compartilhados para manter o padrão.
