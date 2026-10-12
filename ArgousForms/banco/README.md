# Banco de dados do ArgousForms

Este diretório reunirá os scripts SQL do ArgousForms, incluindo a criação das tabelas e as regras implementadas por restrições, funções e triggers. Os scripts deverão identificar claramente a versão da estrutura a que pertencem e a ordem em que devem ser executados.

Na recriação atual, as tabelas do esquema `Cadastro` serão criadas do zero; não há necessidade de preservar os dados existentes. `estrutura-exportada-2026-10-12.sql` preserva o DDL recebido do modelador e **não deve ser executado diretamente**. `preprocessar_ddl.py` lê os nomes de esquema das anotações `@Table` no JAR de fontes, qualifica as tabelas e reorganiza os `DROP TABLE` pelas chaves estrangeiras declaradas no export. O resultado está em `estrutura-inicial.sql`. A indicação "PostgreSQL 7" no cabeçalho veio do gerador; não expressa a versão mínima compatível com o DDL.

Para preparar novamente o SQL, a partir de `ArgousForms/`:

```sh
python3 banco/preprocessar_ddl.py banco/estrutura-exportada-2026-10-12.sql banco/estrutura-inicial.sql --sources-jar ~/.m2/repository/br/com/quatro/argous-forms/0.0.1/argous-forms-0.0.1-sources.jar
```

Para recriar manualmente o ambiente de desenvolvimento, executar nesta ordem:

1. `estrutura-inicial.sql`: recria as 25 tabelas do esquema `Cadastro` em uma transação; apaga os dados anteriores dessas tabelas. Ao final, concede a `carlos` acesso ao esquema, leitura e escrita nas tabelas e uso das sequências.
2. `validar-pais-identificacao.sql`: instala as triggers que impedem divergência entre o país da identificação e o país do tipo escolhido, inclusive em alterações posteriores do tipo.
3. `validar-aplicacoes-tags.sql`: exige que uma tag seja aplicável a grupo, usuário ou vínculo, permitindo qualquer combinação dessas opções. Em um banco já criado, executar o script manualmente; tags existentes com as três opções falsas precisam ser corrigidas antes.
4. `validar-alteracao-tags.sql`: impede a alteração do código da tag e a remoção de uma aplicação enquanto existirem vínculos ativos correspondentes. Também exige que vínculos de grupo criados ou reativados usem uma tag ativa e habilitada para grupos. Pode ser aplicado manualmente ao banco de desenvolvimento já criado; o script pode ser repetido para atualizar as funções e triggers.
5. `carga-manual-teste.sql`: carrega os 40 países definidos, a origem local de login e os papéis, perfis e vínculos padrão. É uma carga única para tabelas vazias; **não executar também** `perfis-papeis-iniciais.sql`.
6. `validar-papeis-perfis.sql`: depois de carregar os papéis e perfis padrão, protege seus códigos, situação, composição e exclusão. Preserva o histórico de atribuições e impede exclusão física de papéis e perfis já utilizados. Pode ser aplicado manualmente ao banco de desenvolvimento já carregado, pelo proprietário do esquema; não é executado pela aplicação.

O banco de desenvolvimento que recebeu a carga antiga e ainda não recebeu o ajuste de papéis deve executar somente `ajuste-papeis-perfis-2026-10-12.sql` para esta atualização. Esse script não recria tabelas nem recarrega os países; preserva os registros existentes e atribui `ESSENCIAL` a todos os usuários já cadastrados. Sua execução permanece manual, com o papel proprietário do esquema. Se o ajuste anterior já tiver sido executado com o nome antigo, o gestor renomeará manualmente esse perfil no banco, preservando seus vínculos.

A carga de teste não cria a instituição, o primeiro administrador ou tipos de identificação. Seus dados e procedimentos ainda precisam ser definidos. `CD_IDIOMA`, `CD_MOEDA`, `CD_TELEFONE` e `DS_CAPITAL` registram um valor principal para teste, não todas as opções de países multilíngues, multimoeda ou com mais de uma capital. A lista dos países segue os [35 Estados independentes das Américas da OEA](https://www.oas.org/ext/en/main/oas/member-states) e os cinco países adicionais aprovados. Códigos de país, moeda e telefone podem ser conferidos, respectivamente, nas referências da [ISO](https://www.iso.org/iso-3166-country-codes.html), do [Unicode CLDR](https://unicode.org/cldr/charts/48/supplemental/detailed_territory_currency_information.html) e da [UIT](https://www.itu.int/ITU-T/inr/nnp/index.html).

Os scripts de validação das tags não foram executados nesta etapa. A modelagem ainda não contém regras de banco para a atribuição inicial de tags a grupos, usuários e vínculos; essas regras dependem de definição funcional específica.

O DDL deve ser executado por um papel proprietário distinto de `carlos`. Os `GRANT`s não removem os poderes de um proprietário nem de um superusuário. As permissões padrão no fim da estrutura só alcançam tabelas e sequências criadas futuramente pelo mesmo papel que executou o DDL; se outro papel criar objetos em uma atualização, ele deverá configurar suas próprias permissões padrão ou conceder acesso aos objetos novos. `carlos` não recebe `CREATE` no esquema, `TRIGGER` nas tabelas nem privilégios para modificar objetos de estrutura.

No futuro, instalações em produção precisarão aplicar alterações de estrutura e de regras automaticamente, em ordem, sem perder dados. O mecanismo de migração, seu controle de versões e sua integração à instalação ainda serão definidos; não estão implementados nesta etapa. Até lá, não tratar a recriação destrutiva como procedimento de atualização de uma instalação em produção.
