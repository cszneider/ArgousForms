# Página inicial e preparação da instalação

## Estado desta entrega

A página inicial React/Material UI lê o nome da instituição por `GET /api/inicializacao`. Na inicialização da aplicação, o listener lê `/WEB-INF/configuracao.xml`; se esse arquivo ainda não existir, lê `/WEB-INF/startup.xml` e gera a configuração permanente cifrada. Os leitores XML desabilitam DTD e entidades externas. A API retorna somente o nome público da instituição. Depois da leitura da configuração, o listener conecta ao PostgreSQL e instala ou verifica a base comum antes de liberar a página de login. Falhas de configuração ou instalação mantêm a API de inicialização indisponível. A autenticação administrativa utiliza as contas e sessões PostgreSQL da base comum.

O formulário valida e-mail e senha no backend e recebe uma sessão em cookie HttpOnly. Contas com troca obrigatória seguem diretamente para o formulário de nova senha; a administração permanece bloqueada no backend até a alteração. Não há credencial de demonstração nem autenticação simulada.

## Configuração inicial

O modelo está em `src/main/webapp/WEB-INF/startup.exemplo.xml`. Na aplicação implantada, criar `WEB-INF/startup.xml` ao lado de `web.xml`. O arquivo efetivo é ignorado pelo Git e excluído do WAR gerado pelo Maven; deve ser fornecido localmente na instalação.

O novo campo é:

```xml
<instituicao>
  <nome>Padaria do Espanhol</nome>
</instituicao>
```

Ele fica diretamente dentro de `<startup>`, antes dos blocos `<administrador>` e `<postgres>`. O nome é público, deve conter de 1 a 200 caracteres e aparece como título da página. O exemplo mantém os demais valores vazios para não distribuir credenciais.

O nome da instituição e os cinco campos PostgreSQL são persistidos em `WEB-INF/configuracao.xml`. Os dados administrativos iniciais não são copiados para esse arquivo. Na primeira instalação, o bloco `<administrador>` de `startup.xml` fornece e-mail, nome e senha temporária. Após criar schema, tabelas, Administrador e configuração em uma única transação, o listener remove `startup.xml`. Em instalações já existentes e verificadas, um startup remanescente também é removido, sem reaplicar suas credenciais. A configuração permanente deve ser preservada para todas as reinicializações. Removê-lo da aplicação explodida não remove uma eventual cópia de um WAR ou backup antigo.

A chave simétrica parte de 250 caracteres alfanuméricos aleatórios, compactados em um fluxo de 7 bits por caractere (219 bytes, com dois bits finais de preenchimento) e armazenados em Base64. SHA-256 deriva a chave AES de 256 bits. Cada campo usa AES-GCM com nonce aleatório próprio de 12 bytes, tag de 128 bits e associação ao nome do campo e à versão do formato. A compactação da chave é ofuscação: quem obtiver o arquivo e conhecer o código poderá recuperar os dados, pois a chave acompanha o conteúdo. Não se usa Quatro para esse mecanismo.

O arquivo é preparado temporariamente, validado por releitura e movido sem substituir uma configuração existente. Em sistemas POSIX, é criado com permissão `0600`. O usuário do Tomcat deve poder escrever em `WEB-INF`. Configuração existente inválida não é sobrescrita nem reconstruída a partir do startup. Erros são registrados sem conteúdo do XML ou detalhes de exceções. A aplicação precisa estar implantada em diretório explodido, com `getRealPath` disponível.

`configuracao.xml` e arquivos temporários de sua geração são excluídos do Git e do WAR. Um `clean` apaga `target/`, inclusive esses arquivos quando a implantação aponta para essa pasta. Antes de limpar ou substituir a implantação, preservar uma cópia protegida dos arquivos locais de configuração e restaurá-la em `WEB-INF`. Não incluí-los na distribuição a clientes.

Referência técnica: [Cipher — Java 21](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/javax/crypto/Cipher.html).

## Instalação automática do banco

O database e o usuário devem existir previamente. Ao carregar a aplicação no Tomcat, `ConfiguracaoListener` executa `InstalacaoBanco` por JDBC PostgreSQL, sem Quatro ou acesso ao ERP:

1. Carrega a configuração permanente cifrada, ou a cria a partir de `startup.xml`.
2. Abre uma transação e obtém uma trava PostgreSQL para serializar inicializações concorrentes no mesmo database.
3. Se o schema `agforms` ainda não existir, valida o Administrador do startup, executa `script_base_webhook.sql` e inclui o Administrador e a configuração na mesma transação.
4. O e-mail é normalizado para minúsculas; o Administrador nasce ativo, com troca obrigatória da senha. A senha é gravada como PBKDF2-HMAC-SHA-256, salt aleatório de 16 bytes, 600.000 iterações e hash de 256 bits. A senha inicial não é persistida no XML permanente.
5. A configuração recebe os prazos padrão do DDL. O recebimento inicia suspenso. O campo opcional `<fusoHorario>` dentro de `<instituicao>` define o fuso (por exemplo, `America/Sao_Paulo`); se estiver ausente, usa UTC. Não usa o fuso do servidor como substituto.
6. Confirma a transação, libera a identificação pública da instituição e remove `startup.xml`. Se a exclusão falhar, o banco permanece instalado e um aviso pede remoção manual.

Se o schema já existir, a rotina verifica a presença das cinco tabelas, do registro de configuração com administrador referenciado e de ao menos um administrador ativo. Não reaplica DDL, não recria contas, não troca senhas e não executa migrações. Schema preexistente vazio, estrutura parcial ou carga inicial ausente provocam falha explícita, preservando os dados existentes e o startup para análise.

Se houver falha antes do commit, a rotina tenta rollback e preserva o startup. Schema, tabelas e cargas desta tentativa são transacionais. Se o commit tiver resultado indeterminado por falha de conexão, o startup também é preservado; na próxima inicialização, o estado do banco será verificado antes de qualquer instalação.

A ausência de `startup.xml` não impede reiniciar uma base instalada, desde que `configuracao.xml` esteja disponível. Para instalar uma base nova, o startup é obrigatório mesmo quando já houver configuração permanente.

Mensagens esperadas no log do Tomcat:

- `Webhook: instalacao concluida. Schema agforms, tabelas, Administrador e configuracao criados.`
- `Webhook: instalacao existente verificada. Nenhum dado inicial foi recriado.`
- Em falhas, uma etapa e, quando disponível, o SQLSTATE são informados sem SQL, credenciais ou stack trace. `42501` indica privilégio insuficiente; `28P01`, falha de autenticação; `W0001`, estrutura incompleta; `W0002`, carga inicial incompleta.

O arquivo permanente existente tem precedência sobre a conexão do startup. Para corrigir uma conexão anteriormente salva, parar a aplicação e preservar uma cópia dos arquivos antes de remover a configuração permanente e fornecer o startup corrigido. Não editar o conteúdo cifrado manualmente.

## Privilégios PostgreSQL para instalar

O database deve existir e o usuário configurado em `dbUser` precisa poder autenticar. Executar como proprietário do database ou administrador do PostgreSQL, substituindo os identificadores de exemplo:

```sql
GRANT CONNECT, CREATE ON DATABASE nome_database TO usuario_instalador;
```

`CREATE` no database permite ao instalador criar o schema `Agforms` (normalizado para `agforms`). Como o script será executado pelo próprio instalador, ele será proprietário do schema e das tabelas criadas, com os privilégios necessários para criar objetos, FKs e fazer SELECT, INSERT, UPDATE e DELETE. Não são necessários SUPERUSER, CREATEDB ou CREATEROLE. A configuração de rede e autenticação do PostgreSQL também precisa permitir a conexão a partir do servidor do webhook.

O script atual usa UUIDs fornecidos pela aplicação e não cria sequências. Não precisa de concessões para sequências ou de extensões PostgreSQL.

Se for adotado um usuário diferente para a operação cotidiana, após a criação do schema e tabelas, o proprietário pode conceder:

```sql
GRANT CONNECT ON DATABASE nome_database TO usuario_aplicacao;
GRANT USAGE ON SCHEMA Agforms TO usuario_aplicacao;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA Agforms TO usuario_aplicacao;
```

Essa separação ainda não foi implementada. Os comandos acima não foram executados. O SQL base permanece em `src/main/resources/banco/script_base_webhook.sql`, destinado à instalação inicial em uma única transação com a carga do Administrador e configuração; não deve ser reaplicado como migração.

Referências: [GRANT](https://www.postgresql.org/docs/current/sql-grant.html) e [CREATE SCHEMA](https://www.postgresql.org/docs/current/sql-createschema.html).

## Preservar a configuração entre builds e deploys locais

Para o contexto expandido usado pelo Tomcat nesta instalação, copiar manualmente o arquivo já gerado:

- Origem: `target/WebHookJUniAGForms/WEB-INF/configuracao.xml`.
- Destino permanente local: `src/main/webapp/WEB-INF/configuracao.xml`.

Caminho absoluto do destino neste workspace: `/Users/carlos/projetos/ArgousForms/WebHookJUniAGForms/src/main/webapp/WEB-INF/configuracao.xml`.

Na fase `package`, depois de `war:war`, a execução `copiar-configuracao-deploy-local` chama `npm run preparar-deploy`. Essa etapa copia explicitamente o XML local para o `WEB-INF` da aplicação expandida, pois a exclusão do plugin WAR impedia a cópia automática esperada. A cópia ocorre depois do empacotamento para não incluir credenciais no WAR. O log deve mostrar `Configuração local copiada para WEB-INF da aplicação expandida; WAR preservado.` O arquivo de origem não é apagado por `clean`. Ele já está ignorado no `.gitignore` da raiz. O POM mantém `packagingExcludes` para que a cópia não entre no WAR distribuível. Para implantar pelo WAR em outro servidor, fornecer esse arquivo localmente ao diretório expandido; não distribuir a configuração desta instalação.

Depois da instalação, não recolocar o startup: a conta está no banco e a conexão está no XML permanente. Manter uma cópia protegida do arquivo permanente antes de substituir a instalação. Usar permissões de acesso apenas para o usuário que executa o Tomcat e o administrador do ambiente.

## Autenticação administrativa

Endpoints sob `/api/autenticacao`:

| Método e caminho | Função |
| --- | --- |
| `POST /entrar` | Recebe `email` e `senha`; valida a conta ativa, cria a sessão e registra login na mesma transação. |
| `GET /sessao` | Recupera a sessão e informa se é obrigatória a troca de senha. |
| `GET /administracao` | Verifica acesso administrativo completo, recusando conta que ainda precise trocar a senha inicial. |
| `POST /senha` | Recebe `senhaAtual`, `novaSenha` e `confirmacao`; altera o hash, libera a conta, revoga outras sessões e audita numa transação. |
| `POST /sair` | Revoga a sessão, registra saída e remove o cookie. |

Os POSTs utilizam `application/x-www-form-urlencoded`, corpo limitado a 16 KiB e cabeçalho `X-Webhook-Admin: 1`. Não há CORS habilitado. Requisições explicitamente marcadas como cross-site são recusadas. Todos exigem User-Agent não vazio. As credenciais são enviadas apenas no corpo; não aparecem em URLs ou logs.

O cookie `WH_AGFORMS_SESSAO` utiliza HttpOnly, SameSite=Strict, Path do contexto e Secure sob HTTPS. O token tem 32 bytes aleatórios; somente SHA-256 em hexadecimal é armazenado no PostgreSQL. Não é devolvido no JSON nem persistido pelo frontend em localStorage ou sessionStorage. Cada login cria novo token, sem aceitar um identificador de sessão escolhido pelo cliente.

As sessões usam a validade fixa configurada em `NR_MINUTOS_VALIDADE_SESSAO` (padrão do DDL: 30 dias), sem renovação móvel. Contas inativas, sessões expiradas ou revogadas são recusadas em cada operação. A recuperação do cookie ao reabrir a página consulta a sessão no servidor; não autoriza apenas por estado local.

A senha atual é exigida para a troca, inclusive no primeiro acesso. A nova senha deve diferir da atual, ter de 8 a 1024 caracteres e atender a pelo menos três categorias: maiúsculas, minúsculas, números e símbolos. A confirmação deve coincidir. A alteração mantém a sessão em uso e revoga as outras sessões vigentes da conta. PBKDF2-HMAC-SHA-256 usa o mesmo formato gerado na instalação. Os eventos de login, logout e troca usam, respectivamente, os códigos `0`, `1` e `2` em `ACOES_ADMINISTRATIVAS`, sem incluir senhas ou hashes no JSON de detalhes.

Há limite local de 10 chamadas de login/troca de senha por IP a cada cinco minutos, com retorno HTTP 429. O controle fica na memória desta aplicação e reinicia com ela; clientes que precisarem de proteção distribuída podem complementar no proxy. O IP é o observado pelo Servlet, sem confiar automaticamente em X-Forwarded-For.

HTTPS é exigido na implantação. HTTP é aceito para testes em loopback (`localhost`/`127.0.0.1`/`::1`, com origem também loopback). Para testes de desenvolvimento por outro endereço, iniciar o Tomcat explicitamente com `-Dwebhook.http.desenvolvimento=true`; não usar essa opção na implantação. Atrás de proxy TLS, configurar o Tomcat para reconhecer corretamente as conexões seguras, sem confiar em cabeçalhos arbitrários do cliente.

Todos os futuros endpoints administrativos devem chamar `AutenticacaoService.consultarSessao(token, false)` antes de executar ações. Somente consulta da própria sessão, troca da senha e saída podem aceitar uma conta com troca obrigatória pendente. O serviço não cria papéis ou perfis. Após o acesso, a central administrativa oferece Visão geral, Transações, Estatísticas, Administradores, Atividade administrativa e Configurações. O processamento das consultas e a limpeza automática por retenção continuam pendentes. Consulte [ADMINISTRACAO.md](ADMINISTRACAO.md) para telas, regras e serviços implementados.

Referências: [gestão de sessões OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html) e [proteção CSRF para APIs](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html).

## Build e execução

O Maven inclui o frontend no WAR. No Eclipse, executar Maven Update Project e depois `clean package`, com Java 21, Node.js 22.13 ou superior e npm disponíveis. Implantar no Tomcat 11 com contexto `WebHookJUniAGForms` e acessar `/WebHookJUniAGForms/`.

Para desenvolver o frontend separadamente:

```sh
cd WebHookJUniAGForms/frontend
npm ci
npm run dev
```

Abrir `http://localhost:3003/WebHookJUniAGForms/`. A API é encaminhada ao backend em `http://localhost:8080/WebHookJUniAGForms`. Para outro endereço, definir `WEBHOOK_BACKEND_URL` no ambiente do Vite. Sem backend/configuração disponível, a página mostra o estado de instalação pendente.

O teste de leitura do XML pode ser compilado com o JDK junto de `ConfiguracaoInicial.java` e executado pela classe `br.com.webhook.configuracao.ConfiguracaoInicialTest`. Ele verifica leitura válida, ausência, ambiguidade, limite de tamanho, XML inválido e rejeição de DTD/entidades.

## Validações automatizadas

`InstalacaoBancoTest` é um teste de integração executável com Java 21. Usa exclusivamente um PostgreSQL descartável em `127.0.0.1`, database fixo `webhook_instalacao_teste` e usuário fictício `instalador`, sem SUPERUSER. Não lê startup ou credenciais desta instalação. A porta é recebida por `WEBHOOK_TEST_PORT`.

O teste cria e remove o schema desse database descartável para verificar carga inicial, hash da senha, reinicialização sem startup, não sobrescrita de conta, concorrência e recusa de estruturas parciais. O modo `rollback` exige um recurso SQL de teste com uma restrição que provoque falha na inclusão da configuração, verificando o rollback do DDL e a preservação do startup. Nunca executar esse teste contra um database de uso real.

`AutenticacaoTest` utiliza o mesmo PostgreSQL descartável local para verificar credenciais válidas e inválidas, token armazenado somente como hash, troca obrigatória aplicada pelo backend, política de senha, revogação das outras sessões, expiração, conta inativa, logout e rollback quando a auditoria falha. Também exercita o Servlet para verificar cookies, cabeçalho administrativo, User-Agent, exigência de HTTPS, acesso restrito e resposta sem tokens. Não utiliza credenciais da instalação real.

`npm test` no frontend verifica a preparação do deploy com arquivos fictícios: cópia e atualização da configuração, preservação do arquivo de origem e do WAR já gerado, permissões de destino, ausência de configuração local e recusa de origem simbólica. A execução isolada de `npm run preparar-deploy` exige que a aplicação expandida já exista; a execução normal é pelo Maven após o empacotamento.
