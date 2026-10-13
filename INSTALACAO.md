# ArgousForms — Memória da instalação de uma instituição

## Finalidade

Este arquivo reúne somente atividades e dados de instalação já definidos. Será ampliado à medida que novas decisões forem tomadas. A implantação é dedicada a cada cliente: cada instalação possui seus próprios dados e deve conter **um único registro de instituição** e **pelo menos um usuário administrador**.

O objetivo para a rotina de instalação é criar a instituição, o primeiro administrador, os perfis e papéis padrão, seus vínculos e as origens de autenticação em **uma única transação**. Essa rotina ainda não foi implementada. Na instalação de desenvolvimento, as cargas de dados são executadas manualmente; não confundir esse procedimento provisório com a atomicidade exigida da futura rotina.

## Pré-condição já adotada

O banco PostgreSQL e as tabelas da modelagem devem existir antes das cargas. O procedimento de criação da estrutura do banco ainda não está descrito neste documento.

Os scripts de estrutura e de regras de banco ficam em `ArgousForms/banco/`. Para a recriação atual do ambiente de desenvolvimento, as tabelas do esquema `Cadastro` serão criadas novamente, sem aproveitamento dos dados. A ordem dos scripts e a carga manual de teste estão em [banco/README.md](ArgousForms/banco/README.md). Esse procedimento destrutivo não define a atualização de instalações em produção; a aplicação automática de futuras alterações versionadas ainda precisa ser projetada.

Depois da carga dos papéis e perfis padrão, aplicar `ArgousForms/banco/validar-papeis-perfis.sql` como proprietário do esquema. A aplicação não instala essa trigger por conta própria nesta etapa. Ela preserva os vínculos históricos e protege os registros padrão durante a gestão posterior de acessos.

A estrutura é criada por um papel proprietário diferente de `carlos`, usuário da aplicação. Ao final de `estrutura-inicial.sql`, este recebe `USAGE` no esquema, `SELECT`, `INSERT`, `UPDATE` e `DELETE` nas tabelas e `USAGE` e `SELECT` nas sequências; não recebe permissão para criar objetos ou administrar triggers. Atualizações futuras deverão manter essas concessões para seus objetos novos.

## Configuração da instalação

- Configurar as coordenadas de acesso ao banco em `ArgousForms/src/main/webapp/WEB-INF/parametros-agforms.xml`, conforme a estrutura de parâmetros da Quatro. Não registrar credenciais neste documento.
- Configurar em `ArgousForms/src/main/webapp/WEB-INF/agforms.xml` a entrada `chave-confirmacao`, exclusiva da instalação. Seu valor é armazenado codificado; a aplicação aplica `quatro.util.BDUtil.decodifica()` e, em seguida, decodifica o Base64 para obter os bytes da chave.
- Configurar `contaEmailDeServico` e `senhaEmailDeServico` nos parâmetros do sistema para o envio dos códigos de confirmação. Os valores codificados são lidos pela aplicação com `BDUtil.decodifica()`.

## Registros iniciais definidos

As referências entre registros devem usar os identificadores gerados **nesta instalação**, nunca UUIDs copiados de outra instituição.

Os países e os tipos de identificação aprovados para a carga inicial de teste constam, respectivamente, de [carga-manual-teste.sql](ArgousForms/banco/carga-manual-teste.sql) e [carga-manual-tipos-identificacao.sql](ArgousForms/banco/carga-manual-tipos-identificacao.sql). A carga dos tipos depende dos países e inclui SSN (EUA), TFN (Austrália) e SIN (Canadá). A automatização dessas cargas na instalação ainda será definida.

| Ordem lógica | Tabelas | Registros e vínculos definidos |
| --- | --- | --- |
| 1 | `Cadastro.INSTITUICAO` | Inserir o único registro da instituição da instalação. Os dados concretos a solicitar e o comando de inclusão ainda serão definidos. |
| 2 | `Cadastro.ORIGENS_LOGIN` | Inserir a origem local com `CD_ORIGEM = 1`, `TP_AUTENTICACAO = 'L'`, `SN_ATIVA = true` e `SN_PERMITE_AUTOCADASTRO = true`. O `ID_ORIGEM_LOGIN` é um UUID próprio da instalação. Os códigos 2 e 3 foram reservados, respectivamente, para Google e Microsoft; os demais dados e a ativação dessas origens ainda não foram definidos. |
| 3 | `Cadastro.PAPEIS`, `Cadastro.PERFIS`, `Cadastro.PERFIL_PAPEIS` | Inserir os papéis padrão `INSTALADOR`, `ADMINISTRADOR_USUARIOS`, `GESTOR_ACESSOS` e `GESTOR_GRUPOS_TAGS`; criar o perfil `ADMINISTRADOR` e vinculá-lo aos três papéis administrativos. `INSTALADOR` não integra esse perfil permanente. Na recriação atual, esses registros constam de [carga-manual-teste.sql](ArgousForms/banco/carga-manual-teste.sql). |
| 4 | `Cadastro.PAPEIS`, `Cadastro.PERFIS`, `Cadastro.PERFIL_PAPEIS` | Inserir `AUTOGESTAO`, `CONSULTA_DOCUMENTOS`, `EDITOR_DE_DOCUMENTOS`, `MODELADOR` e `ANALISTA_INDICADORES`; criar `ESSENCIAL`, `PARTICIPANTE`, `MODELADOR` e `GESTOR`, com os vínculos definidos em [DECISOES_GERAIS.md](DECISOES_GERAIS.md). A carga atual consta de [carga-manual-teste.sql](ArgousForms/banco/carga-manual-teste.sql). **Não executar adicionalmente** [perfis-papeis-iniciais.sql](ArgousForms/perfis-papeis-iniciais.sql), pois produziria duplicidade. |
| 5 | `Cadastro.USUARIOS_SISTEMA`, `Cadastro.USUARIO_ORIGENS_LOGIN`, `Cadastro.USUARIO_PERFIS` | Criar o primeiro usuário administrador, associá-lo à origem de login definida para ele e atribuir-lhe `ESSENCIAL` e `ADMINISTRADOR`. A senha local, quando utilizada, deve ser armazenada como hash PBKDF2-HMAC-SHA-256. O procedimento específico de criação e confirmação desse primeiro acesso ainda precisa ser definido. |

Ainda não foram definidas as permissões concretas de cada papel. Portanto, **não há carga aprovada para `Cadastro.PERMISSOES`, `Cadastro.PAPEL_PERMISSOES` ou exceções em `Cadastro.PERFIL_PERMISSOES`**. O nome de um papel ou perfil, sozinho, não autoriza operações.

## Cadastros posteriores à instalação

O autocadastro pela página pública não faz parte da criação do primeiro administrador. Depois de instalada a aplicação e carregados os perfis ativos `ESSENCIAL` e `PARTICIPANTE`, a inclusão de um novo usuário grava, na mesma transação, a Pessoa, o usuário vinculado a ela, seu vínculo à origem de login local em `Cadastro.USUARIO_ORIGENS_LOGIN`, os dois vínculos em `Cadastro.USUARIO_PERFIS` e a confirmação de e-mail. O usuário deve confirmar o e-mail antes de poder fazer login; não haverá liberação administrativa para esse cadastro. `MODELADOR` e `GESTOR` poderão ser atribuídos depois por um administrador.

Para a instalação de desenvolvimento que ainda não recebeu o ajuste de papéis, aplicar manualmente [ajuste-papeis-perfis-2026-10-12.sql](ArgousForms/banco/ajuste-papeis-perfis-2026-10-12.sql), sem recriar as tabelas. Ele acrescenta os papéis e o perfil aprovados, atribui `ESSENCIAL` aos usuários existentes e inativa os dois papéis substituídos, preservando seus UUIDs e registros históricos. Se o ajuste antigo já foi aplicado com `MINIMO`, o gestor atualizará manualmente o código e o nome desse perfil no banco, preservando o UUID e seus vínculos.

O login local por e-mail e senha está implementado após a confirmação do e-mail. Ele cria uma sessão de sete dias em `Cadastro.HISTORICO_LOGINS`, armazenando somente o hash SHA-256 do segredo; a interface recebe um cookie `HttpOnly`. A rotina automática de instalação ainda não foi implementada. Este documento registra a política e as cargas conhecidas, sem presumir que os demais métodos de login ou módulos de trabalho já estejam integrados.
