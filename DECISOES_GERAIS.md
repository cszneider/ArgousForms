# ArgousForms — Decisões gerais do projeto

## Finalidade deste registro

Este documento consolida as definições gerais discutidas para o ArgousForms. Ele deve distinguir claramente decisões aprovadas, recomendações ainda não aprovadas e assuntos pendentes.

## Governança do projeto

- O usuário é o gestor do projeto e possui a decisão final sobre todas as escolhas funcionais, técnicas e arquiteturais.
- Recomendações, alternativas e análises apresentadas pelo assistente não constituem decisões automaticamente.
- Nenhum código-fonte ou documento deve ser criado ou alterado sem autorização explícita do gestor.
- Atividades que possam consumir quantidade significativa de tokens devem ter objetivo, escopo e resultado esperado apresentados previamente ao gestor e dependem de sua autorização.
- O papel do assistente é analisar requisitos, apresentar alternativas com vantagens, limitações, custos e riscos, alertar sobre segurança e manutenção e identificar decisões que dependem de aprovação.

## Princípio geral de desenvolvimento

- Aplicar KISS: preferir a solução mais simples que cumpra os requisitos aprovados, preservando segurança, integridade e clareza. Evitar complexidade sem necessidade concreta.

## Visão do produto

O ArgousForms será um sistema comercial no modelo SaaS dedicado a cada cliente. Permitirá criar modelos de formulários e documentos, preencher formulários de forma colaborativa, executar workflows, gerar documentos finais em PDF, gerenciar documentos e aplicar assinaturas eletrônicas.

O sistema será trilíngue, com suporte inicial a português, espanhol e inglês.

## Modelo de implantação

- O SaaS será dedicado: cada cliente terá sua própria instalação.
- Cada instalação terá isolamento próprio da aplicação e dos seus dados.
- A instalação inicial criará a instituição, o primeiro administrador, perfis iniciais e origens de autenticação em uma única transação.
- Um eventual sistema central de provisionamento e administração das instalações não faz parte, por enquanto, do núcleo definido.

## Arquitetura geral definida

- Frontend desenvolvido em React.
- Backend desenvolvido em Java.
- Frontend e backend devem permanecer claramente separados.
- A comunicação principal utilizará um endpoint central que receberá requisições `POST`.
- PostgreSQL será utilizado para dados relacionais e transacionais.
- MongoDB será utilizado para documentos e estruturas documentais dinâmicas.
- Redis será utilizado para cache e dados efêmeros.
- O documento final será gerado em PDF.

As versões do Java, React e demais bibliotecas, assim como o servidor de aplicação e as ferramentas de build, ainda não foram aprovadas.

## Conceitos documentais

Devem ser tratados como conceitos distintos:

- Modelo de formulário: campos, validações, seções, condições e traduções.
- Modelo de documento: composição visual que produzirá o documento final.
- Versão publicada: versão imutável de um modelo usada em novas execuções.
- Instância de processo: execução de um fluxo que reúne etapas, preenchimentos e documentos produzidos ao longo do percurso.
- Instância de formulário: dados preenchidos durante um processo.
- Documento final: PDF produzido a partir de um ou mais formulários.
- Anexos: arquivos adicionais associados à instância documental.

Um documento final poderá ser formado por vários formulários preenchidos por pessoas diferentes.

## Colaboração e divisão de responsabilidade

- Várias pessoas poderão interagir paralelamente com um documento em formação.
- Cada participante responsável editará apenas um subconjunto específico de campos.
- Uma parte específica do formulário terá sempre um único usuário responsável.
- A edição simultânea do mesmo campo por vários usuários não faz parte do modelo inicial.
- Pessoas poderão ser convidadas para acompanhar o documento e participar do fórum sem serem responsáveis por qualquer etapa.

## Grupos e tags da instituição

- Os usuários de uma instituição poderão ser organizados em grupos, sem hierarquia entre os grupos.
- Os grupos poderão representar departamentos, comitês, equipes de apoio e outras formas de organização da instituição.
- As tags serão transversais aos grupos: vários grupos poderão receber a mesma tag, e cada grupo poderá receber várias tags.
- Haverá três categorias distintas: **Tag de Grupo**, atribuída ao grupo; **Tag de Usuário**, atribuída ao usuário; e **Tag de Vínculo**, atribuída à participação de um usuário em um grupo.
- Um mesmo usuário dentro de um grupo poderá receber várias Tags de Vínculo. Por exemplo, uma Tag de Vínculo poderá indicar "gestor" ou "coordenador" naquele grupo.
- Grupos e tags não têm relação com papéis e perfis. No fluxo, poderão selecionar os destinatários das etapas; outros usos serão detalhados posteriormente.

## Perfis, papéis e permissões

- Permissões representam ações concretas; papéis reúnem permissões de uma responsabilidade; perfis combinam papéis e são atribuídos aos usuários.
- A organização abaixo é uma abordagem inicial e poderá ser ajustada conforme o funcionamento do sistema for detalhado.
- Os papéis padrão já considerados para a instalação são `INSTALADOR`, restrito às atividades iniciais, `ADMINISTRADOR_USUARIOS`, para liberação de usuários e atribuição de acessos, e `GESTOR_ACESSOS`, para administração de papéis, perfis e permissões.
- Para a operação documental, os papéis iniciais são `INICIADOR_PROCESSOS`, `EXECUTOR_ETAPAS`, `MODELADOR` de documentos e fluxos, e `ANALISTA_INDICADORES` para consulta autorizada de dashboards e estatísticas.
- Como possibilidades futuras, a serem detalhadas apenas quando suas operações estiverem claras, foram identificados **Publicador de modelos**, **Gestor de processos**, **Auditor** e **Gestor documental**.
- O perfil padrão `ADMINISTRADOR` reúne os papéis `ADMINISTRADOR_USUARIOS` e `GESTOR_ACESSOS`. O papel `INSTALADOR` não integra esse perfil permanente.
- O perfil padrão `PARTICIPANTE` reúne `INICIADOR_PROCESSOS` e `EXECUTOR_ETAPAS`. O perfil complementar `MODELADOR` reúne o papel de mesmo código. O perfil complementar `GESTOR` reúne `ANALISTA_INDICADORES`.
- Todo novo usuário cadastrado pela página pública receberá `PARTICIPANTE` na mesma transação de inclusão. A confirmação do e-mail continua obrigatória antes do login; não haverá aprovação administrativa para liberar o cadastro. Um administrador poderá atribuir `MODELADOR` ou `GESTOR` posteriormente.
- Novos papéis e perfis poderão ser criados pela instituição no futuro. Os papéis e perfis padrão serão incluídos automaticamente em cada instalação; a carga inicial atual é manual.
- A definição das permissões concretas de cada papel e a implementação do login permanecem etapas separadas.
- Ser elegível por grupo ou tag não concede, por si só, todas as permissões de execução. A autorização também considerará as permissões do usuário e a responsabilidade pela etapa ou pelo documento.
- Não haverá um papel genérico de assinador. Os signatários serão definidos pelas regras de cada documento e poderão ser usuários do sistema ou pessoas externas a ele.

## Estados das partes do formulário

Os estados funcionais inicialmente definidos são:

1. Pronto para iniciar o preenchimento.
2. Preenchendo.
3. Parcialmente salvo.
4. Salvo.
5. Finalizado.

Uma etapa finalizada poderá ser reaberta por uma devolução posterior. Os valores da conclusão anterior permanecerão imutáveis no histórico. A reabertura iniciará uma nova versão dos valores; o responsável poderá solicitar a cópia dos valores anteriores para alterar apenas o necessário. Se o fluxo voltar a percorrer a mesma etapa, esse comportamento se repetirá.

Ainda depende de aprovação a definição operacional exata dos gatilhos de cada estado, especialmente a distinção entre `Preenchendo` e `Parcialmente salvo` caso exista salvamento automático.

## Workflow

O processo será representado visualmente como um fluxo, tendo o n8n apenas como referência de representação. Cada fluxo terá um ponto inicial, etapas intermediárias e um ou mais pontos finais. Os caminhos poderão ser contínuos, condicionais ou de devolução; cada ponto final poderá produzir um documento específico.

As regras definidas para a execução são:

- Cada modelo de documento definirá os grupos cujos integrantes poderão iniciar o fluxo.
- Cada etapa de trabalho será direcionada a um ou mais grupos, com ou sem filtros por tags. A seleção poderá considerar Tag de Grupo, Tag de Usuário e Tag de Vínculo.
- As tags e participações serão avaliadas na finalização da etapa anterior, quando se determina o destino da próxima etapa.
- Uma pessoa elegível assumirá a responsabilidade vigente pela etapa e poderá salvar preenchimentos provisórios ou finalizá-la. Apenas a finalização encaminhará o fluxo.
- O responsável poderá transferir uma etapa parcialmente preenchida a outra pessoa ou redisponibilizá-la ao grupo elegível para que outra pessoa continue o trabalho.
- Cada etapa terá variáveis a preencher. Seus valores poderão alimentar documentos intermediários ou finais e determinar o próximo caminho por meio de condições.
- Ao retornar a uma etapa, o percurso e os valores anteriores serão preservados como histórico, e o novo preenchimento ocorrerá em outra versão.
- O fluxo poderá ter divisões paralelas e convergências, conforme as regras de responsabilidade e passagem a definir.

Uma visualização em kanban poderá apoiar o acompanhamento das etapas e responsabilidades; sua forma de apresentação ainda não está definida.

### Recomendações pendentes de aprovação

- Tratar o workflow como um grafo versionado.
- Manter versões publicadas imutáveis.
- Vincular cada execução à versão do fluxo com a qual foi iniciada.
- Permitir avanço somente quando as partes obrigatórias estiverem finalizadas.
- Configurar a devolução por transição, incluindo destino, autorizados, justificativa e partes reabertas.
- Invalidar formalmente documentos posteriores quando uma devolução afetar conteúdo já consolidado.

Ainda é preciso definir os efeitos de uma reabertura sobre decisões e documentos produzidos depois da etapa reaberta, bem como as regras exatas de divisão e convergência dos caminhos paralelos.

## Fórum documental

- Cada documento em formação terá um fórum exclusivo.
- O fórum permitirá interação entre responsáveis e convidados.
- Participar do fórum não concede automaticamente permissão para editar campos ou finalizar etapas.
- Convidados poderão visualizar o documento conforme as permissões atribuídas.

### Assuntos ainda não definidos

- Alcance da visualização concedida ao convidado: documento inteiro ou partes selecionadas.
- Validade e revogação do convite.
- Visualização de mensagens anteriores ao convite.
- Mensagens encadeadas, menções, anexos e notificações.
- Política de edição ou retirada de mensagens.
- Forma de incorporar explicitamente uma mensagem ao conteúdo oficial do documento.

## Gestão documental e auditoria

- Ao concluir o percurso, um ou mais documentos serão armazenados no gestor de documentos.
- Cada modelo de documento definirá se a assinatura é necessária, qual tipo será exigido, onde o documento será armazenado no gestor, quem poderá visualizar o documento, quem poderá consultar seu histórico e por quanto tempo ele será guardado.
- Usuários autorizados poderão consultar, a partir de um documento armazenado, o percurso desde o início até a sua conclusão.
- Documentos intermediários e finais deverão manter o vínculo com os valores e a passagem do fluxo que os produziram. Uma nova passagem não substituirá os registros históricos anteriores.
- O sistema deverá oferecer dashboards estatísticos dos processos e informações que permitam identificar gargalos e desempenho.

O sistema deverá identificar pelo menos:

- Quem criou o formulário ou documento.
- Quando foi criado.
- Quem alterou cada parte.
- Quando cada alteração ocorreu.
- Quem finalizou ou devolveu uma etapa.
- As versões de modelos, formulários e PDFs utilizadas.

### Recomendação pendente de aprovação

Manter auditoria append-only para eventos relevantes, incluindo instituição, usuário, origem de autenticação, data e hora, operação, entidade, versão, estados anterior e posterior, justificativa e hashes dos artefatos relacionados.

## Assinaturas

Um documento finalizado poderá ser encaminhado para assinatura conforme as regras do seu modelo. O modelo definirá se ela é obrigatória e o tipo de assinatura exigido.

Um ou mais participantes internos do fluxo poderão ser chamados a assinar, e pessoas externas à instituição, como um cliente destinatário de uma proposta, também poderão ser convidadas. A assinatura de uma pessoa externa não exige que ela receba um perfil ou papel de usuário interno; sua identificação e o procedimento de assinatura ainda precisarão ser definidos.

### Métodos propostos para avaliação

- Assinatura por responsabilidade: confirmação da ação por nova digitação da senha de login.
- Assinatura eletrônica avançada: mecanismo com evidências de autoria e integridade; e-mail, endereço IP e localização foram citados como possíveis evidências, mas não definem sozinhos o mecanismo.
- Assinatura com certificado digital: o uso de certificados ICP-Brasil e de certificados de outras cadeias deverá ser distinguido na definição técnica e jurídica.

Os requisitos, as evidências, os signatários e as condições de uso de cada método ainda precisam ser detalhados. Uma assinatura deve permanecer vinculada à versão exata do documento assinado; uma nova versão não herda a assinatura anterior.

Foi definida a seguinte evolução:

1. Assinatura eletrônica avançada.
2. Assinatura qualificada com ICP-Brasil.
3. Outros modelos ou jurisdições serão avaliados posteriormente.

### OpenTimestamps — proposta em avaliação

O OpenTimestamps foi sugerido como componente da assinatura avançada. A análise inicial concluiu que ele pode fornecer prova adicional de existência e integridade por meio da ancoragem de hashes na blockchain do Bitcoin, mas não identifica sozinho o signatário nem comprova sua manifestação de vontade.

Sua utilização adequada seria como camada complementar ao mecanismo de identidade, autenticação forte, consentimento e associação entre signatário e documento.

A adoção do OpenTimestamps ainda não foi registrada como decisão aprovada.

## Autenticação e sessões

- Login local.
- Login pela API Argous.
- Login Google por OpenID Connect.
- Login Microsoft por OpenID Connect.
- Todas as origens convergem para um usuário interno.
- Uma conta externa poderá exigir vinculação posterior ao Argous quando houver necessidade funcional específica.
- Senhas locais serão protegidas com PBKDF2-HMAC-SHA-256, com salt e parâmetros próprios.
- O bearer de sessão será aleatório e o banco armazenará somente seu hash SHA-256.
- A autenticação deverá registrar histórico e permitir revogação da sessão.

## Segurança — pontos obrigatórios de atenção

- Isolamento integral entre instalações de clientes.
- Princípio do menor privilégio para responsáveis, observadores e convidados.
- Separação entre visualizar, comentar, editar e finalizar.
- Controle de acesso também no backend, nunca apenas na interface.
- Proteção e rotação de segredos e chaves.
- Criptografia de transporte e avaliação de criptografia em repouso.
- Controle de uploads e verificação de anexos potencialmente maliciosos.
- Não incluir conteúdo sensível diretamente em notificações externas.
- Detecção de alterações posteriores em documentos finalizados.
- Preservação das evidências de assinatura e auditoria.
- Avaliação jurídica específica conforme tipo de documento e partes envolvidas.

## Referência examinada

O UniService foi examinado apenas como referência. Foram observados nele:

- Java com Servlet e empacotamento WAR.
- Frontend React separado do backend.
- Endpoint central de operações JSON.
- Instalação inicial transacional.
- Autenticação local, Argous, Google e Microsoft.
- Usuários, origens de identidade, sessões, perfis, papéis e permissões.
- PBKDF2 para senhas e hash do bearer no banco.
- Uso da biblioteca Quatro para persistência.

Esses elementos servem como referência, mas não são automaticamente decisões do ArgousForms além daqueles expressamente definidos neste documento.

## Próximas decisões relevantes

- Versões das tecnologias e ferramentas de build.
- Servidor Java e forma de implantação.
- Modelo inicial de perfis e permissões.
- Formato interno dos modelos de formulário e de documento.
- Editor visual e componentes de campos.
- Motor de geração de PDF.
- Semântica completa do workflow, especialmente divisão e convergência.
- Regras exatas dos estados de preenchimento.
- Funcionamento e segurança dos convites ao fórum.
- Mecanismo completo da assinatura avançada.
- Aprovação ou rejeição do OpenTimestamps.
- Estratégia de armazenamento de PDFs e anexos binários.
