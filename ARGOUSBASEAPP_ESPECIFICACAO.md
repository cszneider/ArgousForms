# ArgousBaseApp — especificação de referência

## Objetivo e alcance

Criar, em projeto próprio, um JAR de backend reutilizável para cadastro institucional, usuários, origens de login, sessões, papéis, perfis, permissões e programas. A aplicação consumidora fornece a interface, as rotas HTTP, o transporte de e-mail e suas permissões de negócio. O JAR não deve depender de telas do ArgousForms. Cada instalação é dedicada a uma instituição e terá suas próprias credenciais e segredos.

Este documento registra comportamentos aprovados no ArgousForms e as diferenças da modelagem de `Cadastro` enviada em 09/11/2026. **Não significa que todas as funções descritas já estejam implementadas no ArgousForms nem aprova automaticamente decisões novas para o ArgousBaseApp.** O SQL companheiro cria somente a estrutura enviada, com correções necessárias para execução e para a política de sessão já aprovada.

## Modelo de dados enviado

- `USUARIOS_SISTEMA`: conta interna, nome, e-mail, hash de senha local opcional e exclusão lógica.
- `ORIGENS_LOGIN` e `USUARIO_ORIGENS_LOGIN`: catálogo de provedores e vínculo entre identidade externa/local e usuário interno. Uma pessoa pode usar mais de uma origem, sempre convergindo para uma conta interna.
- `HISTORICO_LOGINS`: sessões por origem, hash do bearer, criação, último acesso, validade móvel, revogação e metadados de conexão.
- `PROGRAMAS` e `PERMISSOES`: catálogo de recursos e ações autorizáveis.
- `PAPEIS`, `PAPEL_PERMISSOES`, `PERFIS`, `PERFIL_PAPEIS`, `PERFIL_PERMISSOES`, `USUARIO_PERFIS`: composição e concessão de acesso. Papéis são funções atômicas, sem hierarquia. Um usuário pode possuir vários perfis; perfil agrega papéis. Nomes de perfil apresentados na interface não definem precedência de autorização.
- `INSTITUICAO`: registro único, fuso, URLs de integração e política de sessões.
- `UNIDADE`, `SETOR` e `VARIAVEIS_INSTITUICAO`: estrutura e valores institucionais previstos nesta modelagem. A árvore de variáveis precisa de `ID_ATRIBUTO_PAI NULL` para admitir raízes.

O modelo enviado **não contém** `PESSOAS`, grupos, tags ou identificações pessoais. No ArgousForms esses são cadastros distintos, com Pessoa obrigatoriamente vinculada a Usuário, no máximo uma conta por Pessoa e reaproveitamento da conta excluída na reativação. A extração desse conjunto para a base comum exige decisão e modelo próprios. Não se deve inferir que `USUARIOS_SISTEMA` contém todos os dados de Pessoa.

Também não contém `CONFIRMACOES_EMAIL`. O fluxo de convite, confirmação e troca de e-mail depende de uma tabela equivalente à existente no ArgousForms, com usuário, endereço, hash do código, criação, validade, confirmação, revogação e tentativas inválidas. **A estrutura SQL entregue não basta, sozinha, para disponibilizar esses fluxos.** A inclusão da tabela no modelo da nova base deve ser aprovada antes da implementação.

## Autenticação

O login local usa e-mail, senha válida, vínculo local vigente e e-mail confirmado. Conta excluída, origem inativa ou revogada e vínculo revogado não podem autenticar. A confirmação de e-mail habilita o login sem aprovação administrativa e não autentica automaticamente o usuário. Nome e e-mail são obrigatórios ao criar conta; os demais dados pessoais são opcionais no ArgousForms.

O ArgousForms planeja origens local, Argous, Google e Microsoft convergentes para o mesmo usuário interno. **Somente o login local deve ser tratado como comportamento implementado de referência.** Os contratos, credenciais, vínculos e proteção contra associação indevida das demais origens precisam ser definidos no projeto da base. O catálogo de origens é extensível; não basta cadastrar uma linha para que um provedor passe a funcionar.

Senhas novas: de 8 a 1024 caracteres e ao menos três entre quatro classes: letra maiúscula, letra minúscula, dígito e símbolo. A interface mostra a força somente na criação e troca de senha; não ao digitar senha atual no login. Senhas existentes não são rejeitadas no login apenas por não cumprirem a política nova. A implementação atual de referência armazena PBKDF2-HMAC-SHA-256 com salt aleatório de 16 bytes, 600.000 iterações e saída de 256 bits; compara hashes em tempo constante. O formato persistido contém algoritmo, iterações, salt e derivação, permitindo verificar parâmetros de cada registro.

Trocar senha local exige sessão autenticada, senha atual e confirmação da nova senha. A operação grava o novo hash e revoga as outras sessões ativas na mesma transação, preservando a sessão em uso. A listagem de conexões mostra início, último acesso, validade e dados de conexão sem expor bearer; o usuário pode invalidar cada conexão individualmente. Sair revoga a sessão atual.

O autocadastro local concede o perfil básico da aplicação consumidora na transação de inclusão e exige confirmação do e-mail para o primeiro login. No ArgousForms, o novo usuário recebe `ESSENCIAL` e `PARTICIPANTE`; `MODELADOR`, `GESTOR` e outros perfis são atribuídos por administrador. Esses nomes e suas permissões são **catálogo do ArgousForms**, não constantes universais do JAR. Na inclusão administrativa, um convite por e-mail permite ao destinatário definir a senha e confirmar o endereço. A alteração de e-mail só substitui o endereço da conta e da origem local depois da confirmação no endereço novo. O código de confirmação atual tem oito dígitos, dura dez minutos, admite até cinco tentativas inválidas e é armazenado apenas como hash HMAC; a chave é própria de cada instalação e fica fora do código e do JAR. O envio do e-mail ocorre após o commit; falha de envio mantém a confirmação pendente, sem login liberado.

A exclusão de conta é lógica: marcar `DT_EXCLUSAO`, invalidar sessões e confirmações pendentes e preservar histórico. Ao reativar, reutilizar a mesma linha de usuário, invalidar senha e sessões antigas, enviar novo convite e não restaurar automaticamente perfis privilegiados. Um perfil revogado e novamente atribuído reutiliza o vínculo `USUARIO_PERFIS` se a chave única impedir nova linha. Regras relativas a Pessoa, grupos e tags exigem os respectivos módulos, ausentes do DDL enviado.

## Sessões

No login, gerar bearer aleatório de 32 bytes com gerador criptográfico; entregar o segredo apenas ao cliente e guardar somente SHA-256 em `HISTORICO_LOGINS.CD_BEARER_SHA256`. Nunca registrar bearer, senha, código de confirmação ou segredos em logs. O ArgousForms usa cookie `HttpOnly`, `SameSite=Strict`, `Path` do contexto e `Secure` sob HTTPS; o nome atual é `AF_SESSAO`, que deve ser configurável ou definido pela aplicação consumidora para evitar colisões entre apps. A interface consulta a sessão no início e não lê o cookie. O cookie persistente permite restaurar o login após fechar o navegador.

`INSTITUICAO.NR_DIAS_SESSAO_MOVEL` começa em 7 dias; `NR_DIAS_SESSAO_ABSOLUTA`, em 60. Na criação, `DT_VALIDADE` é o menor entre `DT_LOGIN + prazo móvel` e `DT_LOGIN + prazo absoluto`. No primeiro acesso autenticado de um novo dia civil no `CD_FUSO_HORARIO` da instituição, renovar a validade para o menor entre `agora + prazo móvel` e o limite absoluto original. Acesso no mesmo dia não reinicia o relógio móvel. Uma sessão expirada ou revogada nunca é reativada. Alterações dos dois prazos afetam sessões existentes na próxima consulta, sem restaurar as já vencidas; o limite absoluto é contado sempre desde `DT_LOGIN`. Usar o fuso institucional, não o fuso do servidor. Guardar e comparar instantes consistentemente; a modelagem enviada usa `timestamp` sem fuso, portanto a convenção de UTC na aplicação/conexão precisa ser definida e testada.

O DDL enviado impõe ainda `NR_DIAS_SESSAO_ABSOLUTA > NR_DIAS_SESSAO_MOVEL`; a política aprovada no ArgousForms exige somente ambos positivos e admite configuração administrativa. Essa restrição adicional foi **mantida** no SQL por constar da nova modelagem. Sua permanência deve ser decidida no ArgousBaseApp. Já a igualdade fixa `DT_VALIDADE = DT_LOGIN + 7 dias` foi removida do SQL, pois impediria a renovação móvel aprovada.

## Papéis, perfis e permissões

A interface pode usar papéis efetivos para mostrar ações e perfis para identificação do usuário. O backend deve confirmar autorização em **cada operação e recurso**; ocultar botão ou rota não protege dados. Papéis não têm hierarquia. A atribuição de perfil não pode, por si só, dispensar checagens de propriedade, vínculo, estado, instituição e demais critérios do recurso. Perfis e papéis de sistema protegem código, composição e exclusão; nome e descrição podem ser editados conforme política administrativa. Registros usados historicamente são desativados, em vez de excluídos fisicamente; a modelagem deve preservar o histórico necessário para aplicar essa regra.

`PERFIL_PERMISSOES.TP_EFEITO` permite `C` ou `N`, mas ainda não há regra aprovada para precedência entre concessão por papel, permissão direta de perfil e negação, nem para conflitos entre múltiplos perfis. **Não implementar precedência presumida**; obter decisão do gestor do novo projeto antes de oferecer autorização efetiva a partir dessa tabela.

O catálogo de programas, ações, papéis e perfis de cada aplicação deve ser carregado durante sua instalação, em uma transação junto com instituição, primeiro administrador e origens de login. O JAR pode fornecer operações e contratos de carga, mas não deve fixar os papéis específicos de ArgousForms em todas as aplicações. Senhas/credenciais iniciais não devem aparecer no SQL distribuído. Garantir usuário de aplicação com DML estritamente necessário, sem permissão para alterar DDL, funções ou triggers.

## Contrato do backend e da interface consumidora

O JAR deve expor serviços Java claros para: criar/confirmar usuário; convite; login; consulta/renovação/revogação de sessão; troca de senha; conexões ativas; leitura de papéis/perfis efetivos; administração de usuários, perfis, papéis, programas, permissões e instituição. As operações devem aceitar contexto explícito da instalação e do usuário, não depender de componentes React, cookies ou servlet internamente. A aplicação anfitriã adapta HTTP, cookie, e-mail, páginas e mensagens. Toda alteração que envolva vários registros pertence a uma única transação externa; serviços auxiliares não criam transações aninhadas. Se o novo projeto usar Quatro, escrita por `*Negocio` e regras próprias por `*NegocioEspecifico`, não por `*Persistor` direto.

A interface da aplicação anfitriã deve oferecer login, confirmação de e-mail, definição/recuperação de senha conforme contrato aprovado, autogestão, sessões ativas e área administrativa coerente com os papéis. Mostrar força e validações no formulário antes de gravar e repetir as regras no backend; usar mensagens de erro seguras, sem revelar se uma conta existe quando isso facilitar enumeração. O menu pessoal mostra o primeiro nome e perfis de forma resumida; perfis não representam uma hierarquia de autorização.

## Instalação, segurança e pendências

O SQL companheiro cria objetos em uma base vazia, sem `DROP`, sem usuários de banco, sem segredos e sem cargas de papéis/perfis/origens. Não foi aplicado ao banco. Cada cliente terá usuário e senha de banco próprios. O instalador deverá criar instituição, primeiro administrador e catálogos aprovados numa transação; a carga específica deve ser fornecida pela aplicação consumidora. Os segredos de produção devem ser externos ao JAR/WAR. HTTPS é exigido para cookie `Secure`; o repositório Maven HTTP usado no ambiente atual é um risco a eliminar antes de distribuição.

Antes de implementar a base comum, fechar com o gestor: (1) inclusão/modelagem de `CONFIRMACOES_EMAIL`; (2) se Pessoa e outros cadastros entram no JAR; (3) precedência de permissões `C/N`; (4) se a regra `absoluta > móvel` permanece; (5) contratos das origens não locais; (6) convenção temporal de `timestamp` e fuso; (7) interface de integração para e-mail e adaptadores HTTP. Essas são **pendências**, não decisões aprovadas.
