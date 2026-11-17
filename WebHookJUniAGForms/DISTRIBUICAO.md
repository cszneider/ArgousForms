# Distribuição do projeto de exemplo

## Arquitetura aprovada

- Um único projeto Maven, com frontend em `frontend/` e implantação em um único WAR.
- `br.com.webhook` é o pacote pai da parte comum, incluindo o contrato abstrato do Adaptador ERP.
- A implementação específica do jUni ficará em `br.com.erp.juni`, sob o pacote `br.com.erp`.
- O exemplo fornecido aos clientes deve funcionar sem fontes, bibliotecas, configuração ou acesso ao jUni.

## Cuidados obrigatórios ao preparar a distribuição

A distribuição deve ser preparada em uma cópia separada. Não apagar nem modificar os fontes específicos do jUni mantidos neste workspace para produzir o exemplo.

Antes de entregar o projeto ao cliente:

- Excluir os fontes específicos de `br.com.erp.juni` e seus testes ou recursos específicos.
- Remover `jUniBase` e Quatro do POM distribuído, inclusive dependências transitivas que mantenham vínculo com o jUni.
- Incluir um Adaptador ERP demonstrativo, com dados fictícios, e configurar sua seleção no exemplo.
- Preservar a parte comum, o frontend, o DDL PostgreSQL e as instruções de implementação do adaptador.
- Excluir credenciais, chaves HMAC, senhas, configurações locais, logs, históricos de transações e dados reais. Isso inclui `WEB-INF/startup.xml`, `WEB-INF/configuracao.xml` e temporários `.configuracao-*.tmp`, mesmo que seu conteúdo esteja cifrado.
- Gerar os artefatos a partir da cópia preparada, sem reaproveitar `target/` ou um WAR da instalação jUni.
- Conferir o conteúdo do projeto entregue e do WAR para garantir a ausência de classes, recursos e bibliotecas específicos do jUni e de segredos.
- Validar o build e a execução do exemplo sem acesso ao jUni ou a seus serviços internos.
- Documentar a configuração externa de segredos, a proteção da administração e o uso obrigatório de HTTPS na implantação; HTTP fica restrito aos testes de desenvolvimento.

O mecanismo automatizado de preparação dessa cópia ainda não foi implementado. A separação por pacotes, sozinha, não exclui fontes ou dependências da distribuição.
