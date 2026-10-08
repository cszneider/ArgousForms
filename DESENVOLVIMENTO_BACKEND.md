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

Ainda depende de decisão onde serão armazenados os PDFs e anexos binários. Devem ser avaliados armazenamento de objetos e GridFS; o MongoDB não deve ser adotado automaticamente como repositório de binários grandes sem essa análise.

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

