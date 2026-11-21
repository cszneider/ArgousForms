-- Testes das regras de fluxo e resultado de 20/11/2026 (modelo-de-dados.md, 4.1 e M-01).
-- Executar como usuário com DML em Cadastro e Processos, com ao menos um usuário cadastrado.
-- Os dados são temporários: a transação sempre termina em ROLLBACK.
-- Cada linha do resultado começa com "ok" ou "FALHA".
BEGIN;

-- Monta um rascunho e tenta publicá-lo. Nós: 'nome:tipo[:resultado]'. Cadeias: 'origem>tipo:destino,tipo:destino'.
CREATE FUNCTION pg_temp.publicar(nos text[], cadeias text[]) RETURNS text LANGUAGE plpgsql AS $f$
DECLARE u uuid; prot uuid := gen_random_uuid(); ver uuid := gen_random_uuid();
  ids jsonb := '{}'; n text; p text[]; c text; origem text; itens text[]; i int; prox uuid; enc uuid; form uuid; partes text[];
BEGIN
  SELECT ID_USUARIO_SISTEMA INTO u FROM Cadastro.USUARIOS_SISTEMA ORDER BY DT_INCLUSAO LIMIT 1;
  IF u IS NULL THEN RAISE EXCEPTION 'Teste requer ao menos um usuário.'; END IF;
  INSERT INTO Processos.PROTOCOLOS (ID_PROTOCOLO, ID_USUARIO_CRIADOR, DS_TITULO, DT_INCLUSAO, SN_ATIVO, CD_PREFIXO)
  VALUES (prot, u, 'Teste de fluxo', now(), true, 'T' || upper(substr(md5(prot::text), 1, 5)));
  INSERT INTO Processos.PROTOCOLO_VERSOES (ID_PROTOCOLO_VERSAO, ID_PROTOCOLO, NR_VERSAO, TP_SITUACAO, ID_USUARIO_ABRIU, ID_USUARIO_RESPONSAVEL,
         DT_INCLUSAO, DT_ALTERACAO, SN_PERMITE_CONVIDADOS, DS_TITULO, SN_GESTOR_FINALIZA)
  VALUES (ver, prot, -1, 'R', u, u, now(), now(), false, 'Teste de fluxo', false);
  INSERT INTO Processos.PROTOCOLO_GESTORES_ELEGIVEIS (ID_GESTOR_ELEGIVEL, ID_PROTOCOLO_VERSAO, ID_USUARIO_SISTEMA) VALUES (gen_random_uuid(), ver, u);
  FOREACH n IN ARRAY nos LOOP
    p := string_to_array(n, ':'); form := NULL;
    IF p[2] = 'E' THEN form := gen_random_uuid();
      INSERT INTO Processos.FORMULARIOS (ID_FORMULARIO, ID_PROTOCOLO_VERSAO, DS_TITULO, DT_INCLUSAO) VALUES (form, ver, p[1], now()); END IF;
    ids := ids || jsonb_build_object(p[1], gen_random_uuid());
    INSERT INTO Processos.PROTOCOLOS_ETAPAS (ID_PROTOCOLO_ETAPA, ID_PROTOCOLO_VERSAO, TP_BLOCO, ID_FORMULARIO, DS_TITULO, NR_POSICAO_X, NR_POSICAO_Y, TP_RESULTADO_PADRAO)
    VALUES ((ids->>p[1])::uuid, ver, p[2], form, p[1], 0, 0, NULLIF(p[3], ''));
    IF p[2] = 'E' THEN
      INSERT INTO Processos.PROTOCOLO_ETAPA_DESTINATARIOS (ID_ETAPA_DESTINATARIO, ID_PROTOCOLO_ETAPA, ID_USUARIO_SISTEMA) VALUES (gen_random_uuid(), (ids->>p[1])::uuid, u);
    END IF;
  END LOOP;
  FOREACH c IN ARRAY cadeias LOOP
    origem := split_part(c, '>', 1); itens := string_to_array(split_part(c, '>', 2), ','); prox := NULL;
    FOR i IN REVERSE array_length(itens, 1)..1 LOOP
      partes := string_to_array(itens[i], ':'); enc := gen_random_uuid();
      INSERT INTO Processos.ENCAMINHAMENTOS (ID_ENCAMINHAMENTO, ID_PROTOCOLO_VERSAO, TP_ENCAMINHAMENTO, TX_TESTE, ID_PROXIMA_ETAPA, ID_PROXIMO_ENCAMINHAMENTO)
      VALUES (enc, ver, partes[1], CASE WHEN partes[1] IN ('T', 'C') THEN 'return true;' END, (ids->>partes[2])::uuid, prox);
      prox := enc;
    END LOOP;
    UPDATE Processos.PROTOCOLOS_ETAPAS SET ID_ENCAMINHAMENTO = prox WHERE ID_PROTOCOLO_ETAPA = (ids->>origem)::uuid;
  END LOOP;
  BEGIN
    UPDATE Processos.PROTOCOLO_VERSOES SET NR_VERSAO = 1, TP_SITUACAO = 'P', ID_USUARIO_PUBLICOU = u, DT_PUBLICACAO = now()
     WHERE ID_PROTOCOLO_VERSAO = ver;
    RETURN 'PUBLICOU';
  EXCEPTION WHEN others THEN RETURN 'RECUSOU: ' || SQLERRM;
  END;
END $f$;

CREATE FUNCTION pg_temp.caso(nome text, esperado text, nos text[], cadeias text[]) RETURNS text LANGUAGE plpgsql AS $f$
DECLARE r text;
BEGIN
  BEGIN r := pg_temp.publicar(nos, cadeias);
  EXCEPTION WHEN others THEN r := 'ERRO NA MONTAGEM: ' || SQLERRM; END;
  RETURN CASE WHEN left(r, length(esperado)) = esperado THEN 'ok    ' ELSE 'FALHA ' END || nome || ' -> ' || r;
END $f$;

-- Executa um comando e confere se foi aceito ou recusado (desfaz em qualquer caso).
CREATE FUNCTION pg_temp.tenta(nome text, esperado text, comando text) RETURNS text LANGUAGE plpgsql AS $f$
DECLARE r text;
BEGIN
  BEGIN EXECUTE comando; RAISE EXCEPTION 'desfazer';
  EXCEPTION WHEN others THEN r := CASE WHEN SQLERRM = 'desfazer' THEN 'ACEITOU' ELSE 'RECUSOU: ' || SQLERRM END; END;
  RETURN CASE WHEN left(r, length(esperado)) = esperado THEN 'ok    ' ELSE 'FALHA ' END || nome || ' -> ' || r;
END $f$;

-- Publicação (validar_versao_protocolo)
SELECT pg_temp.caso('linear simples', 'PUBLICOU', ARRAY['A:E','B:E:P'], ARRAY['A>E:B']);
SELECT pg_temp.caso('final sem resultado padrão', 'RECUSOU', ARRAY['A:E','B:E'], ARRAY['A>E:B']);
SELECT pg_temp.caso('resultado padrão em etapa não final', 'RECUSOU', ARRAY['A:E:P','B:E:P'], ARRAY['A>E:B']);
SELECT pg_temp.caso('decisão com caso contrário', 'PUBLICOU', ARRAY['A:E','S:E:P','N:E:N'], ARRAY['A>T:S,E:N']);
SELECT pg_temp.caso('decisão sem caso contrário', 'RECUSOU', ARRAY['A:E','S:E:P','N:E:N'], ARRAY['A>T:S,T:N']);
SELECT pg_temp.caso('decisão misturada com direto', 'RECUSOU', ARRAY['A:E','S:E:P','N:E:N','X:E:P'], ARRAY['A>E:X,T:S,E:N']);
SELECT pg_temp.caso('paralelo com concentrador', 'PUBLICOU', ARRAY['A:E','B:E','C:E','J:J','F:E:P'], ARRAY['A>E:B,E:C','B>E:J','C>E:J','J>E:F']);
SELECT pg_temp.caso('paralelo condicional com um E', 'PUBLICOU', ARRAY['A:E','B:E','C:E','J:J','F:E:P'], ARRAY['A>E:B,C:C','B>E:J','C>E:J','J>E:F']);
SELECT pg_temp.caso('paralelo só condicional', 'RECUSOU', ARRAY['A:E','B:E','C:E','J:J','F:E:P'], ARRAY['A>C:B,C:C','B>E:J','C>E:J','J>E:F']);
SELECT pg_temp.caso('concentrador como final', 'RECUSOU', ARRAY['A:E','B:E','C:E','J:J'], ARRAY['A>E:B,E:C','B>E:J','C>E:J']);
SELECT pg_temp.caso('concentrador sem entrada', 'RECUSOU', ARRAY['A:E','J:J','F:E:P'], ARRAY['A>E:F','J>E:F']);
SELECT pg_temp.caso('dois finais P e N sem junção', 'PUBLICOU', ARRAY['A:E','B:E:P','C:E:N'], ARRAY['A>E:B,E:C']);

-- Restrições de PROCESSOS (usa a versão publicada pelo primeiro caso)
CREATE TEMP TABLE v ON COMMIT DROP AS
SELECT v.ID_PROTOCOLO_VERSAO id, (SELECT ID_USUARIO_SISTEMA FROM Cadastro.USUARIOS_SISTEMA ORDER BY DT_INCLUSAO LIMIT 1) u
  FROM Processos.PROTOCOLO_VERSOES v JOIN Processos.PROTOCOLOS p USING (ID_PROTOCOLO)
 WHERE p.DS_TITULO = 'Teste de fluxo' AND v.NR_VERSAO > 0 LIMIT 1;
\set ins 'INSERT INTO Processos.PROCESSOS (ID_PROCESSO, ID_PROTOCOLO_VERSAO, ID_USUARIO_INICIOU, TP_SITUACAO, TP_RESULTADO, DS_RESULTADO, DT_INICIO, DT_ENCERRAMENTO) SELECT gen_random_uuid(), id, u, '
SELECT pg_temp.tenta('E sem resultado', 'ACEITOU', :'ins' || '''E'', NULL, NULL, now(), NULL FROM v');
SELECT pg_temp.tenta('E com resultado', 'RECUSOU', :'ins' || '''E'', ''P'', NULL, now(), NULL FROM v');
SELECT pg_temp.tenta('I não existe mais', 'RECUSOU', :'ins' || '''I'', NULL, NULL, now(), NULL FROM v');
SELECT pg_temp.tenta('A pré-preenchido N sem motivo', 'ACEITOU', :'ins' || '''A'', ''N'', NULL, now(), NULL FROM v');
SELECT pg_temp.tenta('A com C', 'RECUSOU', :'ins' || '''A'', ''C'', ''x'', now(), NULL FROM v');
SELECT pg_temp.tenta('F sem resultado', 'RECUSOU', :'ins' || '''F'', NULL, NULL, now(), now() + interval ''1s'' FROM v');
SELECT pg_temp.tenta('F P sem motivo', 'ACEITOU', :'ins' || '''F'', ''P'', NULL, now(), now() + interval ''1s'' FROM v');
SELECT pg_temp.tenta('F N com motivo em branco', 'RECUSOU', :'ins' || '''F'', ''N'', ''  '', now(), now() + interval ''1s'' FROM v');
SELECT pg_temp.tenta('F N com motivo', 'ACEITOU', :'ins' || '''F'', ''N'', ''reprovado'', now(), now() + interval ''1s'' FROM v');
SELECT pg_temp.tenta('F sem data de encerramento', 'RECUSOU', :'ins' || '''F'', ''P'', NULL, now(), NULL FROM v');
SELECT pg_temp.tenta('C com motivo', 'ACEITOU', :'ins' || '''C'', ''C'', ''desistência'', now(), now() + interval ''1s'' FROM v');
SELECT pg_temp.tenta('C sem motivo', 'RECUSOU', :'ins' || '''C'', ''C'', NULL, now(), now() + interval ''1s'' FROM v');
SELECT pg_temp.tenta('E com data de encerramento', 'RECUSOU', :'ins' || '''E'', NULL, NULL, now(), now() + interval ''1s'' FROM v');

-- Restrições de PROTOCOLOS_ETAPAS e ENCAMINHAMENTOS
SELECT pg_temp.tenta('concentrador com formulário', 'RECUSOU',
  'INSERT INTO Processos.PROTOCOLOS_ETAPAS (ID_PROTOCOLO_ETAPA, ID_PROTOCOLO_VERSAO, TP_BLOCO, ID_FORMULARIO, DS_TITULO, NR_POSICAO_X, NR_POSICAO_Y)
   SELECT gen_random_uuid(), f.ID_PROTOCOLO_VERSAO, ''J'', f.ID_FORMULARIO, ''J'', 0, 0 FROM Processos.FORMULARIOS f JOIN Processos.PROTOCOLO_VERSOES v USING (ID_PROTOCOLO_VERSAO) WHERE v.NR_VERSAO = -1 LIMIT 1');
SELECT pg_temp.tenta('etapa sem formulário', 'RECUSOU',
  'INSERT INTO Processos.PROTOCOLOS_ETAPAS (ID_PROTOCOLO_ETAPA, ID_PROTOCOLO_VERSAO, TP_BLOCO, DS_TITULO, NR_POSICAO_X, NR_POSICAO_Y)
   SELECT gen_random_uuid(), ID_PROTOCOLO_VERSAO, ''E'', ''E'', 0, 0 FROM Processos.PROTOCOLO_VERSOES WHERE NR_VERSAO = -1 LIMIT 1');
SELECT pg_temp.tenta('direto com teste', 'RECUSOU',
  'INSERT INTO Processos.ENCAMINHAMENTOS (ID_ENCAMINHAMENTO, ID_PROTOCOLO_VERSAO, TP_ENCAMINHAMENTO, TX_TESTE, ID_PROXIMA_ETAPA)
   SELECT gen_random_uuid(), ID_PROTOCOLO_VERSAO, ''E'', ''return true;'', ID_PROTOCOLO_ETAPA FROM Processos.PROTOCOLOS_ETAPAS e JOIN Processos.PROTOCOLO_VERSOES v USING (ID_PROTOCOLO_VERSAO) WHERE v.NR_VERSAO = -1 LIMIT 1');
SELECT pg_temp.tenta('condicional sem teste', 'RECUSOU',
  'INSERT INTO Processos.ENCAMINHAMENTOS (ID_ENCAMINHAMENTO, ID_PROTOCOLO_VERSAO, TP_ENCAMINHAMENTO, ID_PROXIMA_ETAPA)
   SELECT gen_random_uuid(), ID_PROTOCOLO_VERSAO, ''C'', ID_PROTOCOLO_ETAPA FROM Processos.PROTOCOLOS_ETAPAS e JOIN Processos.PROTOCOLO_VERSOES v USING (ID_PROTOCOLO_VERSAO) WHERE v.NR_VERSAO = -1 LIMIT 1');

ROLLBACK;
