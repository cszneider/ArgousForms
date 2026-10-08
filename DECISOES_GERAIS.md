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

## Estados das partes do formulário

Os estados funcionais inicialmente definidos são:

1. Pronto para iniciar o preenchimento.
2. Preenchendo.
3. Parcialmente salvo.
4. Salvo.
5. Finalizado.

Uma parte finalizada poderá, conforme permissão do workflow, retornar a uma fase anterior.

Ainda depende de aprovação a definição operacional exata dos gatilhos de cada estado, especialmente a distinção entre `Preenchendo` e `Parcialmente salvo` caso exista salvamento automático.

## Workflow

O sistema permitirá modelar fluxos com:

- Fases ou etapas.
- Transições.
- Regras de passagem.
- Divisões paralelas.
- Convergências.
- Responsáveis por partes específicas do formulário.
- Possibilidade controlada de devolução a fases anteriores.

### Recomendações pendentes de aprovação

- Tratar o workflow como um grafo versionado.
- Manter versões publicadas imutáveis.
- Vincular cada execução à versão do fluxo com a qual foi iniciada.
- Permitir avanço somente quando as partes obrigatórias estiverem finalizadas.
- Configurar a devolução por transição, incluindo destino, autorizados, justificativa e partes reabertas.
- Preservar ciclos anteriores em vez de sobrescrever execuções devolvidas.
- Invalidar formalmente documentos posteriores quando uma devolução afetar conteúdo já consolidado.

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
