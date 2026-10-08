# ArgousForms

## Autoridade e governança

- O usuário é o gestor do projeto e possui a decisão final sobre todas as escolhas funcionais, técnicas e arquiteturais.
- Recomendações, alternativas, inferências e análises do agente não constituem decisões aprovadas.
- Não criar nem alterar código-fonte, documentação, configuração, dependências, estrutura do workspace, banco de dados ou ambiente sem autorização explícita do gestor para a atividade.
- Quando o gestor solicitar explicitamente uma criação, alteração, correção, exclusão ou execução, a própria solicitação constitui autorização suficiente para a atividade descrita. Não pedir uma confirmação adicional para agir dentro desse escopo.
- Pedir autorização somente quando a ação pretendida não tiver sido informada ao gestor, estiver fora do escopo solicitado, atingir outros arquivos ou projetos sem necessidade direta, ou produzir impacto material adicional que não esteja implícito na solicitação.
- Uma autorização deve ser interpretada dentro do escopo solicitado. Não ampliar a alteração para assuntos relacionados sem nova autorização.
- Inspeções em modo somente leitura diretamente necessárias para atender ao pedido são permitidas. Não consultar outros projetos, inclusive UniService, Argous e ArgousIA, sem solicitação ou autorização expressa.
- Antes de atividade que possa consumir quantidade significativa de tokens, informar objetivo, escopo e resultado esperado e aguardar autorização. Isso inclui pesquisa extensa, auditoria ampla, geração de grandes artefatos e trabalho paralelo com múltiplos agentes.
- Preservar arquivos e alterações existentes do usuário. Não refazer, remover ou sobrescrever trabalho sem autorização específica.

## Papel do agente

- Analisar requisitos e explicitar suas consequências.
- Apresentar alternativas relevantes, com vantagens, limitações, custos, dependências e riscos.
- Sinalizar claramente qual alternativa é recomendada e por quê, sem tratá-la como decisão.
- Alertar sobre segurança, privacidade, integridade, desempenho, portabilidade, manutenção e dependências.
- Identificar decisões que precisam do gestor antes da implementação.
- Distinguir, na conversa e na documentação autorizada, definições aprovadas, recomendações pendentes e assuntos ainda não decididos.

## Documentos obrigatórios de contexto

Antes de analisar ou implementar mudanças no projeto, ler os documentos aplicáveis:

- `DECISOES_GERAIS.md`: governança, visão do produto, definições gerais e decisões pendentes.
- `DESENVOLVIMENTO_FRONTEND.md`: definições e questões do frontend.
- `DESENVOLVIMENTO_BACKEND.md`: definições e questões do backend.

Esses arquivos estão atualmente na raiz do workspace. Existe a intenção de movê-los posteriormente para `DOCS/`, mas a movimentação e a atualização destas referências dependem de autorização.

Não transformar itens identificados nesses documentos como proposta, recomendação ou decisão pendente em implementação definitiva sem aprovação do gestor.

## Estrutura atual do workspace

- A raiz do workspace reúne as instruções e a documentação do projeto.
- `ArgousForms/` contém o projeto Maven criado pelo Eclipse.
- O frontend React será mantido separado do backend dentro do projeto, mas sua estrutura e ferramentas ainda dependem de decisão e autorização.
- `ArgousForms/target/` contém artefatos gerados. Não editar arquivos em `target/` como fonte; alterar a origem correspondente e regenerar somente quando autorizado.
- O futuro repositório Git deverá ter como raiz o workspace, para incluir documentação e projeto em um único repositório.

## Base técnica já definida

- Backend Java 21 em projeto Maven para Eclipse.
- Empacotamento WAR, Servlet 4.0 e conteúdo web em `src/main/webapp`.
- Artefato final `ArgousForms.war` e aplicação explodida `target/ArgousForms/`.
- Biblioteca `br.com.quatro:Quatro:0.0.8`.
- PostgreSQL com driver `org.postgresql:postgresql:42.7.3`.
- MongoDB para documentos e estruturas documentais dinâmicas.
- Redis para cache e dados efêmeros.
- Frontend em React, claramente separado do backend.
- Comunicação principal por endpoint central que recebe requisições `POST`.
- Implantação SaaS dedicada para cada cliente.
- Documento final em PDF.
- Idiomas iniciais: português, espanhol e inglês.

Versões, bibliotecas e ferramentas não relacionadas acima não devem ser presumidas como aprovadas.

## Princípios funcionais já definidos

- Modelos de formulário e modelos de documento são conceitos distintos.
- Um documento poderá ser formado por vários formulários e partes preenchidas por pessoas diferentes.
- Usuários poderão trabalhar paralelamente, mas cada parte específica terá um único responsável.
- O modelo inicial não prevê várias pessoas editando o mesmo campo.
- Estados iniciais das partes: pronto para iniciar, preenchendo, parcialmente salvo, salvo e finalizado.
- Partes finalizadas poderão retornar a fases anteriores conforme permissões e regras ainda a definir.
- Cada instância documental terá fórum próprio.
- Participar do fórum ou visualizar o documento não concede automaticamente responsabilidade de preenchimento.
- A primeira etapa de assinaturas será a assinatura eletrônica avançada; ICP-Brasil será considerada posteriormente.
- OpenTimestamps permanece uma proposta em avaliação como evidência complementar, não uma decisão aprovada nem um mecanismo completo de assinatura.

## Instalação, autenticação e segurança

- A instalação inicial criará instituição, primeiro administrador, perfis e origens de autenticação em uma única transação.
- Autenticação local, Argous, Google e Microsoft convergirão para um usuário interno.
- Senhas locais usarão PBKDF2-HMAC-SHA-256 com salt e parâmetros próprios.
- Bearers de sessão serão aleatórios e apenas seus hashes SHA-256 serão armazenados no banco.
- Aplicar autorização no backend para cada operação e recurso; ocultação na interface não é controle de segurança.
- Aplicar menor privilégio e separar permissões de visualizar, comentar, editar, finalizar, devolver e administrar.
- Não registrar nem apresentar senhas, tokens, chaves privadas, credenciais de banco ou conteúdo documental sensível em logs, respostas ou documentação.
- Não reutilizar automaticamente credenciais de outro sistema ou cliente.
- O `keystore.p12` atual é exclusivo do desenvolvimento. Não o tratar como chave de produção nem reutilizá-lo em instalações comerciais.
- Segredos e chaves de produção deverão ser exclusivos de cada instalação e protegidos fora do código-fonte e de distribuições públicas.
- O repositório Maven interno atual utiliza HTTP; registrar como risco e recomendar HTTPS antes de ambientes de produção.

## Configuração atual do backend

- `ArgousForms/src/main/webapp/WEB-INF/agforms.xml` contém parâmetros específicos da aplicação e referências do keystore de desenvolvimento.
- `ArgousForms/src/main/webapp/WEB-INF/parametros-agforms.xml` contém a estrutura de parâmetros da Quatro; credenciais e URL do banco permanecem pendentes de configuração.
- `ArgousForms/src/main/webapp/WEB-INF/web.xml` configura o `quatro.util.StartupServlet` e aponta para o arquivo de parâmetros na aplicação explodida de desenvolvimento.
- Não inserir credenciais reais nesses arquivos nem substituir valores pendentes sem autorização e sem definir a forma segura de proteção.
- A chave HMAC da confirmação de e-mail foi configurada pelo gestor em `agforms.xml`, na entrada `chave-confirmacao`. O valor armazenado é codificado: a leitura deverá aplicar `quatro.util.BDUtil.decodifica()` e depois decodificar o Base64 para recuperar os bytes da chave. Essa definição substitui o uso da variável de ambiente `ARGOUSFORMS_CONFIRMACAO_CHAVE`; não registrar o valor em logs ou documentação. A leitura utiliza o recurso `/WEB-INF/agforms.xml` da aplicação pelo contexto Servlet.

## Estilo do código Java

- Ao criar uma classe Java ou interagir materialmente com uma classe existente, aplicar progressivamente o estilo definido pelo gestor à parte tocada, sem promover uma reformatação ampla de arquivos não relacionados.
- Manter a declaração de parâmetros dos métodos em uma única linha sempre que permanecer legível.
- Manter chamadas, construções e condições simples em uma única linha sempre que permanecerem legíveis.
- Usar linhas vazias para separar blocos lógicos e facilitar a leitura humana do método.
- Preservar quebras de linha quando a expressão for genuinamente longa ou complexa e a compactação prejudicar a interpretação.
- Não deixar espaços ou tabulações no final das linhas.
- Usar `CodigoConfirmacao.java`, ajustada pelo gestor, como referência concreta de formatação Java.
- Inserir espaços internos nos parênteses não vazios de declarações, chamadas, construções e condições: `metodo( argumento )`, `new Tipo( argumento )`, `if( condicao )` e `catch ( Exception e )`. Manter parênteses vazios como `metodo()`.
- Usar `if(`, sem espaço entre `if` e `(`, conforme a referência do gestor.
- Em alocações de arrays, usar espaços internos: `new byte[ 32 ]`; declarações de tipo permanecem `byte[]`.
- Em métodos com vários blocos lógicos, deixar uma linha vazia após a abertura do corpo e entre validação, processamento e retorno. Métodos simples de retorno direto podem permanecer compactos.
- Manter guardas simples com `return` na mesma linha quando legíveis; usar bloco com chaves para validações que lançam exceção, conforme a classe de referência.
- Separar os grupos de imports `java.*` e `javax.*` por uma linha vazia.
- Antes de entregar alterações Java, revisar a parte tocada contra essas regras; não aplicar formatação automática que remova os espaços internos ou as separações de blocos.

## Persistência e transações com o framework Quatro

- Inclusões, alterações e exclusões devem ser executadas pela respectiva classe `*Negocio`, para que as verificações de consistência e regras de negócio sejam aplicadas.
- Regras de negócio específicas devem ser implementadas na classe `*NegocioEspecifico` correspondente, por meio dos ganchos do Quatro (`antesDeInserir`, `depoisDeInserir`, `antesDeAlterar`, `depoisDeAlterar` etc.), sem editar a classe `*Negocio` gerada para esse fim.
- Quando a mesma regra se aplicar a mais de uma operação, extraí-la para um método privado que receba a entidade e chamá-lo dos ganchos pertinentes. Exemplo: `ConfirmacaoEmailNegocioEspecifico.checaRegrasDeNegocio( ConfirmacaoEmail )` é chamado antes de inserir e antes de alterar.
- Não usar diretamente classes `*Persistor` em serviços, resolvers ou demais classes da aplicação. O uso de `*Persistor` deve permanecer restrito à implementação interna das classes de negócio geradas.
- Consultas podem utilizar `Localizador`, `Query` ou consultas específicas parametrizadas, conforme a necessidade.
- A transação deve pertencer ao método que representa a operação externa completa e sua unidade atômica de trabalho.
- Métodos auxiliares que recebem uma conexão com transação em andamento devem participar dessa transação e não devem executar `beginTransaction()`, `commit()` ou `rollback()` próprios.
- Não criar transações aninhadas. O framework Quatro 0.0.8 não as suporta.
- O método externo responsável pela transação deve confirmar a operação somente após todas as gravações terem sido concluídas e deve executar `rollback()` em caso de falha, verificando antes se a conexão permanece em transação.

## Forma de trabalho

- Aplicar KISS como regra geral: escolher a solução mais simples que atenda aos requisitos aprovados, evitar abstrações, camadas, configurações e dependências sem necessidade concreta, sem abrir mão de segurança e integridade.
- Antes de implementar uma etapa com impacto em modelo de dados, autenticação, autorização, assinatura, auditoria, workflow, armazenamento documental ou infraestrutura, apresentar as decisões necessárias e aguardar aprovação.
- Para mudanças autorizadas, limitar os arquivos ao necessário, verificar o resultado proporcionalmente ao risco e comunicar o que foi alterado e o que permanece pendente.
- Não adicionar dependências por conveniência. Explicar necessidade, maturidade, licença, manutenção, impacto no WAR e riscos antes de solicitar aprovação.
- Não executar migrações, conectar o ArgousForms à base de outro sistema nem realizar escritas em serviços externos sem autorização específica.
- Não modificar arquivos gerados em `target/` diretamente.
- Enquanto o Maven não estiver disponível no shell, orientar ou solicitar ao gestor a execução dos builds pelo Eclipse quando necessária; não afirmar que um build foi validado sem evidência.
