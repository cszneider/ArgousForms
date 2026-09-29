# ArgousDocs

Demonstração de montagem e execução de fluxos de documentos estruturados, com interface em Português (padrão), Inglês e Espanhol.

## Acesso e execução

Requer Node.js >= 22.13.

```sh
npm install
npm run dev
```

Tanto `npm run dev` quanto `npm start` usam a porta fixa **3002**. Acesse http://localhost:3002. Se a porta estiver ocupada, a execução falhará em vez de escolher outra porta automaticamente. A landing page fica em `/`, o login em `/login` e a ferramenta em `/app`.

- E-mail: `teste@argous.com.br`
- Senha: `123`

O acesso é uma **simulação**, sem autenticação real, API ou banco de dados. Não use dados reais/confidenciais nesta demonstração. O conteúdo é salvo no `localStorage` deste navegador; a sessão de teste, no `sessionStorage`. Pessoas, grupos e documentos não são compartilhados entre dispositivos. Limpar o armazenamento remove as alterações locais.

## Testar o fluxo completo

1. Entre e clique em **Novo documento**.
2. Selecione **Relatório de atendimento**, informe um título e inicie.
3. Como **Fellipe** ou **Ana Martins**, assuma a etapa de identificação, preencha os campos e conclua.
4. No seletor **Participante**, escolha **Lucas Ferreira**. Abra a pendência, assuma a avaliação técnica e conclua o preenchimento.
5. Troque para **Marina Costa**, abra e assuma a revisão, confira o documento e aprove. Também é possível devolver à etapa anterior com justificativa.
6. Acesse **Documento** para visualizar o consolidado ou **Imprimir / PDF** para usar a impressão do navegador e salvar em PDF.

Os seis exemplos iniciais incluem documentos em preenchimento, em revisão, devolvidos e finalizados.

## Funcionalidades

- Landing page e login de demonstração.
- Painel com contadores derivados dos documentos, pendências e movimentações recentes.
- Busca e filtros por status, modelo e grupo.
- Modelos com seções e campos reordenáveis: texto, texto longo, número, data, seleção e anexo.
- Campos obrigatórios e orientações de preenchimento.
- Fluxo sequencial com grupos, seções permitidas e etapas de preenchimento ou aprovação.
- Cadastro de grupos e participantes fictícios.
- Perfis de administrador, criador de modelos e participante.
- Atribuição exclusiva da etapa a um integrante, rascunhos, encaminhamento e devolução com motivo.
- Histórico de contribuições e cópia do modelo por documento. Edições criam nova versão para documentos futuros.
- PDF ou imagens PNG/JPEG/WebP de até 500 KB por campo de anexo, preservados localmente.
- Aviso de alterações não salvas e prevenção de sobrescrita de dados alterados por outra aba.
- Visualização final e impressão em A4.

A visibilidade de documentos é organizacional nesta primeira versão. A restrição por grupo controla a edição da etapa. As permissões são simuladas no cliente e devem ser implementadas no servidor quando houver autenticação real.

## Estrutura

A organização segue a separação do `interfaceargous`: telas em `interface`, módulos funcionais em `programas`, componentes compartilhados em `components`, estilos em `css` e utilitários em `utils`. O código fica concentrado em `src`.

```text
src/
├── app/                  # Adaptadores de rotas do Vinext: /, /login e /app
├── interface/
│   ├── landing/          # Página inicial pública
│   ├── login/            # Tela e formulário de acesso
│   └── argous/           # Workspace, navegação, listagens e cadastros
├── programas/
│   ├── documentos/       # Preenchimento, histórico, regras e persistência
│   ├── modelos/          # Editor de seções, campos e etapas
│   └── dashboard/        # Tela de indicadores e cálculos analíticos
├── components/
│   ├── theme/            # Tema Material UI e alternância claro/escuro
│   ├── i18n/             # Contexto React e seletor de idioma
│   └── ui/               # Componentes de base do scaffold
├── css/                  # Estilos globais, temas e impressão
├── hooks/                # Hooks compartilhados
└── utils/
    └── i18n/             # Catálogo, tradução e preferência de idioma
public/                   # Arquivos públicos servidos diretamente
tests/                   # Testes de regras, indicadores, tempos e idiomas
```

### Onde alterar

| Manutenção | Arquivo principal |
| --- | --- |
| Navegação, documentos, grupos e pessoas | `src/interface/argous/workspace.js` |
| Preenchimento, revisão e documento final | `src/programas/documentos/document-view.js` |
| Desenho do fluxo e histórico | `src/programas/documentos/process-flow.js` |
| Validação e transições do documento | `src/programas/documentos/domain.js` |
| Persistência local e dados iniciais | `src/programas/documentos/storage.js` e `seed.js` |
| Medição de gargalos | `src/programas/documentos/stage-timing.js` |
| Editor de modelos | `src/programas/modelos/template-editor.js` |
| Página e cálculos dos dashboards | `src/programas/dashboard/dashboards.js` e `dashboard.js` |
| Textos traduzidos | `src/utils/i18n/translations.js` |
| Aparência e impressão | `src/css/globals.css` e `color-modes.css` |

As pastas de `src/app` são apenas as entradas exigidas pelo roteador. Mantenha as telas em `interface` e os recursos específicos em `programas`. Código compartilhado vai em `components`, `hooks` ou `utils`; regras de documentos ficam junto ao módulo que as utiliza.

O alias `@/` aponta para `src/`. Os testes usam caminhos relativos com extensão `.js` para execução direta pelo Node. As configurações de ferramentas continuam na raiz, assim como no projeto de referência. Arquivos gerados em `dist`, `.next` e `node_modules` não são código a manter.

Esta reorganização altera caminhos e imports, mantendo as rotas, regras de negócio, chaves de armazenamento, idiomas e temas. `npm start` e `npm run dev` continuam usando a porta **3002**.

React **19.2.8**, Material UI **9.4.0**, JavaScript (com JSX) e Vinext/Vite. O catálogo Shadcn acompanha o scaffold Sites; a interface ArgousDocs usa MUI conforme solicitado. Referências: [React](https://react.dev/versions) e [Material UI 9](https://mui.com/material-ui/migration/upgrade-to-v9/).

## Verificação e distribuição

```sh
npm test
npm run build
```

A configuração gera uma versão estática em `dist/client`. Esta cópia funciona de forma independente da hospedagem Sites; o login continua sendo uma demonstração local, sem integração com o backend Java.

Foram verificados os testes de domínio, a conversão para JavaScript, a exportação das páginas e respostas HTTP de landing, login e ferramenta. Não foi realizada interação automatizada ou inspeção visual no navegador nesta entrega.

O suporte opcional a WebMCP registra listagem e abertura de documentos quando `document.modelContext` está disponível. Usa o mesmo estado da interface, valida os parâmetros e remove os registros ao desmontar. Não havia contexto WebMCP disponível para validar os contratos em execução; esse suporte não é necessário para usar a aplicação.

## Evolução prevista

Autenticação real, API, autorização no servidor, banco de dados e armazenamento compartilhado de anexos. Fluxos condicionais/paralelos e assinatura eletrônica ficam fora desta primeira demonstração.

## Idiomas

Use o seletor no topo da landing page, login ou ferramenta. A preferência fica salva em `argousdocs:language` no navegador. Datas, números, mensagens e componentes acompanham o idioma escolhido. Títulos, campos, conteúdo e observações escritos pelos usuários são preservados.

Os catálogos ficam em `src/utils/i18n/translations.js`, com interpolação em `src/utils/i18n/i18n.js` e contexto React em `src/components/i18n/i18n.js`. Não traduza identificadores usados em filtros ou registros persistidos.

Os componentes React e as regras usam arquivos `.js`. O Vite interpreta JSX nesses arquivos; o `jsconfig.json` configura o editor e o alias `@/`. Novos componentes devem seguir a mesma extensão. Os testes são executados diretamente pelo Node, sem remoção de tipos TypeScript.

## Componentes reutilizáveis Argous

Os oito componentes importados do interfaceargous estão em `src/components/componentesCriadosViaPrototipo`, em arquivos `.js`. Consulte [os exemplos de uso e contratos](src/components/componentesCriadosViaPrototipo/README.md). O índice da pasta exporta `ArgousDatePicker`, `ArgousSimpleCard`, `ArgousScrolling`, `SeletorLateralDePerfis`, `ArgousBar`, `ArgousHorizontalBar`, `ArgousLine` e `ArgousDoughnut`.

## Editor de documentos e modelos importados

Em **Documentos → Novo documento → Criar no editor ou importar modelo**, crie um modelo com texto formatado, imagens, tabelas, cabeçalho e rodapé. Configure as seções e os grupos nas abas existentes e use **Salvar e criar documento**. Os campos inseridos no texto recebem os valores preenchidos durante o fluxo. Campos não inseridos aparecem ao final do documento.

- **PDF (recomendado para fidelidade visual):** mantém o original e permite posicionar campos sobre suas páginas. Todos os campos devem estar posicionados antes de salvar. A exportação incorpora os valores em uma cópia do PDF; textos que não cabem ou caracteres não suportados geram um aviso.
- **Word (.docx):** converte o conteúdo para edição. Revise fontes, paginação, imagens, cabeçalhos e rodapés; a conversão não garante a aparência original.
- Os arquivos podem ter até 20 MB; PDFs, até 50 páginas. Imagens inseridas no editor podem ter até 400 KB; o conteúdo do modelo, até 2 MB. A disponibilidade de armazenamento do navegador também limita o salvamento.
- Assinaturas são imagens PNG/JPEG/WebP e não constituem assinatura com certificado digital.
- Os originais ficam no IndexedDB deste navegador. Documentos guardam uma cópia do modelo e a referência ao original daquela versão. Não existe sincronização de arquivos entre máquinas; limpar os dados do navegador remove esses arquivos.
- Documentos criados no editor podem ser impressos ou salvos como PDF pelo diálogo de impressão. Modelos PDF possuem o botão **Baixar PDF preenchido**.
