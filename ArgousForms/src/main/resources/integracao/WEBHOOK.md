# Como fornecer dados ao ArgousForms

Este guia é para quem vai conectar o sistema da instituição ao ArgousForms. Você disponibiliza um endereço no sistema da instituição; quando o ArgousForms precisa de uma informação, envia uma consulta a esse endereço e recebe os dados na resposta. Chamamos esse endereço de **webhook**.

Por exemplo, um formulário pode precisar do nome e do setor de um funcionário a partir do e-mail dele. O ArgousForms envia o código `DADOS_FUNCIONARIO` e o e-mail. Seu webhook consulta o cadastro da instituição e devolve os campos encontrados. A instituição define quais códigos oferecer, quais informações cada um recebe e quais dados devolve. Nesta versão, o ArgousForms usa a ação `GET_DATA` para fazer essas consultas.

## O caminho de uma consulta

1. O ArgousForms envia uma requisição HTTPS com o código da consulta e seus parâmetros em JSON.
2. Seu webhook confere se a requisição veio do ArgousForms. Para isso, verifica uma **assinatura HMAC**, calculada com uma chave secreta conhecida pelos dois sistemas.
3. Seu webhook consulta o sistema da instituição e monta uma resposta JSON com os dados ou com a indicação de que não encontrou o registro.
4. Seu webhook assina a resposta com a mesma chave e a envia. O ArgousForms confere essa assinatura antes de usar os dados.

O administrador da instituição cadastra a URL principal do webhook e, se necessário, uma URL alternativa. Ambas devem atender às mesmas consultas. As seções seguintes mostram exatamente o que enviar e receber; os detalhes para calcular a assinatura estão mais adiante.

## Antes de implementar

1. Combine com a pessoa responsável pela integração na instituição a entrega de uma **chave secreta compartilhada**. Ela deve ser exclusiva desta instalação, ter pelo menos 32 bytes aleatórios e ser entregue por um canal seguro. A chave é apresentada em **Base64**, uma forma de representar bytes como texto. Você usará a mesma chave em todas as chamadas; ela **não é criada por requisição**.
2. Proteja a chave no ambiente do webhook. Não a grave no código-fonte, na URL, em respostas nem em logs. O cadastro de chaves no ArgousForms está sendo preparado para permitir sua geração por um administrador da instituição ou por um usuário com papel `DESENVOLVEDOR`. A chave será exibida apenas no momento da geração; não haverá consulta posterior do valor. Até essa função estar disponível, a entrega deve ser coordenada com a equipe responsável pela instalação.
3. Publique um endereço HTTPS que aceite requisições `POST`. Você escolhe o caminho, desde que ele corresponda à URL cadastrada no ArgousForms. Mantenha o relógio do servidor sincronizado: as assinaturas incluem o horário e aceitam uma diferença de até cinco minutos.
4. Implemente os códigos que a instituição deseja oferecer. Por exemplo, `DADOS_FUNCIONARIO` pode consultar um funcionário por e-mail. O significado desse código e os campos retornados são definidos pela instituição.

### Quando for necessário trocar a chave

O cadastro permitirá preparar uma nova chave antes de colocá-la em uso. Configure-a no webhook e combine a troca com quem administra a integração no ArgousForms. A ativação da nova chave encerrará o uso da anterior para **novas chamadas** no mesmo momento; respostas a chamadas já enviadas continuarão sendo verificadas com a chave usada no envio. A chave poderá ter uma data de vencimento ou ficar sem vencimento mediante confirmação e alerta de segurança. Uma chave invalidada não poderá voltar a ser usada. Se o valor de uma chave for perdido, será preciso gerar outra: o ArgousForms não o exibirá novamente.

## O que seu webhook recebe

No exemplo abaixo, o ArgousForms pede os dados do funcionário cujo e-mail é `ana@example.com`. O trecho acima da linha em branco contém os **cabeçalhos HTTP**; abaixo está o **corpo JSON** da requisição.

```http
POST /integracao HTTP/1.1
Content-Type: application/json; charset=utf-8
X-Argous-Request-Id: 814e0c9d-8a41-4ca4-8b17-73f116fc92c9
X-Argous-Timestamp: 2026-11-11T12:00:00Z
X-Argous-Signature: <assinatura Base64>

{"acao":"GET_DATA","idRequisicao":"814e0c9d-8a41-4ca4-8b17-73f116fc92c9","idProtocolo":"0f742ae1-3dca-4744-889c-6eb4966c726f","codigo":"DADOS_FUNCIONARIO","parametros":{"email":"ana@example.com"}}
```

| Campo | Regra |
| --- | --- |
| `acao` | Ação solicitada. Atualmente, `GET_DATA`. |
| `idRequisicao` | Identificador único da consulta, no formato UUID. Repita-o na resposta; ele ajuda a localizar a mesma consulta nos registros dos dois sistemas. |
| `idProtocolo` | UUID do Protocolo, **quando houver**. Pode estar ausente na chamada direta da tela de teste. |
| `codigo` | Código da consulta. Começa com letra ASCII e tem no máximo 100 caracteres: letras, dígitos, `_`, `.` ou `-`. |
| `parametros` | Objeto JSON com os argumentos da consulta; pode ser `{}`. |

O cabeçalho `X-Argous-Request-Id` repete o `idRequisicao` do corpo. `X-Argous-Timestamp` informa o horário da chamada em UTC, no formato ISO-8601. A ordem das propriedades do JSON pode variar. Antes de converter o JSON em campos, guarde o **conteúdo original recebido**: seus bytes são necessários para conferir a assinatura.

## O que seu webhook devolve

Quando encontra os dados, responda com HTTP `200`. Repita o identificador da consulta, informe o horário da resposta e inclua a assinatura. O exemplo devolve nome e setor; seu sistema pode devolver outros campos, conforme o código da consulta.

```http
HTTP/1.1 200 OK
Content-Type: application/json; charset=utf-8
X-Argous-Request-Id: 814e0c9d-8a41-4ca4-8b17-73f116fc92c9
X-Argous-Timestamp: 2026-11-11T12:00:01Z
X-Argous-Signature: <assinatura Base64 da resposta>

{"idRequisicao":"814e0c9d-8a41-4ca4-8b17-73f116fc92c9","codigo":"DADOS_FUNCIONARIO","status":true,"dados":{"email":"ana@example.com","dsNome":"Ana Exemplo","dsSetor":"Contabilidade"},"validadeCacheEm":"2026-11-12T12:00:00Z"}
```

| Campo | Regra |
| --- | --- |
| `idRequisicao` | Obrigatório; igual ao da requisição. |
| `codigo` | Obrigatório; igual ao da requisição. |
| `status` | Obrigatório; booleano JSON `true` ou `false`, nunca texto. |
| `dados` | Obrigatório quando `status` é `true`; deve ser um **objeto JSON**, inclusive se contiver um único valor. Pode ter objetos e listas aninhados. |
| `validadeCacheEm` | Opcional; data e hora até as quais o ArgousForms pode **reutilizar essa resposta sem chamar novamente seu webhook**. Use UTC no formato ISO-8601. Sem esse campo, cada consulta vai ao webhook. |

O corpo da resposta não pode exceder **1.048.576 bytes**. A chamada inteira tem tempo limite de **10 segundos**. O ArgousForms rejeita respostas malformadas, sem assinatura válida ou com identificador/código divergentes.

### Quando o registro não existe

Se a consulta chegou corretamente, mas o funcionário não foi encontrado, responda HTTP `200` com `status:false` e uma explicação. Assine essa resposta da mesma forma que a de sucesso:

```json
{
  "idRequisicao": "814e0c9d-8a41-4ca4-8b17-73f116fc92c9",
  "codigo": "DADOS_FUNCIONARIO",
  "status": false,
  "erro": {"codigo": "NAO_ENCONTRADO", "mensagem": "Funcionário não encontrado"}
}
```

Se a própria requisição for inválida, por exemplo, se a assinatura estiver errada, rejeite-a com HTTP `4xx`. Se seu serviço estiver indisponível, responda HTTP `5xx`. O ArgousForms tenta a URL alternativa somente quando a principal não responde por falha de rede, demora além do limite ou HTTP `5xx`. Ele não tenta a alternativa para `status:false` ou HTTP `4xx`.

A alternativa pode receber a **mesma consulta com o mesmo identificador**. Se seu webhook registrar ações além da leitura, garanta que repetir o identificador não execute a ação duas vezes. Uma resposta com `status:false` não é guardada no cache.

## Como conferir e criar as assinaturas

**HMAC-SHA-256** é o cálculo usado para criar a assinatura. Pense nela como um lacre: quem recebe a mensagem refaz o cálculo com a chave compartilhada e compara os resultados. Assim verifica que o conteúdo não mudou e que o remetente conhece a chave. O HTTPS continua obrigatório para proteger a comunicação.

Você precisa fazer dois cálculos: **verificar** a assinatura da requisição recebida e **criar** a assinatura da resposta enviada. Os exemplos de código em Java, Python e Node.js estão logo após as regras abaixo.

1. Calcule SHA-256 dos **bytes exatos** do corpo HTTP, isto é, do conteúdo original recebido ou do conteúdo exato que será enviado. Escreva o resultado em hexadecimal minúsculo.
2. Monte as cinco linhas abaixo com `\n` entre elas, **sem quebra de linha final**. Use `REQUISICAO` para verificar a chamada recebida e `RESPOSTA` para assinar a resposta.
3. Codifique esse texto em UTF-8. Calcule HMAC-SHA-256 com a chave compartilhada, previamente decodificada de Base64. Codifique o resultado em Base64 padrão no cabeçalho `X-Argous-Signature`.

```text
ARGOUS-HMAC-V1
REQUISICAO
<X-Argous-Request-Id>
<X-Argous-Timestamp>
<SHA-256 do corpo em hexadecimal minúsculo>
```

Na resposta, a segunda linha é `RESPOSTA`, o timestamp é o novo timestamp da resposta e o hash é do corpo da resposta. O ID permanece o mesmo. Use na assinatura o texto do timestamp **exatamente como consta no cabeçalho**. Confira UUID, igualdade entre o ID do cabeçalho e o do corpo, timestamp dentro de **300 segundos** do relógio atual e assinatura por comparação em tempo constante **antes** de consultar os dados.

Não serialize novamente o JSON recebido para conferir o HMAC: espaços, acentos e ordem das propriedades alteram os bytes. Para responder, serialize uma vez, assine os bytes produzidos e envie **esses mesmos bytes**.

### Java 21: cálculo e verificação

O exemplo usa apenas o JDK. Conecte as funções ao servidor HTTP e ao parser JSON da instituição.

```java
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import java.util.UUID;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

public final class ArgousHmac {
    private ArgousHmac() {}

    public static String assinar(String tipo, String id, String timestamp, byte[] corpo, byte[] chave) throws Exception {
        String hash = HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(corpo));
        String texto = String.join("\n", "ARGOUS-HMAC-V1", tipo, id, timestamp, hash);
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(chave, "HmacSHA256"));
        return Base64.getEncoder().encodeToString(mac.doFinal(texto.getBytes(StandardCharsets.UTF_8)));
    }

    public static void verificarRequisicao(String id, String timestamp, String assinatura, byte[] corpo, byte[] chave) throws Exception {
        UUID.fromString(id);
        if (chave.length < 32) throw new SecurityException("Chave HMAC curta");
        if (Math.abs(Duration.between(Instant.parse(timestamp), Instant.now()).toSeconds()) > 300)
            throw new SecurityException("Timestamp fora da janela");
        byte[] recebida = Base64.getDecoder().decode(assinatura);
        byte[] esperada = Base64.getDecoder().decode(assinar("REQUISICAO", id, timestamp, corpo, chave));
        if (!MessageDigest.isEqual(recebida, esperada)) throw new SecurityException("Assinatura inválida");
    }
}
```

Leia os bytes originais da requisição (em Servlet, `request.getInputStream().readAllBytes()`), obtenha os três cabeçalhos, chame `verificarRequisicao` e só então interprete o JSON. Confirme `idRequisicao` do corpo. Para responder, serialize o JSON em UTF-8 **uma vez**, gere `Instant.now().toString()`, calcule `assinar("RESPOSTA", id, timestampResposta, bytesResposta, chave)` e envie esses bytes. A chave pode ser recuperada do ambiente protegido do **webhook da instituição** com `Base64.getDecoder().decode(valor)`.

### Python 3: cálculo e verificação

O exemplo usa apenas a biblioteca padrão. `corpo` são os bytes brutos recebidos pelo servidor.

```python
import base64
import hashlib
import hmac
from datetime import datetime, timezone
from uuid import UUID

def assinar(tipo: str, identificador: str, timestamp: str, corpo: bytes, chave: bytes) -> str:
    hash_corpo = hashlib.sha256(corpo).hexdigest()
    texto = "\n".join(("ARGOUS-HMAC-V1", tipo, identificador, timestamp, hash_corpo))
    assinatura = hmac.new(chave, texto.encode("utf-8"), hashlib.sha256).digest()
    return base64.b64encode(assinatura).decode("ascii")

def verificar_requisicao(identificador: str, timestamp: str, assinatura: str, corpo: bytes, chave: bytes) -> None:
    UUID(identificador)
    if len(chave) < 32:
        raise ValueError("Chave HMAC curta")
    momento = datetime.fromisoformat(timestamp.replace("Z", "+00:00"))
    if momento.tzinfo is None or abs((datetime.now(timezone.utc) - momento).total_seconds()) > 300:
        raise ValueError("Timestamp fora da janela")
    recebida = base64.b64decode(assinatura, validate=True)
    esperada = base64.b64decode(assinar("REQUISICAO", identificador, timestamp, corpo, chave))
    if not hmac.compare_digest(recebida, esperada):
        raise ValueError("Assinatura inválida")
```

Depois da verificação, interprete `json.loads(corpo)` e confira `idRequisicao`, `acao`, `codigo` e `parametros`. Para assinar a resposta:

```python
import json
from datetime import datetime, timezone

resposta = {"idRequisicao": identificador, "codigo": pedido["codigo"],
            "status": True, "dados": {"dsNome": "Ana Exemplo"}}
bytes_resposta = json.dumps(resposta, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
timestamp_resposta = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
assinatura_resposta = assinar("RESPOSTA", identificador, timestamp_resposta, bytes_resposta, chave)
# Envie bytes_resposta com HTTP 200 e os três cabeçalhos X-Argous-*.
```

### Node.js: cálculo e verificação

O exemplo usa módulos nativos. `corpo` deve ser o `Buffer` recebido pelo servidor, antes do parser JSON.

```javascript
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

function assinar(tipo, id, timestamp, corpo, chave) {
  const hash = createHash('sha256').update(corpo).digest('hex');
  const texto = ['ARGOUS-HMAC-V1', tipo, id, timestamp, hash].join('\n');
  return createHmac('sha256', chave).update(texto, 'utf8').digest('base64');
}

function verificarRequisicao(id, timestamp, assinatura, corpo, chave) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))
    throw new Error('Request ID inválido');
  const momento = Date.parse(timestamp);
  if (!Number.isFinite(momento) || Math.abs(Date.now() - momento) > 300_000)
    throw new Error('Timestamp fora da janela');
  if (chave.length < 32) throw new Error('Chave HMAC curta');
  const recebida = Buffer.from(assinatura, 'base64');
  const esperada = Buffer.from(assinar('REQUISICAO', id, timestamp, corpo, chave), 'base64');
  if (recebida.length !== esperada.length || !timingSafeEqual(recebida, esperada))
    throw new Error('Assinatura inválida');
}

// Após verificar e interpretar o JSON:
const resposta = { idRequisicao: id, codigo: pedido.codigo, status: true,
  dados: { dsNome: 'Ana Exemplo' } };
const bytesResposta = Buffer.from(JSON.stringify(resposta), 'utf8');
const timestampResposta = new Date().toISOString();
const assinaturaResposta = assinar('RESPOSTA', id, timestampResposta, bytesResposta, chave);
// Envie bytesResposta com HTTP 200 e os três cabeçalhos X-Argous-*.
```

Os dados de `Ana Exemplo` são fictícios. Na implementação real, o código `DADOS_FUNCIONARIO` consulta o sistema da instituição e preenche `dados` com os nomes e tipos de campos acordados para esse código. Os trechos acima mostram a parte criptográfica; adapte a leitura e a escrita HTTP ao servidor usado pela instituição.

## Reutilização das respostas e teste na interface

Se o webhook informa `validadeCacheEm`, o ArgousForms pode guardar a resposta até esse horário. Nesse período, uma nova consulta com o **mesmo Protocolo, código e parâmetros** pode receber a resposta guardada, sem chamar o webhook. Processos do mesmo Protocolo compartilham esse resultado. Na tela de teste, deixar o Protocolo vazio faz uma chamada direta, sem consultar esse cache.

`validadeCacheEm` controla somente a reutilização da resposta. Uma data como `dtValidade` dentro de `dados` é dado de negócio e não altera a validade do cache. Valores já incorporados a um processo permanecem nos registros desse processo mesmo que o webhook passe a devolver outros dados.

Quem possui o papel `DESENVOLVEDOR` encontra em **Integração → Testar integração** uma chamada de `GET_DATA`: informa código e parâmetros JSON, escolhe opcionalmente o Protocolo e vê a resposta. Em **Integração → Cache**, pode inspecionar e invalidar uma entrada do Protocolo para forçar nova consulta.

### Como identificar uma chamada com problema

Use o `idRequisicao` para localizar a mesma consulta nos registros do webhook e do ArgousForms. Está prevista uma lista de consultas e tentativas de envio: uma consulta à URL principal e outra à alternativa, se houver, terão o **mesmo identificador**. Uma resposta vinda do cache será identificada sem aparecer como envio ao webhook.

Esse histórico guardará horários, usuário ou processo de origem, código consultado, destino, resultado e erro resumido. Não guardará o corpo completo da resposta nem a chave secreta. Poderá conter uma referência à entrada do cache, mas essa entrada pode expirar ou ser invalidada antes do histórico. A retenção inicial prevista é de **90 dias**, configurável pela instituição. Até a tela e o registro desse histórico estarem disponíveis, mantenha no webhook seus próprios registros de diagnóstico, sem incluir a chave nem dados pessoais desnecessários.

## Antes de entregar a integração

- O endpoint usa HTTPS e recebe `POST` com JSON UTF-8.
- A requisição é verificada sobre os bytes originais, com ID coincidente, timestamp recente e comparação segura da assinatura.
- A resposta `200` contém `idRequisicao`, `codigo`, `status` booleano e, em sucesso, `dados` como objeto JSON.
- A resposta repete o ID no cabeçalho, usa timestamp novo e assinatura do tipo `RESPOSTA` sobre os bytes enviados.
- A resposta não excede 1.048.576 bytes e é entregue em até 10 segundos.
- Ausência de registro é `status:false`; indisponibilidade técnica é HTTP `5xx`.
- Se configurada, a URL alternativa implementa os mesmos códigos, usa a mesma chave e aceita a repetição da consulta com o mesmo ID.
