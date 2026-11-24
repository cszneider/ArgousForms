-- Testes de opção única (O) e múltipla escolha (C), 23/11/2026.
-- Roda em qualquer cliente (psql, DBeaver): não usa comandos do psql.
-- Executar como usuário com DML em Cadastro e Processos, com ao menos um usuário cadastrado.
-- Os dados são temporários: a transação sempre termina em ROLLBACK. Cada linha do resultado começa com "ok" ou "FALHA".
BEGIN;

CREATE FUNCTION pg_temp.tenta(nome text, esperado text, comando text) RETURNS text LANGUAGE plpgsql AS $f$
DECLARE r text;
BEGIN
  BEGIN EXECUTE comando; RAISE EXCEPTION 'desfazer';
  EXCEPTION WHEN others THEN r := CASE WHEN SQLERRM = 'desfazer' THEN 'ACEITOU' ELSE 'RECUSOU: ' || SQLERRM END; END;
  RETURN CASE WHEN left(r, length(esperado)) = esperado THEN 'ok    ' ELSE 'FALHA ' END || nome || ' -> ' || r;
END $f$;

-- Protocolo publicado mínimo, um processo, uma etapa e duas variáveis: uma O e uma C.
CREATE TEMP TABLE t ON COMMIT DROP AS SELECT
  (SELECT ID_USUARIO_SISTEMA FROM Cadastro.USUARIOS_SISTEMA ORDER BY DT_INCLUSAO LIMIT 1) u,
  gen_random_uuid() prot, gen_random_uuid() ver, gen_random_uuid() form, gen_random_uuid() etapa,
  gen_random_uuid() proc, gen_random_uuid() pe, gen_random_uuid() var_o, gen_random_uuid() var_c;
INSERT INTO Processos.PROTOCOLOS (ID_PROTOCOLO, ID_USUARIO_CRIADOR, DS_TITULO, DT_INCLUSAO, SN_ATIVO, CD_PREFIXO) SELECT prot, u, 'Teste de opções', now(), true, 'ZZOPC' FROM t;
INSERT INTO Processos.PROTOCOLO_VERSOES (ID_PROTOCOLO_VERSAO, ID_PROTOCOLO, NR_VERSAO, TP_SITUACAO, ID_USUARIO_ABRIU, ID_USUARIO_RESPONSAVEL, DT_INCLUSAO, DT_ALTERACAO, SN_PERMITE_CONVIDADOS, DS_TITULO, SN_GESTOR_FINALIZA)
SELECT ver, prot, -1, 'R', u, u, now(), now(), false, 'Teste de opções', false FROM t;
INSERT INTO Processos.PROTOCOLO_GESTORES_ELEGIVEIS (ID_GESTOR_ELEGIVEL, ID_PROTOCOLO_VERSAO, ID_USUARIO_SISTEMA) SELECT gen_random_uuid(), ver, u FROM t;
INSERT INTO Processos.FORMULARIOS (ID_FORMULARIO, ID_PROTOCOLO_VERSAO, DS_TITULO, DT_INCLUSAO, TX_SCRIPT_AO_ABRIR) SELECT form, ver, 'F', now(), 'return;' FROM t;
INSERT INTO Processos.PROTOCOLOS_ETAPAS (ID_PROTOCOLO_ETAPA, ID_PROTOCOLO_VERSAO, TP_BLOCO, ID_FORMULARIO, DS_TITULO, NR_POSICAO_X, NR_POSICAO_Y, TP_RESULTADO_PADRAO) SELECT etapa, ver, 'E', form, 'A', 0, 0, 'P' FROM t;
INSERT INTO Processos.PROTOCOLO_ETAPA_DESTINATARIOS (ID_ETAPA_DESTINATARIO, ID_PROTOCOLO_ETAPA, ID_USUARIO_SISTEMA) SELECT gen_random_uuid(), etapa, u FROM t;
INSERT INTO Processos.PROTOCOLO_VARIAVEIS (ID_VARIAVEL, ID_PROTOCOLO, CD_VARIAVEL, TP_DADO, DT_INCLUSAO) SELECT var_o, prot, 'unica', 'O', now() FROM t;
INSERT INTO Processos.PROTOCOLO_VARIAVEIS (ID_VARIAVEL, ID_PROTOCOLO, CD_VARIAVEL, TP_DADO, DT_INCLUSAO) SELECT var_c, prot, 'multipla', 'C', now() FROM t;
UPDATE Processos.PROTOCOLO_VERSOES SET NR_VERSAO = 1, TP_SITUACAO = 'P', ID_USUARIO_PUBLICOU = (SELECT u FROM t), DT_PUBLICACAO = now() WHERE ID_PROTOCOLO_VERSAO = (SELECT ver FROM t);
INSERT INTO Processos.PROCESSOS (ID_PROCESSO, ID_PROTOCOLO_VERSAO, ID_USUARIO_INICIOU, TP_SITUACAO, DT_INICIO) SELECT proc, ver, u, 'E', now() FROM t;
INSERT INTO Processos.PROCESSO_ETAPAS (ID_PROCESSO_ETAPA, ID_PROCESSO, ID_PROTOCOLO_ETAPA, NR_PASSAGEM, TP_SITUACAO, DT_DISPONIBILIZACAO) SELECT pe, proc, etapa, 1, 'D', now() FROM t;

SELECT pg_temp.tenta('opção única com CD_OPCAO', 'ACEITOU', 'INSERT INTO Processos.PROCESSO_VARIAVEL_VALORES (ID_PROCESSO_ETAPA, ID_VARIAVEL, CD_OPCAO, DT_ULTIMA_GRAVACAO) SELECT pe, ' || 'var_o, ''sim'', now() FROM t');
SELECT pg_temp.tenta('múltipla escolha com CD_OPCAO', 'RECUSOU', 'INSERT INTO Processos.PROCESSO_VARIAVEL_VALORES (ID_PROCESSO_ETAPA, ID_VARIAVEL, CD_OPCAO, DT_ULTIMA_GRAVACAO) SELECT pe, ' || 'var_c, ''sim'', now() FROM t');
INSERT INTO Processos.PROCESSO_VARIAVEL_VALORES (ID_PROCESSO_ETAPA, ID_VARIAVEL, DT_ULTIMA_GRAVACAO) SELECT pe, var_c, now() FROM t;
INSERT INTO Processos.PROCESSO_VARIAVEL_VALORES (ID_PROCESSO_ETAPA, ID_VARIAVEL, CD_OPCAO, DT_ULTIMA_GRAVACAO) SELECT pe, var_o, 'sim', now() FROM t;
SELECT pg_temp.tenta('múltipla escolha: duas opções', 'ACEITOU',
  'INSERT INTO Processos.PROCESSO_VARIAVEL_OPCOES (ID_PROCESSO_ETAPA, ID_VARIAVEL, CD_OPCAO) SELECT pe, var_c, x FROM t, unnest(ARRAY[''a'',''b'']) x');
SELECT pg_temp.tenta('múltipla escolha: opção repetida', 'RECUSOU',
  'INSERT INTO Processos.PROCESSO_VARIAVEL_OPCOES (ID_PROCESSO_ETAPA, ID_VARIAVEL, CD_OPCAO) SELECT pe, var_c, ''a'' FROM t UNION ALL SELECT pe, var_c, ''a'' FROM t');
SELECT pg_temp.tenta('múltipla escolha: opção em branco', 'RECUSOU',
  'INSERT INTO Processos.PROCESSO_VARIAVEL_OPCOES (ID_PROCESSO_ETAPA, ID_VARIAVEL, CD_OPCAO) SELECT pe, var_c, ''  '' FROM t');
SELECT pg_temp.tenta('OPCOES para campo de opção única', 'RECUSOU',
  'INSERT INTO Processos.PROCESSO_VARIAVEL_OPCOES (ID_PROCESSO_ETAPA, ID_VARIAVEL, CD_OPCAO) SELECT pe, var_o, ''a'' FROM t');
SELECT pg_temp.tenta('OPCOES sem linha em VALORES', 'RECUSOU',
  'INSERT INTO Processos.PROCESSO_VARIAVEL_OPCOES (ID_PROCESSO_ETAPA, ID_VARIAVEL, CD_OPCAO) SELECT gen_random_uuid(), var_c, ''a'' FROM t');
SELECT pg_temp.tenta('campo com nome alternativo e ajuda', 'ACEITOU',
  'INSERT INTO Processos.FORMULARIO_VARIAVEIS (ID_FORMULARIO, ID_VARIAVEL, TP_ACESSO, NR_ORDEM, SN_OBRIGATORIA, TP_APRESENTACAO, DS_NOME_ALTERNATIVO, DS_TEXTO_AJUDA, TX_SCRIPT_ON_CHANGE) SELECT gen_random_uuid(), var_c, ''E'', 1, false, ''1'', ''X'', ''Y'', ''Z'' FROM t WHERE false');

ROLLBACK;
