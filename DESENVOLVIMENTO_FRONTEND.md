# ArgousForms — Desenvolvimento do frontend

## Escopo deste registro

Este documento reúne as definições e questões relacionadas ao frontend. Nenhuma tecnologia ou comportamento indicado como recomendação deve ser tratado como aprovado sem decisão expressa do gestor.

## Definições aprovadas

- O frontend será desenvolvido em React.
- Frontend e backend permanecerão claramente separados.
- A aplicação terá suporte a português, espanhol e inglês.
- O frontend utilizará uma API central do backend por meio de requisições `POST`.
- A tela Documentos usa `LISTAR_PASTA` para navegação e `CRIAR_PASTA` para inclusão de subpastas por gestores nomeados. O envio usa `POST /upload-arquivo` com progresso, escolha de pasta, classificação, validade opcional e tratamento de conflito de nome. `VERIFICAR_MONGODB` informa a disponibilidade e o limite institucional; o botão de envio fica desabilitado quando o armazenamento não responde.
- Ao selecionar um arquivo, a tela consulta `CONSULTAR_ARQUIVO` e mostra os metadados. PDF e imagens PNG, JPEG, GIF e WebP são obtidos pelo endpoint autenticado `GET /arquivo-conteudo?modo=visualizar`; a interface indica o carregamento, e o PDF usa o visualizador nativo do navegador com uma mensagem visível acima dele enquanto a área puder permanecer em branco. O download usa `modo=baixar` conforme o papel e o acesso efetivo. Título, descrição e classificação podem ser editados por gestor da pasta ou usuário autorizado com `EDITOR_DE_DOCUMENTOS`; somente o gestor altera a validade. O MIME é exibido sem opção de alteração.
- O sistema permitirá criar modelos, preencher partes de formulários, acompanhar documentos, interagir com workflows, participar de fóruns e assinar documentos.
- Cada responsável editará somente o subconjunto de campos atribuído a ele.
- Convidados poderão visualizar o documento e participar do fórum sem editar partes do formulário, conforme suas permissões.

## Áreas funcionais previstas

### Acesso e instalação

- Assistente de instalação inicial.
- Login local.
- Login Argous.
- Login Google.
- Login Microsoft.
- Seleção ou vinculação de origem de identidade quando necessário.
- No autocadastro local, `ESSENCIAL` e `PARTICIPANTE` são atribuídos automaticamente. Após confirmar o e-mail, o usuário poderá fazer login sem aguardar liberação administrativa; a confirmação não cria sessão automaticamente.
- O formulário de login local chama `ENTRAR_LOCAL` no resolver e abre `/app` para qualquer usuário autenticado; a tela valida `SESSAO_ATUAL` antes de carregar. A resposta inclui papéis efetivos para a navegação e perfis ativos para exibição. A tela Documentos consulta a navegação real de pastas e arquivos; as demais visualizações documentais de demonstração ainda usam dados locais. Grupos e tags da área de organização usam o banco e exigem `GESTOR_GRUPOS_TAGS` no backend.
- Visão geral é universal e mostra conteúdo conforme os papéis. Não há painel separado de Minhas pendências; elas integram a Visão geral quando aplicáveis. Documentos exige `CONSULTA_DOCUMENTOS` e as permissões do documento. "Novo Documento" exige `EDITOR_DE_DOCUMENTOS` e elegibilidade na etapa INÍCIO; preencher exige o mesmo papel e atribuição da etapa. O menu pessoal exige `AUTOGESTAO` e exibe primeiro nome e resumo dos perfis. Dashboards corresponde a `ANALISTA_INDICADORES`, Modelos a `MODELADOR`. Organização e acessos tem navegação interna por `GESTOR_GRUPOS_TAGS` (Grupos e tags), `GESTOR_ACESSOS` (Papéis e perfis) e `ADMINISTRADOR_USUARIOS` (Usuários e pessoas). A área de Grupos e tags lista registros reais e oferece criação de grupo e tag, sem vincular usuários ou atribuir tags nesta etapa. A criação de tag apresenta três caixas independentes para habilitar seu uso em grupos, usuários e vínculos; pelo menos uma deve ser selecionada. A área de Papéis e perfis lista registros reais e permite editar ou remover papéis existentes, criar e editar perfis e definir seus papéis. A remoção exclui ou inativa conforme o uso histórico. Registros padrão só permitem editar nome e descrição. Usuários e pessoas já têm listagem do banco; a edição ainda depende da definição dos campos e vínculos.
- Na lista de tags, a ação **Editar tag** permite alterar descrição, aplicações e situação ativa. O código permanece visível e bloqueado para edição; o backend rejeita a remoção de uma aplicação que já possua vínculos.
- A área de Papéis e perfis não apresenta “Criar papel” enquanto não existir cadastro das permissões associadas a cada papel. A listagem e a edição dos papéis existentes permanecem; criar perfis com os papéis atuais continua disponível.
- O menu pessoal de `AUTOGESTAO` oferece dados cadastrais, troca de senha local, conexões ativas e saída. Conexões ativas consulta o banco para a própria conta, destaca a sessão atual e permite encerrar cada sessão após confirmação; encerrar a atual volta ao login. Tokens não são exibidos. Na criação e na troca de senha, o formulário mostra os critérios e a força da senha; login e retomada não avaliam uma senha já existente. A área de Usuários e pessoas consulta registros reais do banco para `ADMINISTRADOR_USUARIOS`; Pessoas lista somente registros sem conta ativa, inclusive quando a conta anterior foi excluída logicamente. Inclusão e edição de Pessoa/Usuário usam o cadastro real e exibem os campos da Pessoa e do Usuário no mesmo formulário. O convite é aceito na página `/convite`, com código enviado por e-mail. Na autogestão, sessões reais alteram o banco; a tela de demonstração continua com armazenamento local.
- Na edição de grupo, a interface apresenta o estado ativo e as tags habilitadas para grupos. Tags inativas já vinculadas permanecem visíveis para que possam ser retiradas, mas não podem ser adicionadas novamente enquanto inativas. A lista de grupos mostra os vínculos ativos.
- A remoção dos cadastros de Tags e Grupos será desenvolvida após a modelagem dos fluxos de modelos de documento. A interface deverá refletir a política de exclusão física quando nunca utilizados e inativação quando já utilizados; por enquanto, não há ação de remoção desses cadastros.

### Modelagem

- Editor de modelos de formulário.
- Definição de seções e campos.
- Definição de validações e regras condicionais.
- Associação dos campos às partes e responsabilidades.
- Editor do modelo visual do documento final.
- Editor de workflow com fases, transições, divisões e convergências.
- Versionamento, revisão e publicação dos modelos.

### Execução documental

- Lista de documentos e tarefas atribuídas.
- Preenchimento da parte sob responsabilidade do usuário.
- Visualização das demais partes permitidas.
- Indicação do estado de cada parte.
- Salvamento parcial e salvamento completo.
- Finalização explícita.
- Devolução a fase anterior quando autorizada.
- Histórico do documento.
- Visualização do PDF gerado.
- Fluxo de assinatura.

### Fórum

- Fórum exclusivo de cada instância documental.
- Participação de responsáveis e convidados.
- Separação visual e funcional entre comentário e conteúdo oficial do formulário.
- Controle de acesso conforme o convite e as permissões do participante.

## Estados que a interface deverá representar

- Pronto para iniciar o preenchimento.
- Preenchendo.
- Parcialmente salvo.
- Salvo.
- Finalizado.

A interface deverá distinguir claramente `Salvar` de `Finalizar`. Somente a finalização deve sinalizar a entrega da parte ao workflow.

Os gatilhos exatos desses estados ainda dependem de aprovação.

## Concorrência

O modelo inicial não prevê várias pessoas editando o mesmo campo. Usuários trabalharão paralelamente em partes diferentes.

### Recomendação pendente de aprovação

- Usar controle de versão otimista por parte do formulário.
- Enviar em cada gravação a versão conhecida pelo cliente.
- Exibir conflito quando a parte tiver sido modificada por outra sessão.
- Evitar que duas abas do mesmo responsável sobrescrevam alterações silenciosamente.

## Internacionalização

O frontend deverá separar:

- Textos da interface.
- Conteúdo traduzível dos modelos.
- Idioma da instância documental.
- Formatação de datas, números e moedas.
- Fuso horário do usuário e da instalação.

Ainda precisam ser definidos o idioma padrão, as regras de fallback e se todos os modelos serão obrigatoriamente traduzidos nos três idiomas.

## Segurança no frontend

- A interface não deve presumir que ocultar um botão garante autorização.
- Tokens e informações sensíveis não devem ser persistidos sem necessidade.
- O acesso de convidados deve deixar visível o seu escopo e a validade do convite.
- Notificações não devem revelar conteúdo documental sensível.
- Downloads e visualizações devem exigir autorização atual do backend.
- A finalização e a assinatura devem exigir confirmação explícita e mostrar qual versão está sendo submetida.
- O frontend não deve expor estruturas internas de persistência ou campos sensíveis retornados pelo backend.

## Recomendações técnicas ainda não aprovadas

- TypeScript para tipagem dos contratos e estados complexos.
- Vite como ferramenta de desenvolvimento e build.
- Mantine ou outra biblioteca de componentes consistente com os projetos de referência.
- Biblioteca específica de internacionalização.
- Biblioteca para diagramação visual do workflow.
- Atualizações em tempo real do fórum e dos estados por WebSocket ou mecanismo equivalente.
- Salvamento automático das partes em edição.

## Decisões pendentes específicas do frontend

- Ferramentas e versões do ecossistema React.
- Identidade visual e design system.
- Estrutura de navegação.
- Funcionamento do editor visual de formulários.
- Funcionamento do editor visual do documento final.
- Representação gráfica do workflow.
- Experiência de salvamento automático ou manual.
- Experiência de devolução e reabertura.
- Recursos iniciais do fórum.
- Acessibilidade mínima exigida.
- Estratégia de atualização em tempo real.
- Visualização e confirmação do PDF antes da assinatura.

# Validação de identificações pessoais

O módulo `src/programas/pessoas/regex-identificacao.js` verifica a sintaxe portátil de `CD_REGEX` e a correspondência integral do identificador. O formulário administrativo usa essa validação antes de enviar identificações; o backend também valida a regra ao gravar.
