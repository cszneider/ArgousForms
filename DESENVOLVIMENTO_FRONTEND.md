# ArgousForms — Desenvolvimento do frontend

## Escopo deste registro

Este documento reúne as definições e questões relacionadas ao frontend. Nenhuma tecnologia ou comportamento indicado como recomendação deve ser tratado como aprovado sem decisão expressa do gestor.

## Definições aprovadas

- O frontend será desenvolvido em React.
- Frontend e backend permanecerão claramente separados.
- A aplicação terá suporte a português, espanhol e inglês.
- O frontend utilizará uma API central do backend por meio de requisições `POST`.
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
- No autocadastro local, o perfil `PARTICIPANTE` é atribuído automaticamente. Após confirmar o e-mail, o usuário poderá fazer login sem aguardar liberação administrativa; a confirmação não cria sessão automaticamente.

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
