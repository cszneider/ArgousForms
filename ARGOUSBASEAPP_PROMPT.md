# Prompt para iniciar o projeto ArgousBaseApp

Copie o texto abaixo para o novo projeto Codex, levando também os arquivos `ARGOUSBASEAPP_ESPECIFICACAO.md` e `ARGOUSBASEAPP_CADASTRO.sql`.

---

Sou o gestor deste projeto. Quero criar o **ArgousBaseApp**, um JAR Java de backend reutilizável por aplicações distintas. Ele deve concentrar a lógica comum de instituição, usuários, origens de autenticação, login local, confirmação por e-mail, sessões com validade móvel e absoluta, papéis, perfis, permissões e programas. Cada aplicação consumidora implementará sua interface e adaptará HTTP e e-mail aos serviços do JAR. Não copie automaticamente código de outro projeto nem assuma acesso a outro workspace.

Leia integralmente os dois arquivos fornecidos: `ARGOUSBASEAPP_ESPECIFICACAO.md` (regras e decisões ainda pendentes) e `ARGOUSBASEAPP_CADASTRO.sql` (DDL do modelo enviado). Trate o SQL como ponto de partida para uma **nova base**, nunca como migração a ser executada no ArgousForms. Não execute SQL em banco sem minha autorização específica. Não inclua segredos, senhas iniciais ou credenciais reais em código, documentação ou artefatos.

Primeira entrega: analise os dois arquivos, compare a cobertura do DDL com as funções pedidas e apresente uma lista curta e objetiva das decisões que preciso tomar antes da implementação. Destaque especialmente a ausência de `CONFIRMACOES_EMAIL`, a separação ou não de `PESSOAS`, a precedência de permissões diretas `C/N` em múltiplos perfis, a restrição `NR_DIAS_SESSAO_ABSOLUTA > NR_DIAS_SESSAO_MOVEL`, o tratamento de instantes em colunas `timestamp` sem fuso e os contratos de e-mail e autenticação externa. Indique o que é regra aprovada no ArgousForms, o que é particular dele e o que ainda é proposta. Não transforme pendências em decisões por conta própria.

Depois de eu fechar essas decisões, implemente por etapas, com minha autorização para cada etapa que altere modelo, autenticação, autorização ou infraestrutura:

1. Projeto Maven Java 21, empacotamento JAR, dependências mínimas justificadas e testes úteis. Organize uma API Java pública estável para aplicações consumidoras; se a biblioteca Quatro for adotada, respeite as classes de negócio geradas e transações externas, sem usar `*Persistor` diretamente nos serviços.
2. SQL de instalação do schema `Cadastro`, regras de integridade e cargas **configuráveis por aplicação**, incluindo instituição, primeiro administrador e origens numa transação. Não fixe os papéis próprios do ArgousForms como universais. Prepare evolução de esquema sem executar migração em produção.
3. Login local, política de senha, confirmação de e-mail, convite, autogestão, sessões persistentes com renovação diária no fuso institucional, limite absoluto, revogação individual e troca de senha com revogação das demais sessões. Teste limites de data, concorrência, transações e não reativação de sessão expirada.
4. Serviços de usuários, papéis, perfis, programas, permissões e instituição com autorização aplicada no backend. As origens externas só entram depois da aprovação dos respectivos contratos.
5. Documente os contratos que a aplicação consumidora deverá implementar: adaptador HTTP/cookie, transporte de e-mail, telas de login e administração, integração de provedores, configuração de segredos e implantação.

Antes de alterar arquivos, examine somente o workspace deste novo projeto e suas instruções. Explique decisões técnicas com impacto material e peça minha aprovação. Faça soluções definitivas, simples e testáveis; não crie remendos para contornar problemas de modelagem ou geração de classes. Preserve o trabalho existente e entregue evidências de build e testes executados. O resultado final deve ser um JAR reutilizável, o SQL de instalação e um guia de integração para novos projetos.
