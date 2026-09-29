# Componentes importados do interfaceargous

Origem: `interfaceargous/src/components/componentesCriadosViaPrototipo`. Cada componente usa `index.js`, com JSX, e pode ser importado diretamente ou pelo índice desta pasta.

```js
import {
  ArgousDatePicker,
  ArgousSimpleCard,
  ArgousScrolling,
  SeletorLateralDePerfis,
  ArgousBar,
  ArgousHorizontalBar,
  ArgousLine,
  ArgousDoughnut,
} from '@/components/componentesCriadosViaPrototipo/index.js';
```

## Exemplos

```jsx
// Em um componente React com useState:
const [date, setDate] = useState(null);
const [profile, setProfile] = useState(null);

<ArgousDatePicker
  label="Data de início"
  value={date}
  onChange={setDate}
  format="DD/MM/YYYY"
  clearable
  disableFuture
/>

<ArgousSimpleCard title="Documentos" value={42} />

<ArgousScrolling
  items={[{ id: 1, title: 'Atendimento', subtitle: 'Equipe responsável' }]}
  selectedItem={profile}
  onItemClick={setProfile}
  onAdd={abrirCadastro}
  onItemAction={alterarPerfil}
/>

<ArgousBar
  title="Documentos por etapa"
  labels={['Preenchimento', 'Revisão']}
  datasets={[{ label: 'Documentos', data: [8, 3], backgroundColor: '#12665b' }]}
/>
```

## Contratos e adaptações

- **ArgousDatePicker**: mantém o contrato original. Aceita Moment, Date e strings válidas; `onChange` e `onAccept` recebem Moment ou `null`. Para campos de documentos, converta com `value?.format('YYYY-MM-DD') || ''` antes de persistir. Aceita `minDate`, `maxDate`, `disablePast`, `disableFuture`, `shouldDisableDate`, `keyboardInput` e competência (`format="MM/YYYY"`). O formato padrão permanece `DD/MM/YYYY`; passe `MM/DD/YYYY` quando necessário. Os nomes de meses/dias e ações seguem o idioma. Para personalizar o TextField use `slotProps` do MUI atual.
- **ArgousScrolling**: pesquisa local ou `onSearch` com espera de 300 ms, carregamento de mais itens durante a rolagem, seleção e ações. Use `itemAction="none"` para ocultar a ação. Os dados de exemplo originais aparecem apenas quando `items` é omitido; forneça `items={[]}` para uma lista vazia.
- **SeletorLateralDePerfis**: especialização de ArgousScrolling sem ação de exclusão. Agora recebe os mesmos dados, seleção e callbacks; não altera perfis da aplicação sozinho.
- **ArgousSimpleCard**: mantém `title`, `value`, `gradient`, `backgroundColor` e `opacity`.
- **Gráficos**: preservam `labels`, `datasets`, `data`, `title`, `subtitle`, `height`, `card`, `cardProps`, `showLegend`, `legendPosition`, `showGrid`, `numberDisplayType` e as opções específicas de cada componente. Quantidades, decimais e percentuais seguem o idioma; moeda mantém BRL, como na origem. O adaptador `shared/chart-options.js` converte as opções antigas usadas pelos componentes (`legend`, `xAxes`/`yAxes`, `ticks`, `gridLines`, `cutoutPercentage`) para Chart.js 4. Opções avançadas externas do Chart.js 2 devem ser revisadas antes do uso; não é um adaptador universal de versões.

Dependências antigas de Material UI e `argous/dist/utils` foram substituídas por MUI 9, Lucide e um adaptador local. Os gráficos usam Chart.js 4, react-chartjs-2 5 e chartjs-plugin-datalabels 2; as datas usam Moment para manter o contrato existente.

Utilize dentro dos provedores de tema e idioma já presentes no layout do ArgousDocs. Os nomes e dados enviados pelas telas não são traduzidos automaticamente. A importação disponibiliza os componentes para uso e não substitui as telas existentes.
