# ArgousForms — Desenvolvimento do frontend

## Escopo deste registro

Este documento reúne as definições e questões relacionadas ao frontend. Nenhuma tecnologia ou comportamento indicado como recomendação deve ser tratado como aprovado sem decisão expressa do gestor.

## Definições aprovadas

- O frontend será desenvolvido em React.
- Frontend e backend permanecerão claramente separados.
- A aplicação terá suporte a português, espanhol e inglês.
- O frontend utilizará uma API central do backend por meio de requisições `POST`.
- O menu principal das áreas da instituição e da plataforma pode ser recolhido no desktop para exibir somente ícones e ampliar a área dos programas. Os nomes permanecem disponíveis por dica e acessibilidade; a preferência fica no navegador. A navegação móvel continua exibindo os textos.
- A tela Documentos usa `LISTAR_PASTA` para navegação e `CRIAR_PASTA` para inclusão de subpastas por gestores nomeados. O envio usa `POST /upload-arquivo` com progresso, escolha de pasta, classificação, validade opcional e tratamento de conflito de nome. `VERIFICAR_MONGODB` informa a disponibilidade e o limite institucional; o botão de envio fica desabilitado quando o armazenamento não responde.
- Ao selecionar um arquivo, a tela consulta `CONSULTAR_ARQUIVO` e mostra os metadados. PDF e imagens PNG, JPEG, GIF e WebP são obtidos pelo endpoint autenticado `GET /arquivo-conteudo?modo=visualizar`; a interface indica o carregamento, e o PDF usa o visualizador nativo do navegador com uma mensagem visível acima dele enquanto a área puder permanecer em branco. O download usa `modo=baixar` conforme o papel e o acesso efetivo. Título, descrição e classificação podem ser editados por gestor da pasta ou usuário autorizado com `EDITOR_DE_DOCUMENTOS`; somente o gestor altera a validade. O MIME é exibido sem opção de alteração.
- O sistema permitirá criar modelos, preencher partes de formulários, acompanhar documentos, interagir com workflows, participar de fóruns e assinar documentos.
- Cada responsável editará somente o subconjunto de campos atribuído a ele.
- Convidados poderão visualizar o documento e participar do fórum sem editar partes do formulário, conforme suas permissões.

## Áreas funcionais previstas

### Protocolos — primeira interface ligada ao banco

- A área **Protocolos** está separada do antigo protótipo **Modelos**. Lista os Protocolos criados pelo usuário, permite criar um Protocolo com título e descrição, editar esses dados e abrir sua central de trabalho. A lista usa `LISTAR_PROTOCOLOS`; ao abrir um item, consulta `CONSULTAR_PROTOCOLO` para obter o rascunho completo.
- A central apresenta Variáveis, Formulários, Fluxo, Modelos de documentos e a pasta relacionada. Protocolo, variáveis, formulários, seus campos e a pasta são persistidos pelas operações do backend. O editor de formulário organiza as variáveis em uma coluna, com acesso, obrigatoriedade, apresentação e ordem. A pasta associada exibe seu nome e, abaixo, o caminho completo. A seção Modelos de documentos permite criar, listar, editar título e observações, visualizar o PDF de origem e excluir modelos PDF ainda não publicados; o envio e o cadastro ocorrem numa requisição única, que cria automaticamente a subpasta `MODELOS` sob a pasta associada. O editor de PDF permite posicionar uma variável por seleção, mover e redimensionar cada campo e salvar as posições. Ao reabrir o modelo, os campos gravados reaparecem; o fechamento avisa se houver alterações não salvas. O DDL e o JAR usam o mesmo nome de tabela. O fluxo tem um primeiro protótipo visual sem persistência; o editor HTML/CSS, a persistência do fluxo e a publicação ainda aguardam implementação.
- A edição de variável textual permite configurar limites de tamanho, máscara, preenchimento com zeros à esquerda e regex, inclusive escolhendo uma expressão pronta como ponto de partida. Essas regras são da versão da variável e são enviadas em `definicao.texto`; a edição do formulário mantém apenas acesso, obrigatoriedade, apresentação e ordem. A aplicação da máscara ao preencher um Processo será implementada com o executor dos formulários.
- A edição de qualquer variável termina com o campo opcional `Valor exemplo`, gravado em `definicao.valorExemplo`. Ao sair desse campo e ao salvar, a interface normaliza e valida exemplos textuais pela definição da variável; o backend repete a operação. No posicionamento de campos, `Pré-visualizar PDF` gera no navegador uma cópia temporária do PDF de origem com os exemplos formatados nas posições atuais, inclusive alterações ainda não salvas; sem exemplo, desenha o código técnico. A janela permite percorrer todo o PDF. A cópia é descartada ao fechar e não altera o arquivo de origem.
- O editor de campos PDF permite selecionar vários campos da página atual, alinhá-los pelo topo, base, esquerda, centro horizontal ou direita usando o primeiro selecionado como referência e aplicar fonte, cor, tamanho, negrito, itálico e sublinhado aos selecionados. A referência aparece destacada. Setas do teclado e botões movem o grupo um ponto de PDF por acionamento, sem mudar as distâncias entre campos nem ultrapassar a página. A prévia temporária usa essas opções e acusa valores que não cabem nos limites do campo. A apresentação de cada campo é enviada em `apresentacao` e reaparece ao reabrir o modelo.
- Os rascunhos anteriores do `localStorage` não são migrados para o banco, conforme decisão do gestor. A área atual não utiliza o armazenamento local para Protocolos.
- O acesso visual inicial aceita `CRIADOR_DE_PROTOCOLOS` e, temporariamente, `MODELADOR` para permitir avaliação com os perfis atuais. Essa compatibilidade local não é autorização de backend nem substitui a futura atribuição dos novos papéis.
- **Excluir Protocolo** remove o rascunho e suas variáveis e formulários no banco, em transação, somente quando não houver Processo iniciado. Nesta fase, a operação aceita somente Protocolos ainda não publicados e sem etapas; Protocolos publicados ou com fluxo dependem da implementação das respectivas estruturas. A pasta associada é preservada.

### Acesso e instalação

- Assistente de instalação inicial.
- Login local.
- Login Argous.
- Login Google.
- Login Microsoft.
- Seleção ou vinculação de origem de identidade quando necessário.
- No autocadastro local, `ESSENCIAL` e `PARTICIPANTE` são atribuídos automaticamente. Após confirmar o e-mail, o usuário poderá fazer login sem aguardar liberação administrativa; a confirmação não cria sessão automaticamente.
- O formulário de login local chama `ENTRAR_LOCAL` no resolver e abre `/app` para qualquer usuário autenticado; a tela valida `SESSAO_ATUAL` antes de carregar. A resposta inclui papéis efetivos para a navegação e perfis ativos para exibição. A tela Documentos consulta a navegação real de pastas e arquivos; as demais visualizações documentais de demonstração ainda usam dados locais. Grupos, tags e seus vínculos na área de organização usam o banco e exigem `GESTOR_GRUPOS_TAGS` no backend.
- Visão geral é universal e mostra conteúdo conforme os papéis. Não há painel separado de Minhas pendências; elas integram a Visão geral quando aplicáveis. Documentos exige `CONSULTA_DOCUMENTOS` e as permissões do documento. "Novo Documento" exige `EDITOR_DE_DOCUMENTOS` e elegibilidade na etapa INÍCIO; preencher exige o mesmo papel e atribuição da etapa. O menu pessoal exige `AUTOGESTAO` e exibe primeiro nome e resumo dos perfis. Dashboards corresponde a `ANALISTA_INDICADORES`, Modelos a `MODELADOR`. Organização e acessos tem navegação interna por `GESTOR_GRUPOS_TAGS` (Grupos e tags), `GESTOR_ACESSOS` (Papéis e perfis) e `ADMINISTRADOR_USUARIOS` (Usuários e pessoas). A área de Grupos e tags lista registros reais e oferece criação de grupo e tag, sem vincular usuários ou atribuir tags nesta etapa. A criação de tag apresenta três caixas independentes para habilitar seu uso em grupos, usuários e vínculos; pelo menos uma deve ser selecionada. A área de Papéis e perfis lista registros reais e permite editar ou remover papéis existentes, criar e editar perfis e definir seus papéis. A remoção exclui ou inativa conforme o uso histórico. Registros padrão só permitem editar nome e descrição. Usuários e pessoas já têm listagem do banco; a edição ainda depende da definição dos campos e vínculos.
- Na lista de tags, a ação **Editar tag** permite alterar descrição, aplicações e situação ativa. O código permanece visível e bloqueado para edição; o backend rejeita a remoção de uma aplicação que já possua vínculos.
- A área de Papéis e perfis não apresenta “Criar papel” enquanto não existir cadastro das permissões associadas a cada papel. A listagem e a edição dos papéis existentes permanecem; criar perfis com os papéis atuais continua disponível.
- O menu pessoal de `AUTOGESTAO` oferece dados cadastrais, troca de senha local, conexões ativas e saída. Conexões ativas consulta o banco para a própria conta, destaca a sessão atual e permite encerrar cada sessão após confirmação; encerrar a atual volta ao login. Tokens não são exibidos. Na criação e na troca de senha, o formulário mostra os critérios e a força da senha; login e retomada não avaliam uma senha já existente. A área de Usuários e pessoas consulta registros reais do banco para `ADMINISTRADOR_USUARIOS`; Pessoas lista somente registros sem conta ativa, inclusive quando a conta anterior foi excluída logicamente. Inclusão e edição de Pessoa/Usuário usam o cadastro real e exibem os campos da Pessoa e do Usuário no mesmo formulário. O convite é aceito na página `/convite`, com código enviado por e-mail. Na autogestão, sessões reais alteram o banco; a tela de demonstração continua com armazenamento local.
- Na edição de grupo, a interface apresenta o estado ativo e as tags habilitadas para grupos. Tags inativas já vinculadas permanecem visíveis para que possam ser retiradas, mas não podem ser adicionadas novamente enquanto inativas. A lista de grupos mostra os vínculos ativos.
- A área de Grupos e tags permite pesquisar grupos, tags, usuários e pessoas. A lista de usuários da organização abre a manutenção de participação em grupos, tags de usuário e tags de vínculo, com persistência imediata a cada seleção. A retirada de uma participação desativa as tags daquele vínculo.
- Em Usuários e Pessoas, a remoção de usuário exige confirmação e preserva a Pessoa; a ação não é oferecida para a própria conta. A remoção de Pessoa é oferecida somente quando não há conta histórica. As duas listas mantêm busca por nome e e-mail.
- Melhoria de UX pendente na edição de usuários: a seção **Perfis do usuário** fica abaixo dos demais dados e exige rolagem para ser descoberta. O desenvolvedor da interface deverá tornar a atribuição de perfis facilmente localizável, especialmente para quem abre a manutenção com esse objetivo; avaliar seções ou abas com navegação visível e indicação dos perfis atuais, preservando o formulário unificado de Pessoa e Usuário.
- A remoção de Grupos e Tags consulta referências em protocolos e permissões documentais: registros referenciados são inativados; os demais são excluídos com seus vínculos. A interface confirma a operação e exibe o resultado.

### Modelagem

- Editor de Protocolos, com formulários pertencentes ao Protocolo; copiar um formulário de outro Protocolo cria uma definição independente.
- O Criador poderá definir variáveis do Protocolo numa área inicial ou durante a criação dos formulários. Em cada formulário, escolherá quais variáveis aparecem e se cada uma é somente leitura ou leitura e escrita; a mesma variável poderá aparecer em vários formulários com modos diferentes.
- Definição de seções e campos.
- Definição de validações e regras condicionais.
- Associação dos campos às partes e responsabilidades.
- Editor da apresentação dos documentos que o Protocolo poderá produzir, sem pressupor um documento principal.
- Editor visual do fluxo, com canvas predominantemente horizontal, paleta à direita, ligações diretas ou com blocos de decisão, divisões e convergências. O círculo “I” marca visualmente o início; etapas não têm tipo `I/O/F`. Duplo clique no bloco abre uma janela com abas para dados gerais, destinatários, documentos e scripts, com prévia do formulário e miniatura do PDF selecionado. As saídas são configuradas pelas ligações no canvas.
- O editor visual usa React Flow. O canvas de um novo fluxo inicia com o marcador de início ligado à primeira etapa e ao ponto final; o Criador pode acrescentar blocos e ligações. O botão **Salvar fluxo** grava etapas, destinatários, ligações diretas e modelos marcados para geração automática numa única operação. Ao reabrir o Protocolo, o editor carrega o fluxo salvo. O modo expandido ocupa a janela e oculta temporariamente a navegação do Protocolo. A visão estratégica BPMN e a exportação interoperável permanecem evoluções futuras separadas da edição operacional.
- Cada etapa possui um formulário e salva sua posição `X`/`Y` no canvas; o mesmo formulário poderá ser selecionado em várias etapas da versão do Protocolo.
- O percurso publicado deverá ter uma única etapa ligada ao início e ao menos uma saída para um ponto final. Uma única etapa pode ligar início e fim.
- Ao configurar os destinatários de uma etapa no editor do fluxo, consultar `INSTITUICAO.SN_PERMITIR_DESTINATARIOS_UNICOS`. Com `FALSE`, avisar que a etapa precisa de ao menos uma regra que não dependa exclusivamente de um usuário nominal antes da publicação; usuários nominais podem ser alternativas. O backend confirmará essa regra na publicação.
- Versionamento, revisão e publicação de Protocolos. A atualização dos nomes e papéis das telas existentes ocorrerá durante a implementação, sem presumir que a interface atual já foi alterada.

### Execução documental

- Lista de documentos e tarefas atribuídas.
- Preenchimento da parte sob responsabilidade do usuário.
- Visualização das demais partes permitidas.
- Indicação do estado de cada parte.
- Salvamento parcial e salvamento completo.
- Finalização explícita.
- **Iniciar/Assumir etapa** é uma ação explícita; apenas abrir a tela não altera a situação. **Salvar rascunho** aceita dados incompletos; **Salvar etapa** valida o preenchimento sem encaminhar; **Finalizar etapa** valida e aciona o fluxo. O usuário pode preencher e finalizar sem passar obrigatoriamente pelos dois salvamentos anteriores. A interface só apresenta a etapa como finalizada após confirmação de sucesso do backend.
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
