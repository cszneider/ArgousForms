# Central administrativa do webhook

## Telas implementadas

Após autenticar e concluir a troca obrigatória da senha, a interface abre a Visão geral com menu lateral. Em telas pequenas, o menu é recolhido e pode ser aberto pelo botão superior.

| Tela | Recursos |
| --- | --- |
| Visão geral | Total de consultas, sucessos, falhas técnicas, tempo médio, evolução diária, configuração em uso e últimas transações do período. |
| Transações | Filtros por período, código exato e resultado; paginação e detalhes da chamada. |
| Estatísticas | Evolução diária, horários de maior atividade, distribuição dos resultados e até dez códigos com maior volume. |
| Administradores | Busca, cadastro, edição de nome e e-mail, ativação e desativação. |
| Atividade administrativa | Filtros por período, ação e administrador; paginação e detalhes dos eventos registrados. |
| Configurações | Edição do fuso, validade das novas sessões e prazos de retenção, com confirmação e auditoria. |

Os dados vêm do PostgreSQL da base comum. Não há preenchimento de demonstração na aplicação. Ausência de registros mostra estado vazio; falha de API mostra erro, sem apresentar zero como se fosse uma consulta bem-sucedida.

O processamento GET_DATA e a limpeza automática por retenção ainda não estão implementados. O estado do recebimento é apresentado como informação de configuração, sem comando que simule um serviço operacional. Os registros existentes já podem ser consultados.

## Filtros, métricas e horários

- O intervalo inicial é de sete dias, incluindo o dia atual no fuso institucional.
- As datas inicial e final são inclusivas no calendário da instituição. O backend converte seus limites em instantes e usa limite final exclusivo no dia seguinte, respeitando as regras do fuso.
- Cada consulta admite até 366 dias. Listagens têm vinte registros por página, com ordenação por data e UUID para desempate.
- Sucessos correspondem a `O`; não encontrados, a `N`; falhas técnicas incluem `F` e `I`; recusas ou suspensão incluem `R` e `S`. Registros `P` permanecem no total.
- A média considera as transações com duração registrada no período. Sem duração disponível, a interface mostra um traço, não zero.
- O gráfico por hora agrega o período inteiro no fuso institucional. Dias e horas sem chamadas recebem zero somente após uma consulta bem-sucedida.
- UUID de requisição serve para correlação; não é o ID de Processo. O contrato vigente não fornece ID de Processo.

## Administradores

Todos têm a mesma autoridade, sem papéis ou perfis. A inclusão exige nome, e-mail único normalizado em minúsculas e senha temporária com a política de segurança vigente. A senha temporária não é devolvida pela API e a conta exige troca no primeiro acesso.

A manutenção não oferece exclusão física nem alteração da senha de outra pessoa. A troca da própria senha continua no menu da conta, com validação da senha atual. Reativar uma conta não restaura sessões revogadas.

Desativar uma conta revoga suas sessões na mesma transação e registra o evento. O último administrador ativo não pode ser desativado. Se houver outro ativo, o administrador pode desativar a própria conta, com aviso explícito e encerramento de sua sessão.

As escritas administrativas são serializadas por uma trava transacional no PostgreSQL. Antes de gravar uma edição, o servidor confere a revisão dos dados que o operador abriu. Alterações concorrentes retornam conflito e exigem atualizar e reabrir o registro.

Eventos de criação, alteração, ativação, desativação e configuração usam os códigos `3`, `4`, `5`, `6` e `9`, respectivamente. Senhas e hashes nunca entram nos detalhes da auditoria. A gravação da ação e a alteração correspondente pertencem à mesma transação; uma falha na auditoria reverte a alteração.

## Configurações

O fuso deve ser reconhecido pelo Java e pelo PostgreSQL. A validade das novas sessões deve ser maior que dez minutos; retenções devem ser positivas. O limite superior numérico é o INTEGER do DDL.

Alterar a validade não reescreve o vencimento das sessões existentes. Configurar retenção não executa limpeza: esse serviço permanece pendente. As sessões referenciadas em ações administrativas continuam protegidas pelas FKs existentes.

A API não expõe nem modifica credenciais PostgreSQL, chave de cifragem ou conteúdo dos XMLs locais.

## Serviços

As rotas ficam sob `/api/administracao/*` e exigem sessão válida de administrador ativo, com troca de senha já concluída. A verificação ocorre dentro da transação da operação. POSTs exigem o cabeçalho administrativo e as mesmas regras de transporte/User-Agent da autenticação.

| Método | Rota | Função |
| --- | --- | --- |
| GET | `/resumo` | Indicadores, séries, configuração pública e últimas transações. |
| GET | `/estatisticas` | Agregações por dia, hora, resultado e código. |
| GET | `/transacoes` | Histórico paginado com filtros. |
| GET | `/transacao?id=...` | Detalhes de uma transação. |
| GET / POST | `/administradores` | Listagem / gravação de conta. |
| GET | `/atividade` | Histórico de ações paginado. |
| GET / POST | `/configuracao` | Consulta / gravação dos parâmetros operacionais. |

O SQL usa parâmetros e JDBC, sem Quatro ou acesso ao jUni. A implementação utiliza as tabelas já aprovadas; não requer migração ou recriação do banco.

## Verificação e execução

Os testes Java em PostgreSQL descartável verificam agregações e fuso, filtros parametrizados, paginação, cadastro, revisões, rollback da auditoria, revogação e proteção concorrente do último administrador. Os testes HTTP verificam recusa de acesso anônimo, troca obrigatória e proteção dos POSTs. Os testes Node verificam as séries do frontend e a preparação do deploy.

Para carregar os novos serviços Java no ambiente, gerar `package` pelo Eclipse e reiniciar/reimplantar a aplicação no Tomcat. O Vite atualiza os fontes do frontend, mas não recompila nem reimplanta o backend. Preservar a configuração local conforme `INSTALACAO.md`.
