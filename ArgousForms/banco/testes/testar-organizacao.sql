-- Testes de organização (M-06): hierarquia de grupos, lotação, tags de sistema e grupo de origem do processo. 23/11/2026.
-- Roda em qualquer cliente (psql, DBeaver): não usa comandos do psql. Executar como script.
-- Executar como usuário com DML em Cadastro e Processos, com ao menos um usuário cadastrado e as tags de sistema carregadas.
-- Os dados são temporários: a transação sempre termina em ROLLBACK. Cada linha do resultado começa com "ok" ou "FALHA".
BEGIN;
-- As regras de organização rodam no COMMIT; aqui são antecipadas para cada comando.
SET CONSTRAINTS ALL IMMEDIATE;

CREATE FUNCTION pg_temp.tenta(nome text, esperado text, comando text) RETURNS text LANGUAGE plpgsql AS $f$
DECLARE r text;
BEGIN
  BEGIN EXECUTE comando; RAISE EXCEPTION 'desfazer';
  EXCEPTION WHEN others THEN r := CASE WHEN SQLERRM = 'desfazer' THEN 'ACEITOU' ELSE 'RECUSOU: ' || SQLERRM END; END;
  RETURN CASE WHEN left(r, length(esperado)) = esperado THEN 'ok    ' ELSE 'FALHA ' END || nome || ' -> ' || r;
END $f$;

-- Grupos de teste: 990001 Diretoria (departamento) > 990002 Financeiro (departamento, com Ana lotada);
-- 990003 Comitê (não é departamento, Ana participa); 990004 Arquivo morto (departamento inativo).
CREATE TEMP TABLE t ON COMMIT DROP AS SELECT
  (SELECT ID_USUARIO_SISTEMA FROM Cadastro.USUARIOS_SISTEMA WHERE DT_EXCLUSAO IS NULL ORDER BY DT_INCLUSAO LIMIT 1) u,
  gen_random_uuid() prot, gen_random_uuid() ver, gen_random_uuid() form, gen_random_uuid() etapa, gen_random_uuid() proc;
INSERT INTO Cadastro.GRUPOS (ID_GRUPO, DS_NOME_GRUPO, SN_ATIVO, DT_INCLUSAO, DT_ALTERACAO) VALUES
  (990001, 'Diretoria', true, now(), now()), (990002, 'Financeiro', true, now(), now()),
  (990003, 'Comitê', true, now(), now()), (990004, 'Arquivo morto', true, now(), now());
INSERT INTO Cadastro.GRUPO_TAGS (ID_GRUPO, CD_TAG, SN_ATIVA, DT_INCLUSAO, DT_ALTERACAO) VALUES
  (990001, 'departamento', true, now(), now()), (990002, 'departamento', true, now(), now()), (990004, 'departamento', true, now(), now());
UPDATE Cadastro.GRUPOS SET ID_GRUPO_SUPERIOR = 990001 WHERE ID_GRUPO = 990002;
UPDATE Cadastro.GRUPOS SET SN_ATIVO = false WHERE ID_GRUPO = 990004;
INSERT INTO Cadastro.USUARIO_GRUPOS (ID_USUARIO_SISTEMA, ID_GRUPO, SN_ATIVO, DT_INCLUSAO, DT_ALTERACAO)
  SELECT u, g, true, now(), now() FROM t, unnest(ARRAY[990001, 990002, 990003]) g;
DELETE FROM Cadastro.VINCULO_TAGS WHERE CD_TAG = 'lotacao' AND ID_USUARIO_SISTEMA = (SELECT u FROM t);
INSERT INTO Cadastro.VINCULO_TAGS (ID_USUARIO_SISTEMA, ID_GRUPO, CD_TAG, SN_ATIVO, DT_INCLUSAO, DT_ALTERACAO)
  SELECT u, 990002, 'lotacao', true, now(), now() FROM t;

SELECT pg_temp.tenta('tags de sistema carregadas', 'ACEITOU',
  'DO $$BEGIN IF (SELECT count(*) FROM Cadastro.TAGS WHERE SN_SISTEMA AND CD_TAG IN (''departamento'',''lotacao'',''gestor'',''substituto'',''supervisor'')) <> 5 THEN RAISE EXCEPTION ''faltam tags de sistema''; END IF; END$$');
SELECT pg_temp.tenta('desligar departamento da hierarquia', 'ACEITOU',
  'UPDATE Cadastro.GRUPOS SET ID_GRUPO_SUPERIOR = NULL WHERE ID_GRUPO = 990002');
SELECT pg_temp.tenta('grupo que não é departamento com superior', 'RECUSOU',
  'UPDATE Cadastro.GRUPOS SET ID_GRUPO_SUPERIOR = 990001 WHERE ID_GRUPO = 990003');
SELECT pg_temp.tenta('departamento sob grupo que não é departamento', 'RECUSOU',
  'UPDATE Cadastro.GRUPOS SET ID_GRUPO_SUPERIOR = 990003 WHERE ID_GRUPO = 990001');
SELECT pg_temp.tenta('grupo superior de si mesmo', 'RECUSOU',
  'UPDATE Cadastro.GRUPOS SET ID_GRUPO_SUPERIOR = 990001 WHERE ID_GRUPO = 990001');
SELECT pg_temp.tenta('ciclo na hierarquia', 'RECUSOU',
  'UPDATE Cadastro.GRUPOS SET ID_GRUPO_SUPERIOR = 990002 WHERE ID_GRUPO = 990001');
SELECT pg_temp.tenta('superior inativo', 'RECUSOU',
  'UPDATE Cadastro.GRUPOS SET ID_GRUPO_SUPERIOR = 990004 WHERE ID_GRUPO = 990002');
SELECT pg_temp.tenta('desativar grupo com subordinado ativo', 'RECUSOU',
  'UPDATE Cadastro.GRUPOS SET SN_ATIVO = false WHERE ID_GRUPO = 990001');
SELECT pg_temp.tenta('desativar a tag departamento de grupo com subordinado', 'RECUSOU',
  'UPDATE Cadastro.GRUPO_TAGS SET SN_ATIVA = false WHERE ID_GRUPO = 990001 AND CD_TAG = ''departamento''');
SELECT pg_temp.tenta('excluir a tag departamento de grupo com subordinado', 'RECUSOU',
  'DELETE FROM Cadastro.GRUPO_TAGS WHERE ID_GRUPO = 990001 AND CD_TAG = ''departamento''');
SELECT pg_temp.tenta('tirar a tag departamento de grupo com lotados', 'RECUSOU',
  'DO $$BEGIN UPDATE Cadastro.GRUPOS SET ID_GRUPO_SUPERIOR = NULL WHERE ID_GRUPO = 990002; DELETE FROM Cadastro.GRUPO_TAGS WHERE ID_GRUPO = 990002 AND CD_TAG = ''departamento''; END$$');
SELECT pg_temp.tenta('lotação em grupo que não é departamento', 'RECUSOU',
  'UPDATE Cadastro.VINCULO_TAGS SET ID_GRUPO = 990003 WHERE CD_TAG = ''lotacao'' AND ID_GRUPO = 990002');
SELECT pg_temp.tenta('segunda lotação ativa', 'RECUSOU',
  'INSERT INTO Cadastro.VINCULO_TAGS (ID_USUARIO_SISTEMA, ID_GRUPO, CD_TAG, SN_ATIVO, DT_INCLUSAO, DT_ALTERACAO) SELECT u, 990001, ''lotacao'', true, now(), now() FROM t');
SELECT pg_temp.tenta('trocar de lotação (desativa a antiga e cria a nova)', 'ACEITOU',
  'DO $$BEGIN UPDATE Cadastro.VINCULO_TAGS SET SN_ATIVO = false WHERE CD_TAG = ''lotacao'' AND ID_GRUPO = 990002; INSERT INTO Cadastro.VINCULO_TAGS (ID_USUARIO_SISTEMA, ID_GRUPO, CD_TAG, SN_ATIVO, DT_INCLUSAO, DT_ALTERACAO) SELECT u, 990001, ''lotacao'', true, now(), now() FROM t; END$$');
SELECT pg_temp.tenta('ordem livre na mesma transação', 'ACEITOU',
  'DO $$BEGIN SET CONSTRAINTS ALL DEFERRED; INSERT INTO Cadastro.GRUPOS (ID_GRUPO, ID_GRUPO_SUPERIOR, DS_NOME_GRUPO, SN_ATIVO, DT_INCLUSAO, DT_ALTERACAO) VALUES (990005, 990002, ''Contas a pagar'', true, now(), now()); INSERT INTO Cadastro.GRUPO_TAGS (ID_GRUPO, CD_TAG, SN_ATIVA, DT_INCLUSAO, DT_ALTERACAO) VALUES (990005, ''departamento'', true, now(), now()); SET CONSTRAINTS ALL IMMEDIATE; END$$');
SELECT pg_temp.tenta('ordem livre, mas sem a tag no fim', 'RECUSOU',
  'DO $$BEGIN SET CONSTRAINTS ALL DEFERRED; INSERT INTO Cadastro.GRUPOS (ID_GRUPO, ID_GRUPO_SUPERIOR, DS_NOME_GRUPO, SN_ATIVO, DT_INCLUSAO, DT_ALTERACAO) VALUES (990005, 990002, ''Contas a pagar'', true, now(), now()); SET CONSTRAINTS ALL IMMEDIATE; END$$');
SELECT pg_temp.tenta('tag de sistema: mudar o nome exibido', 'ACEITOU',
  'UPDATE Cadastro.TAGS SET DS_NOME_EXIBICAO = ''Coordenador'' WHERE CD_TAG = ''gestor''');
SELECT pg_temp.tenta('tag de sistema: desativar', 'RECUSOU',
  'UPDATE Cadastro.TAGS SET SN_ATIVA = false WHERE CD_TAG = ''gestor''');
SELECT pg_temp.tenta('tag de sistema: mudar a aplicação', 'RECUSOU',
  'UPDATE Cadastro.TAGS SET SN_GRUPO = true WHERE CD_TAG = ''gestor''');
SELECT pg_temp.tenta('tag de sistema: deixar de ser de sistema', 'RECUSOU',
  'UPDATE Cadastro.TAGS SET SN_SISTEMA = false WHERE CD_TAG = ''gestor''');
SELECT pg_temp.tenta('tag de sistema: excluir', 'RECUSOU',
  'DELETE FROM Cadastro.TAGS WHERE CD_TAG = ''supervisor''');

-- Grupo de origem do processo: protocolo publicado mínimo.
INSERT INTO Processos.PROTOCOLOS (ID_PROTOCOLO, ID_USUARIO_CRIADOR, DS_TITULO, DT_INCLUSAO, SN_ATIVO, CD_PREFIXO) SELECT prot, u, 'Teste de organização', now(), true, 'ZZORG' FROM t;
INSERT INTO Processos.PROTOCOLO_VERSOES (ID_PROTOCOLO_VERSAO, ID_PROTOCOLO, NR_VERSAO, TP_SITUACAO, ID_USUARIO_ABRIU, ID_USUARIO_RESPONSAVEL, DT_INCLUSAO, DT_ALTERACAO, SN_PERMITE_CONVIDADOS, DS_TITULO, SN_GESTOR_FINALIZA)
SELECT ver, prot, -1, 'R', u, u, now(), now(), false, 'Teste de organização', false FROM t;
INSERT INTO Processos.PROTOCOLO_GESTORES_ELEGIVEIS (ID_GESTOR_ELEGIVEL, ID_PROTOCOLO_VERSAO, ID_USUARIO_SISTEMA) SELECT gen_random_uuid(), ver, u FROM t;
INSERT INTO Processos.FORMULARIOS (ID_FORMULARIO, ID_PROTOCOLO_VERSAO, DS_TITULO, DT_INCLUSAO) SELECT form, ver, 'F', now() FROM t;
INSERT INTO Processos.PROTOCOLOS_ETAPAS (ID_PROTOCOLO_ETAPA, ID_PROTOCOLO_VERSAO, TP_BLOCO, ID_FORMULARIO, DS_TITULO, NR_POSICAO_X, NR_POSICAO_Y, TP_RESULTADO_PADRAO) SELECT etapa, ver, 'E', form, 'A', 0, 0, 'P' FROM t;
INSERT INTO Processos.PROTOCOLO_ETAPA_DESTINATARIOS (ID_ETAPA_DESTINATARIO, ID_PROTOCOLO_ETAPA, ID_USUARIO_SISTEMA) SELECT gen_random_uuid(), etapa, u FROM t;
UPDATE Processos.PROTOCOLO_VERSOES SET NR_VERSAO = 1, TP_SITUACAO = 'P', ID_USUARIO_PUBLICOU = (SELECT u FROM t), DT_PUBLICACAO = now() WHERE ID_PROTOCOLO_VERSAO = (SELECT ver FROM t);
INSERT INTO Processos.PROCESSOS (ID_PROCESSO, ID_PROTOCOLO_VERSAO, ID_USUARIO_INICIOU, TP_SITUACAO, DT_INICIO, ID_GRUPO_ORIGEM) SELECT proc, ver, u, 'E', now(), 990003 FROM t;

SELECT pg_temp.tenta('origem do processo = lotação de quem iniciou', 'ACEITOU',
  'DO $$BEGIN IF (SELECT ID_GRUPO_ORIGEM FROM Processos.PROCESSOS WHERE ID_PROCESSO = (SELECT proc FROM t)) IS DISTINCT FROM 990002 THEN RAISE EXCEPTION ''origem errada''; END IF; END$$');
SELECT pg_temp.tenta('origem do processo não muda', 'ACEITOU',
  'DO $$BEGIN UPDATE Processos.PROCESSOS SET ID_GRUPO_ORIGEM = 990001 WHERE ID_PROCESSO = (SELECT proc FROM t); IF (SELECT ID_GRUPO_ORIGEM FROM Processos.PROCESSOS WHERE ID_PROCESSO = (SELECT proc FROM t)) IS DISTINCT FROM 990002 THEN RAISE EXCEPTION ''origem mudou''; END IF; END$$');
SELECT pg_temp.tenta('sem lotação, origem nula', 'ACEITOU',
  'DO $$DECLARE p uuid := gen_random_uuid(); BEGIN UPDATE Cadastro.VINCULO_TAGS SET SN_ATIVO = false WHERE CD_TAG = ''lotacao'' AND ID_USUARIO_SISTEMA = (SELECT u FROM t); INSERT INTO Processos.PROCESSOS (ID_PROCESSO, ID_PROTOCOLO_VERSAO, ID_USUARIO_INICIOU, TP_SITUACAO, DT_INICIO) SELECT p, ver, u, ''E'', now() FROM t; IF (SELECT ID_GRUPO_ORIGEM FROM Processos.PROCESSOS WHERE ID_PROCESSO = p) IS NOT NULL THEN RAISE EXCEPTION ''origem deveria ser nula''; END IF; END$$');

ROLLBACK;
