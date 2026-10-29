-- Testes de integridade no banco atual. Não escreve no MongoDB.
-- Executar como usuário com DML em Cadastro, Docs e Processos.
-- Os dados abaixo são temporários: a transação sempre termina em ROLLBACK.
BEGIN;

DO $teste$
DECLARE
    usuario uuid;
    raiz uuid;
    protocolo uuid := gen_random_uuid();
    versao uuid := gen_random_uuid();
    formulario uuid := gen_random_uuid();
    etapa_inicial uuid := gen_random_uuid();
    etapa_final uuid := gen_random_uuid();
    encaminhamento uuid := gen_random_uuid();
    variavel uuid := gen_random_uuid();
    documento uuid := gen_random_uuid();
    documento_versao uuid := gen_random_uuid();
    documento_pdf uuid := gen_random_uuid();
    documento_pdf_versao uuid := gen_random_uuid();
    pasta_pdf uuid := gen_random_uuid();
    arquivo_pdf uuid := gen_random_uuid();
    arquivo_pdf_versao uuid := gen_random_uuid();
    processo uuid := gen_random_uuid();
    processo_etapa uuid := gen_random_uuid();
    erro text;
BEGIN
    SELECT ID_USUARIO_SISTEMA INTO usuario FROM Cadastro.USUARIOS_SISTEMA
     WHERE DT_EXCLUSAO IS NULL ORDER BY DT_INCLUSAO, ID_USUARIO_SISTEMA LIMIT 1;
    SELECT ID_PASTA INTO raiz FROM Docs.PASTAS
     WHERE ID_PASTA_PAI IS NULL AND DT_LIXEIRA IS NULL AND DT_EXCLUSAO IS NULL LIMIT 1;
    IF usuario IS NULL OR raiz IS NULL THEN
        RAISE EXCEPTION 'Teste requer um usuário ativo e a pasta RAIZ.';
    END IF;

    INSERT INTO Processos.PROTOCOLOS (ID_PROTOCOLO, ID_USUARIO_CRIADOR, DS_TITULO, DT_INCLUSAO, SN_ATIVO, ID_PASTA)
    VALUES (protocolo, usuario, 'Teste transacional de Protocolo', now(), true, raiz);
    INSERT INTO Processos.PROTOCOLO_VERSOES
        (ID_PROTOCOLO_VERSAO, ID_PROTOCOLO, NR_VERSAO, TP_SITUACAO, ID_USUARIO_ABRIU,
         ID_USUARIO_RESPONSAVEL, DT_INCLUSAO, DT_ALTERACAO, SN_PERMITE_CONVIDADOS, DS_TITULO)
    VALUES (versao, protocolo, -1, 'R', usuario, usuario, now(), now(), false, 'Teste transacional');

    INSERT INTO Processos.PROTOCOLO_VARIAVEIS
        (ID_VARIAVEL, ID_PROTOCOLO, CD_VARIAVEL, TP_DADO, DT_INCLUSAO)
    VALUES (variavel, protocolo, 'campo_teste', 'S', now());
    INSERT INTO Processos.PROTOCOLO_VARIAVEL_VERSOES
        (ID_VARIAVEL_VERSAO, ID_VARIAVEL, NR_VERSAO, DS_NOME, JS_DEFINICAO, DT_INCLUSAO)
    VALUES (gen_random_uuid(), variavel, 1, 'Campo de teste', '{}'::jsonb, now());
    INSERT INTO Processos.PROTOCOLO_VERSAO_VARIAVEIS (ID_PROTOCOLO_VERSAO, ID_VARIAVEL, NR_VERSAO)
    VALUES (versao, variavel, 1);
    INSERT INTO Processos.FORMULARIOS (ID_FORMULARIO, ID_PROTOCOLO_VERSAO, DS_TITULO, DT_INCLUSAO)
    VALUES (formulario, versao, 'Formulário de teste', now());
    INSERT INTO Processos.FORMULARIO_VARIAVEIS
        (ID_FORMULARIO, ID_VARIAVEL, TP_ACESSO, NR_ORDEM, SN_OBRIGATORIA, TP_APRESENTACAO)
    VALUES (formulario, variavel, 'E', 1, false, '1');

    INSERT INTO Processos.PROTOCOLOS_ETAPAS
        (ID_PROTOCOLO_ETAPA, ID_PROTOCOLO_VERSAO, ID_FORMULARIO, TP_ETAPA, DS_TITULO, NR_POSICAO_X, NR_POSICAO_Y)
    VALUES (etapa_inicial, versao, formulario, 'I', 'Início', 0, 0),
           (etapa_final, versao, formulario, 'F', 'Fim', 400, 0);
    INSERT INTO Processos.PROTOCOLO_ETAPA_DESTINATARIOS
        (ID_ETAPA_DESTINATARIO, ID_PROTOCOLO_ETAPA, ID_USUARIO_SISTEMA)
    VALUES (gen_random_uuid(), etapa_inicial, usuario),
           (gen_random_uuid(), etapa_final, usuario);
    INSERT INTO Processos.ENCAMINHAMENTOS
        (ID_ENCAMINHAMENTO, ID_PROTOCOLO_VERSAO, TP_ENCAMINHAMENTO, ID_PROXIMA_ETAPA)
    VALUES (encaminhamento, versao, 'E', etapa_final);
    UPDATE Processos.PROTOCOLOS_ETAPAS SET ID_ENCAMINHAMENTO = encaminhamento
     WHERE ID_PROTOCOLO_ETAPA = etapa_inicial;

    INSERT INTO Processos.PROTOCOLO_DOCUMENTOS
        (ID_PROTOCOLO_DOCUMENTO, ID_PROTOCOLO, CD_DOCUMENTO, DS_TITULO, DT_INCLUSAO)
    VALUES (documento, protocolo, 'HTML_TESTE', 'Documento HTML de teste', now()),
           (documento_pdf, protocolo, 'PDF_TESTE', 'Documento PDF de teste', now());
    INSERT INTO Processos.PROTOCOLO_DOCUMENTO_VERSOES
        (ID_PROTOCOLO_DOCUMENTO_VERSAO, ID_PROTOCOLO_DOCUMENTO, NR_VERSAO, TP_MODELO, DT_INCLUSAO)
    VALUES (documento_versao, documento, 1, 'H', now()),
           (documento_pdf_versao, documento_pdf, 1, 'P', now());
    INSERT INTO Processos.PROTOCOLO_DOCUMENTO_HTML
        (ID_PROTOCOLO_DOCUMENTO_VERSAO, TX_HTML, DT_INCLUSAO)
    VALUES (documento_versao, '<p>{{campo_teste}}</p>', now());
    INSERT INTO Processos.PROTOCOLO_VERSAO_DOCUMENTOS
        (ID_PROTOCOLO_VERSAO, ID_PROTOCOLO_DOCUMENTO, ID_PROTOCOLO_DOCUMENTO_VERSAO)
    VALUES (versao, documento, documento_versao),
           (versao, documento_pdf, documento_pdf_versao);

    -- Apenas metadados temporários: não há arquivo correspondente no GridFS.
    INSERT INTO Docs.PASTAS
        (ID_PASTA, ID_PASTA_PAI, DS_NOME, ID_USUARIO_CRIOU, DT_INCLUSAO, DT_ALTERACAO)
    VALUES (pasta_pdf, raiz, 'MODELOS-TESTE-' || left(pasta_pdf::text, 8), usuario, now(), now());
    INSERT INTO Docs.ARQUIVOS
        (ID_ARQUIVO, ID_PASTA, DS_NOME_ARQUIVO, DS_TITULO, TP_CLASSIFICACAO, DT_INCLUSAO, CD_CONTENT_TYPE)
    VALUES (arquivo_pdf, pasta_pdf, 'modelo-teste.pdf', 'PDF de teste', 'L', now(), 'application/pdf');
    INSERT INTO Docs.ARQUIVO_VERSOES
        (ID_ARQUIVO_VERSAO, ID_ARQUIVO, ID_USUARIO_INCLUIU, NR_VERSAO, NR_TAMANHO_BYTES,
         CD_HASH_SHA256, TP_ORIGEM, DT_INCLUSAO)
    VALUES (arquivo_pdf_versao, arquivo_pdf, usuario, 1, 0, repeat('0', 64), 'U', now());
    INSERT INTO Processos.PROTOCOLO_DOCUMENTO_PDF
        (ID_PROTOCOLO_DOCUMENTO_VERSAO, ID_ARQUIVO_MODELO_PDF, DT_INCLUSAO)
    VALUES (documento_pdf_versao, arquivo_pdf_versao, now());
    RAISE NOTICE 'OK: rascunho, fluxo, documentos e referência PDF válida.';

    BEGIN
        UPDATE Docs.ARQUIVOS SET DT_LIXEIRA = now() WHERE ID_ARQUIVO = arquivo_pdf;
        RAISE EXCEPTION 'FALHOU: PDF referenciado foi enviado à lixeira.';
    EXCEPTION WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS erro = MESSAGE_TEXT;
        IF erro NOT LIKE 'Alteração deixaria indisponível%' THEN RAISE; END IF;
        RAISE NOTICE 'OK: PDF referenciado protegido contra lixeira.';
    END;

    BEGIN
        UPDATE Processos.PROTOCOLO_VERSOES SET NR_VERSAO = 1
         WHERE ID_PROTOCOLO_VERSAO = versao;
        RAISE EXCEPTION 'FALHOU: publicação sem publicador foi aceita.';
    EXCEPTION WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS erro = MESSAGE_TEXT;
        IF erro NOT LIKE 'Versão publicada requer publicador%' THEN RAISE; END IF;
        RAISE NOTICE 'OK: publicação incompleta rejeitada.';
    END;

    UPDATE Processos.PROTOCOLO_VERSOES
       SET NR_VERSAO = 1, TP_SITUACAO = 'P', ID_USUARIO_PUBLICOU = usuario,
           DT_PUBLICACAO = now(), DT_ALTERACAO = now()
     WHERE ID_PROTOCOLO_VERSAO = versao;
    RAISE NOTICE 'OK: publicação completa aceita.';

    BEGIN
        UPDATE Processos.FORMULARIOS SET DS_TITULO = 'Alteração proibida'
         WHERE ID_FORMULARIO = formulario;
        RAISE EXCEPTION 'FALHOU: formulário de versão publicada foi alterado.';
    EXCEPTION WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS erro = MESSAGE_TEXT;
        IF erro NOT LIKE 'Definição vinculada a uma versão publicada%' THEN RAISE; END IF;
        RAISE NOTICE 'OK: versão publicada imutável.';
    END;

    INSERT INTO Processos.PROCESSOS
        (ID_PROCESSO, ID_PROTOCOLO_VERSAO, ID_USUARIO_INICIOU, ID_USUARIO_GESTOR, TP_SITUACAO, DT_INICIO)
    VALUES (processo, versao, usuario, usuario, 'I', now());
    INSERT INTO Processos.PROCESSO_ETAPAS
        (ID_PROCESSO_ETAPA, ID_PROCESSO, ID_PROTOCOLO_ETAPA, NR_PASSAGEM,
         TP_SITUACAO, ID_USUARIO_RESPONSAVEL, DT_DISPONIBILIZACAO)
    VALUES (processo_etapa, processo, etapa_inicial, 1, 'I', usuario, now());
    INSERT INTO Processos.PROCESSO_ETAPA_RESPONSAVEIS
        (ID_ETAPA_RESPONSAVEL, ID_PROCESSO_ETAPA, ID_USUARIO_SISTEMA, DT_INICIO)
    VALUES (gen_random_uuid(), processo_etapa, usuario, now());
    SET CONSTRAINTS ALL IMMEDIATE;
    RAISE NOTICE 'OK: responsável atual e histórico concordam.';

    BEGIN
        UPDATE Processos.PROCESSO_ETAPAS SET ID_USUARIO_RESPONSAVEL = NULL
         WHERE ID_PROCESSO_ETAPA = processo_etapa;
        RAISE EXCEPTION 'FALHOU: divergência de responsabilidade foi aceita.';
    EXCEPTION WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS erro = MESSAGE_TEXT;
        IF erro NOT LIKE 'Responsável atual diverge%' THEN RAISE; END IF;
        RAISE NOTICE 'OK: divergência de responsabilidade rejeitada.';
    END;
    RAISE NOTICE 'TODOS OS TESTES PASSARAM; ROLLBACK removerá os registros temporários.';
END;
$teste$;

ROLLBACK;
