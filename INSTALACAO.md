# ArgousForms — Memória da instalação de uma instituição

## Finalidade

Este arquivo reúne somente atividades e dados de instalação já definidos. Será ampliado à medida que novas decisões forem tomadas. A implantação é dedicada a cada cliente: cada instalação possui seus próprios dados e deve conter **um único registro de instituição** e **pelo menos um usuário administrador**.

O objetivo para a rotina de instalação é criar a instituição, o primeiro administrador, os perfis e papéis padrão, seus vínculos e as origens de autenticação em **uma única transação**. Essa rotina ainda não foi implementada. Na instalação de desenvolvimento, as cargas de dados são executadas manualmente; não confundir esse procedimento provisório com a atomicidade exigida da futura rotina.

## Pré-condição já adotada

O banco PostgreSQL e as tabelas da modelagem devem existir antes das cargas. O procedimento de criação da estrutura do banco ainda não está descrito neste documento.

## Configuração da instalação

- Configurar as coordenadas de acesso ao banco em `ArgousForms/src/main/webapp/WEB-INF/parametros-agforms.xml`, conforme a estrutura de parâmetros da Quatro. Não registrar credenciais neste documento.
- Configurar em `ArgousForms/src/main/webapp/WEB-INF/agforms.xml` a entrada `chave-confirmacao`, exclusiva da instalação. Seu valor é armazenado codificado; a aplicação aplica `quatro.util.BDUtil.decodifica()` e, em seguida, decodifica o Base64 para obter os bytes da chave.
- Configurar `contaEmailDeServico` e `senhaEmailDeServico` nos parâmetros do sistema para o envio dos códigos de confirmação. Os valores codificados são lidos pela aplicação com `BDUtil.decodifica()`.

## Registros iniciais definidos

As referências entre registros devem usar os identificadores gerados **nesta instalação**, nunca UUIDs copiados de outra instituição.

| Ordem lógica | Tabelas | Registros e vínculos definidos |
| --- | --- | --- |
| 1 | `Cadastro.INSTITUICAO` | Inserir o único registro da instituição da instalação. Os dados concretos a solicitar e o comando de inclusão ainda serão definidos. |
| 2 | `Cadastro.ORIGENS_LOGIN` | Inserir a origem local com `CD_ORIGEM = 1`, `TP_AUTENTICACAO = 'L'`, `SN_ATIVA = true` e `SN_PERMITE_AUTOCADASTRO = true`. O `ID_ORIGEM_LOGIN` é um UUID próprio da instalação. Os códigos 2 e 3 foram reservados, respectivamente, para Google e Microsoft; os demais dados e a ativação dessas origens ainda não foram definidos. |
| 3 | `Cadastro.PAPEIS`, `Cadastro.PERFIS`, `Cadastro.PERFIL_PAPEIS` | Inserir os papéis padrão `INSTALADOR`, `ADMINISTRADOR_USUARIOS` e `GESTOR_ACESSOS`; criar o perfil `ADMINISTRADOR` e vinculá-lo aos dois últimos papéis. `INSTALADOR` não integra esse perfil permanente. Os `INSERT`s foram fornecidos para execução manual na instalação atual; ainda não existe um script versionado para essa carga. |
| 4 | `Cadastro.PAPEIS`, `Cadastro.PERFIS`, `Cadastro.PERFIL_PAPEIS` | Executar uma vez a carga manual [perfis-papeis-iniciais.sql](ArgousForms/perfis-papeis-iniciais.sql): cria `INICIADOR_PROCESSOS`, `EXECUTOR_ETAPAS`, `MODELADOR` e `ANALISTA_INDICADORES`; cria os perfis `PARTICIPANTE`, `MODELADOR` e `GESTOR`; e grava seus vínculos com os papéis. O script usa os UUIDs gerados pelo banco e contém transação própria. |
| 5 | `Cadastro.USUARIOS_SISTEMA`, `Cadastro.USUARIO_ORIGENS_LOGIN`, `Cadastro.USUARIO_PERFIS` | Criar o primeiro usuário administrador, associá-lo à origem de login definida para ele e atribuir-lhe o perfil `ADMINISTRADOR`. A senha local, quando utilizada, deve ser armazenada como hash PBKDF2-HMAC-SHA-256. O procedimento específico de criação e confirmação desse primeiro acesso ainda precisa ser definido. |

Ainda não foram definidas as permissões concretas de cada papel. Portanto, **não há carga aprovada para `Cadastro.PERMISSOES`, `Cadastro.PAPEL_PERMISSOES` ou exceções em `Cadastro.PERFIL_PERMISSOES`**. O nome de um papel ou perfil, sozinho, não autoriza operações.

## Cadastros posteriores à instalação

O autocadastro pela página pública não faz parte da criação do primeiro administrador. Depois de instalada a aplicação e carregado o perfil ativo `PARTICIPANTE`, a inclusão de um novo usuário grava, na mesma transação, o usuário, seu vínculo à origem de login local em `Cadastro.USUARIO_ORIGENS_LOGIN`, o vínculo com `PARTICIPANTE` em `Cadastro.USUARIO_PERFIS` e a confirmação de e-mail. O usuário deve confirmar o e-mail antes de poder fazer login; não haverá liberação administrativa para esse cadastro. `MODELADOR` e `GESTOR` poderão ser atribuídos depois por um administrador.

A operação real de login e a rotina automática de instalação ainda não foram implementadas. Este documento registra a política e as cargas conhecidas, sem presumir que essas funcionalidades já estejam disponíveis.
