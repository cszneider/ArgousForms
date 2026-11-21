-- Testes do número do processo (M-03) e dos prazos (M-01 b), 20/11/2026.
-- Executar como usuário com DML em Cadastro e Processos, com ao menos um usuário cadastrado e a instituição com fuso America/Sao_Paulo.
-- Os dados são temporários: a transação sempre termina em ROLLBACK. Cada linha do resultado começa com "ok" ou "FALHA".
BEGIN;

CREATE FUNCTION pg_temp.confere(nome text, obtido text, esperado text) RETURNS text LANGUAGE sql AS $f$
  SELECT CASE WHEN obtido IS NOT DISTINCT FROM esperado THEN 'ok    ' ELSE 'FALHA ' END || nome || ' -> ' || COALESCE(obtido, 'NULL')
         || CASE WHEN obtido IS DISTINCT FROM esperado THEN ' (esperado: ' || COALESCE(esperado, 'NULL') || ')' ELSE '' END;
$f$;

-- Prazos, calculados no fuso America/Sao_Paulo. 20/11/2026 é sexta-feira.
SET LOCAL TIME ZONE 'America/Sao_Paulo';
SELECT pg_temp.confere('2 dias úteis a partir de sexta 15h', Processos.calcular_limite('2026-11-20 15:00-03', 2, 'U')::text, '2026-11-24 23:59:59-03');
SELECT pg_temp.confere('1 dia útil a partir de sábado', Processos.calcular_limite('2026-11-21 10:00-03', 1, 'U')::text, '2026-11-23 23:59:59-03');
SELECT pg_temp.confere('5 dias úteis atravessando fim de semana', Processos.calcular_limite('2026-11-18 09:00-03', 5, 'U')::text, '2026-11-25 23:59:59-03');
SELECT pg_temp.confere('1 dia corrido a partir de sexta', Processos.calcular_limite('2026-11-20 15:00-03', 1, 'C')::text, '2026-11-21 23:59:59-03');
SELECT pg_temp.confere('5 horas', Processos.calcular_limite('2026-11-20 15:00-03', 5, 'H')::text, '2026-11-20 20:00:00-03');
SELECT pg_temp.confere('sem prazo', Processos.calcular_limite('2026-11-20 15:00-03', NULL, NULL)::text, NULL);

-- Protocolo publicado com prefixo e prazo de 2 dias úteis na etapa inicial.
CREATE FUNCTION pg_temp.montar(prefixo text) RETURNS uuid LANGUAGE plpgsql AS $f$
DECLARE u uuid; prot uuid := gen_random_uuid(); ver uuid := gen_random_uuid(); f1 uuid := gen_random_uuid(); f2 uuid := gen_random_uuid();
  a uuid := gen_random_uuid(); b uuid := gen_random_uuid(); e uuid := gen_random_uuid();
BEGIN
  SELECT ID_USUARIO_SISTEMA INTO u FROM Cadastro.USUARIOS_SISTEMA ORDER BY DT_INCLUSAO LIMIT 1;
  INSERT INTO Processos.PROTOCOLOS (ID_PROTOCOLO, ID_USUARIO_CRIADOR, DS_TITULO, DT_INCLUSAO, SN_ATIVO, CD_PREFIXO) VALUES (prot, u, 'Teste de número', now(), true, prefixo);
  INSERT INTO Processos.PROTOCOLO_VERSOES (ID_PROTOCOLO_VERSAO, ID_PROTOCOLO, NR_VERSAO, TP_SITUACAO, ID_USUARIO_ABRIU, ID_USUARIO_RESPONSAVEL,
         DT_INCLUSAO, DT_ALTERACAO, SN_PERMITE_CONVIDADOS, DS_TITULO, SN_GESTOR_FINALIZA)
  VALUES (ver, prot, -1, 'R', u, u, now(), now(), false, 'Teste de número', false);
  INSERT INTO Processos.PROTOCOLO_GESTORES_ELEGIVEIS (ID_GESTOR_ELEGIVEL, ID_PROTOCOLO_VERSAO, ID_USUARIO_SISTEMA) VALUES (gen_random_uuid(), ver, u);
  INSERT INTO Processos.FORMULARIOS (ID_FORMULARIO, ID_PROTOCOLO_VERSAO, DS_TITULO, DT_INCLUSAO) VALUES (f1, ver, 'A', now()), (f2, ver, 'B', now());
  INSERT INTO Processos.PROTOCOLOS_ETAPAS (ID_PROTOCOLO_ETAPA, ID_PROTOCOLO_VERSAO, TP_BLOCO, ID_FORMULARIO, DS_TITULO, NR_POSICAO_X, NR_POSICAO_Y, TP_RESULTADO_PADRAO, NR_PRAZO, TP_UNIDADE_PRAZO)
  VALUES (a, ver, 'E', f1, 'A', 0, 0, NULL, 2, 'U'), (b, ver, 'E', f2, 'B', 1, 0, 'P', NULL, NULL);
  INSERT INTO Processos.PROTOCOLO_ETAPA_DESTINATARIOS (ID_ETAPA_DESTINATARIO, ID_PROTOCOLO_ETAPA, ID_USUARIO_SISTEMA) VALUES (gen_random_uuid(), a, u), (gen_random_uuid(), b, u);
  INSERT INTO Processos.ENCAMINHAMENTOS (ID_ENCAMINHAMENTO, ID_PROTOCOLO_VERSAO, TP_ENCAMINHAMENTO, ID_PROXIMA_ETAPA) VALUES (e, ver, 'E', b);
  UPDATE Processos.PROTOCOLOS_ETAPAS SET ID_ENCAMINHAMENTO = e WHERE ID_PROTOCOLO_ETAPA = a;
  UPDATE Processos.PROTOCOLO_VERSOES SET NR_VERSAO = 1, TP_SITUACAO = 'P', ID_USUARIO_PUBLICOU = u, DT_PUBLICACAO = now() WHERE ID_PROTOCOLO_VERSAO = ver;
  RETURN ver;
END $f$;

CREATE FUNCTION pg_temp.iniciar(ver uuid, inicio timestamptz) RETURNS text LANGUAGE plpgsql AS $f$
DECLARE u uuid; p uuid := gen_random_uuid(); numero text;
BEGIN
  SELECT ID_USUARIO_SISTEMA INTO u FROM Cadastro.USUARIOS_SISTEMA ORDER BY DT_INCLUSAO LIMIT 1;
  INSERT INTO Processos.PROCESSOS (ID_PROCESSO, ID_PROTOCOLO_VERSAO, ID_USUARIO_INICIOU, TP_SITUACAO, DT_INICIO) VALUES (p, ver, u, 'E', inicio)
  RETURNING CD_NUMERO INTO numero;
  RETURN numero;
END $f$;

CREATE FUNCTION pg_temp.tenta(comando text) RETURNS text LANGUAGE plpgsql AS $f$
BEGIN
  BEGIN EXECUTE comando; RAISE EXCEPTION 'desfazer';
  EXCEPTION WHEN others THEN RETURN CASE WHEN SQLERRM = 'desfazer' THEN 'ACEITOU' ELSE 'RECUSOU: ' || SQLERRM END; END;
END $f$;

CREATE TEMP TABLE t ON COMMIT DROP AS SELECT pg_temp.montar('ZZTST') AS ver;
SELECT pg_temp.confere('1º processo de 2026 (anual)', pg_temp.iniciar(ver, '2026-11-20 15:00-03'), 'ZZTST-2026-000001') FROM t;
SELECT pg_temp.confere('2º processo de 2026', pg_temp.iniciar(ver, '2026-11-20 16:00-03'), 'ZZTST-2026-000002') FROM t;
SELECT pg_temp.confere('1º processo de 2027 recomeça', pg_temp.iniciar(ver, '2027-01-02 09:00-03'), 'ZZTST-2027-000001') FROM t;
UPDATE Processos.PROTOCOLOS SET TP_SEQUENCIA = 'C' WHERE CD_PREFIXO = 'ZZTST';
SELECT pg_temp.confere('sequência contínua não usa o ano', pg_temp.iniciar(ver, '2026-11-21 09:00-03'), 'ZZTST-000001') FROM t;
SELECT pg_temp.confere('número é imutável', left(pg_temp.tenta('UPDATE Processos.PROCESSOS SET CD_NUMERO = ''X'' WHERE CD_NUMERO = ''ZZTST-000001'''), 7), 'RECUSOU');
SELECT pg_temp.confere('prefixo repetido', left(pg_temp.tenta('SELECT pg_temp.montar(''ZZTST'')'), 7), 'RECUSOU');
SELECT pg_temp.confere('prefixo minúsculo', left(pg_temp.tenta('SELECT pg_temp.montar(''zz1'')'), 7), 'RECUSOU');
SELECT pg_temp.confere('publicar sem prefixo', pg_temp.tenta('SELECT pg_temp.montar(NULL)'), 'RECUSOU: Defina o prefixo do número dos processos antes de publicar o Protocolo.');

-- Prazo calculado ao inserir a etapa do processo.
WITH ins AS (
  INSERT INTO Processos.PROCESSO_ETAPAS (ID_PROCESSO_ETAPA, ID_PROCESSO, ID_PROTOCOLO_ETAPA, NR_PASSAGEM, TP_SITUACAO, DT_DISPONIBILIZACAO)
  SELECT gen_random_uuid(), pr.ID_PROCESSO, e.ID_PROTOCOLO_ETAPA, 1, 'D', '2026-11-20 15:00-03'
    FROM Processos.PROCESSOS pr JOIN Processos.PROTOCOLOS_ETAPAS e ON e.ID_PROTOCOLO_VERSAO = pr.ID_PROTOCOLO_VERSAO AND e.NR_PRAZO = 2
   WHERE pr.CD_NUMERO = 'ZZTST-2026-000001'
  RETURNING DT_LIMITE)
SELECT pg_temp.confere('limite gravado na etapa (2 dias úteis)', (SELECT DT_LIMITE FROM ins)::text, '2026-11-24 23:59:59-03');

-- Restrição de prazo da etapa (rascunho).
CREATE TEMP TABLE r ON COMMIT DROP AS SELECT gen_random_uuid() AS prot, gen_random_uuid() AS ver, gen_random_uuid() AS form,
  (SELECT ID_USUARIO_SISTEMA FROM Cadastro.USUARIOS_SISTEMA ORDER BY DT_INCLUSAO LIMIT 1) AS u;
INSERT INTO Processos.PROTOCOLOS (ID_PROTOCOLO, ID_USUARIO_CRIADOR, DS_TITULO, DT_INCLUSAO, SN_ATIVO, CD_PREFIXO) SELECT prot, u, 'Rascunho', now(), true, 'ZZRAS' FROM r;
INSERT INTO Processos.PROTOCOLO_VERSOES (ID_PROTOCOLO_VERSAO, ID_PROTOCOLO, NR_VERSAO, TP_SITUACAO, ID_USUARIO_ABRIU, ID_USUARIO_RESPONSAVEL, DT_INCLUSAO, DT_ALTERACAO, SN_PERMITE_CONVIDADOS, DS_TITULO, SN_GESTOR_FINALIZA)
SELECT ver, prot, -1, 'R', u, u, now(), now(), false, 'Rascunho', false FROM r;
INSERT INTO Processos.FORMULARIOS (ID_FORMULARIO, ID_PROTOCOLO_VERSAO, DS_TITULO, DT_INCLUSAO) SELECT form, ver, 'F', now() FROM r;
SELECT pg_temp.confere('prazo sem unidade', left(pg_temp.tenta(format(
  'INSERT INTO Processos.PROTOCOLOS_ETAPAS (ID_PROTOCOLO_ETAPA, ID_PROTOCOLO_VERSAO, TP_BLOCO, ID_FORMULARIO, DS_TITULO, NR_POSICAO_X, NR_POSICAO_Y, NR_PRAZO) VALUES (gen_random_uuid(), %L, ''E'', %L, ''X'', 0, 0, 3)', ver, form)), 7), 'RECUSOU') FROM r;
SELECT pg_temp.confere('concentrador com prazo', left(pg_temp.tenta(format(
  'INSERT INTO Processos.PROTOCOLOS_ETAPAS (ID_PROTOCOLO_ETAPA, ID_PROTOCOLO_VERSAO, TP_BLOCO, DS_TITULO, NR_POSICAO_X, NR_POSICAO_Y, NR_PRAZO, TP_UNIDADE_PRAZO) VALUES (gen_random_uuid(), %L, ''J'', ''J'', 0, 0, 3, ''C'')', ver)), 7), 'RECUSOU') FROM r;
SELECT pg_temp.confere('etapa com prazo completo', pg_temp.tenta(format(
  'INSERT INTO Processos.PROTOCOLOS_ETAPAS (ID_PROTOCOLO_ETAPA, ID_PROTOCOLO_VERSAO, TP_BLOCO, ID_FORMULARIO, DS_TITULO, NR_POSICAO_X, NR_POSICAO_Y, NR_PRAZO, TP_UNIDADE_PRAZO) VALUES (gen_random_uuid(), %L, ''E'', %L, ''X'', 0, 0, 3, ''U'')', ver, form)), 'ACEITOU') FROM r;

ROLLBACK;
