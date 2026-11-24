-- Regras estruturais dos Protocolos e Processos já aprovadas.
-- Executar após ajuste-instituicao-processos-2026-10-29.sql e estrutura-processos.sql.
-- As transições de situações ainda sem códigos definidos não são presumidas aqui.
BEGIN;

CREATE OR REPLACE FUNCTION Processos.validar_versao_protocolo() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
    iniciais integer;
    finais integer;
    no_fluxo record;
    atual uuid;
    tipos text[];
    passos integer;
BEGIN
    IF TG_OP = 'DELETE' THEN
        IF OLD.NR_VERSAO > 0 THEN RAISE EXCEPTION 'Versão publicada do Protocolo não pode ser excluída.'; END IF;
        RETURN OLD;
    END IF;

    IF TG_OP = 'UPDATE' AND OLD.NR_VERSAO > 0 THEN
        RAISE EXCEPTION 'Versão publicada do Protocolo é imutável.';
    END IF;
    IF NEW.NR_VERSAO <> -1 AND NEW.NR_VERSAO <= 0 THEN
        RAISE EXCEPTION 'NR_VERSAO deve ser -1 no rascunho ou positivo na publicação.';
    END IF;
    IF NEW.NR_VERSAO = -1 AND (NEW.ID_USUARIO_PUBLICOU IS NOT NULL OR NEW.DT_PUBLICACAO IS NOT NULL) THEN
        RAISE EXCEPTION 'Rascunho não pode conter dados de publicação.';
    END IF;
    IF NEW.NR_VERSAO > 0 THEN
        IF NEW.ID_USUARIO_PUBLICOU IS NULL OR NEW.DT_PUBLICACAO IS NULL THEN
            RAISE EXCEPTION 'Versão publicada requer publicador e data de publicação.';
        END IF;
        IF TG_OP = 'INSERT' THEN RAISE EXCEPTION 'Crie o rascunho antes de publicar o Protocolo.'; END IF;
        IF EXISTS (SELECT 1 FROM Processos.PROTOCOLOS WHERE ID_PROTOCOLO = NEW.ID_PROTOCOLO AND CD_PREFIXO IS NULL) THEN
            RAISE EXCEPTION 'Defina o prefixo do número dos processos antes de publicar o Protocolo.';
        END IF;

        -- Início: exatamente um nó sem entrada, e ele deve ser uma etapa. Fim: etapas sem encaminhamento.
        SELECT count(*) FILTER (WHERE NOT EXISTS (
                   SELECT 1 FROM Processos.ENCAMINHAMENTOS caminho
                    WHERE caminho.ID_PROTOCOLO_VERSAO = etapa.ID_PROTOCOLO_VERSAO
                      AND caminho.ID_PROXIMA_ETAPA = etapa.ID_PROTOCOLO_ETAPA)),
               count(*) FILTER (WHERE etapa.TP_BLOCO = 'E' AND etapa.ID_ENCAMINHAMENTO IS NULL)
          INTO iniciais, finais FROM Processos.PROTOCOLOS_ETAPAS etapa
         WHERE etapa.ID_PROTOCOLO_VERSAO = NEW.ID_PROTOCOLO_VERSAO;
        IF iniciais <> 1 OR finais < 1 THEN
            RAISE EXCEPTION 'Publicação requer uma etapa após o início e pelo menos uma etapa que leve ao fim.';
        END IF;

        -- M-01: regras do concentrador.
        IF EXISTS (SELECT 1 FROM Processos.PROTOCOLOS_ETAPAS j
                    WHERE j.ID_PROTOCOLO_VERSAO = NEW.ID_PROTOCOLO_VERSAO AND j.TP_BLOCO = 'J'
                      AND (j.ID_ENCAMINHAMENTO IS NULL
                           OR NOT EXISTS (SELECT 1 FROM Processos.ENCAMINHAMENTOS c
                                           WHERE c.ID_PROTOCOLO_VERSAO = j.ID_PROTOCOLO_VERSAO
                                             AND c.ID_PROXIMA_ETAPA = j.ID_PROTOCOLO_ETAPA))) THEN
            RAISE EXCEPTION 'Concentrador precisa receber ramos e ter um encaminhamento de saída; não pode iniciar nem encerrar o fluxo.';
        END IF;
        IF EXISTS (SELECT 1 FROM Processos.PROTOCOLOS_ETAPAS j
                     JOIN Processos.PROTOCOLO_ETAPA_DESTINATARIOS d ON d.ID_PROTOCOLO_ETAPA = j.ID_PROTOCOLO_ETAPA
                    WHERE j.ID_PROTOCOLO_VERSAO = NEW.ID_PROTOCOLO_VERSAO AND j.TP_BLOCO = 'J') THEN
            RAISE EXCEPTION 'Concentrador não tem destinatários.';
        END IF;

        -- M-01: resultado padrão obrigatório nas etapas finais e proibido nas demais.
        IF EXISTS (SELECT 1 FROM Processos.PROTOCOLOS_ETAPAS e
                    WHERE e.ID_PROTOCOLO_VERSAO = NEW.ID_PROTOCOLO_VERSAO AND e.TP_BLOCO = 'E'
                      AND (e.ID_ENCAMINHAMENTO IS NULL) <> (e.TP_RESULTADO_PADRAO IS NOT NULL)) THEN
            RAISE EXCEPTION 'Toda etapa final precisa de resultado padrão (P ou N), e só etapas finais o possuem.';
        END IF;

        -- 4.1: tipos de cadeia permitidos (direta, paralela, paralela condicional, decisão com "caso contrário").
        FOR no_fluxo IN SELECT ID_PROTOCOLO_ETAPA, DS_TITULO, ID_ENCAMINHAMENTO FROM Processos.PROTOCOLOS_ETAPAS
                         WHERE ID_PROTOCOLO_VERSAO = NEW.ID_PROTOCOLO_VERSAO AND ID_ENCAMINHAMENTO IS NOT NULL LOOP
            tipos := ARRAY[]::text[];
            atual := no_fluxo.ID_ENCAMINHAMENTO;
            passos := 0;
            WHILE atual IS NOT NULL LOOP
                passos := passos + 1;
                IF passos > 500 THEN
                    RAISE EXCEPTION 'Cadeia de encaminhamentos de "%" contém ciclo.', no_fluxo.DS_TITULO;
                END IF;
                SELECT tipos || TP_ENCAMINHAMENTO::text, ID_PROXIMO_ENCAMINHAMENTO INTO tipos, atual
                  FROM Processos.ENCAMINHAMENTOS WHERE ID_ENCAMINHAMENTO = atual;
            END LOOP;
            IF 'T' = ANY (tipos) THEN
                IF array_length(tipos, 1) < 2 OR tipos[array_length(tipos, 1)] <> 'E'
                   OR EXISTS (SELECT 1 FROM unnest(tipos[1:array_length(tipos, 1) - 1]) t WHERE t <> 'T') THEN
                    RAISE EXCEPTION 'Decisão em "%" deve ter só testes e terminar em um encaminhamento direto ("caso contrário").', no_fluxo.DS_TITULO;
                END IF;
            ELSIF 'C' = ANY (tipos) AND NOT 'E' = ANY (tipos) THEN
                RAISE EXCEPTION 'Paralelo condicional em "%" precisa de ao menos um ramo direto, que sempre dispara.', no_fluxo.DS_TITULO;
            END IF;
        END LOOP;

        IF EXISTS (SELECT 1 FROM Processos.PROTOCOLOS_ETAPAS e
                    WHERE e.ID_PROTOCOLO_VERSAO = NEW.ID_PROTOCOLO_VERSAO AND e.TP_BLOCO = 'E'
                      AND NOT EXISTS (SELECT 1 FROM Processos.PROTOCOLO_ETAPA_DESTINATARIOS d
                                      WHERE d.ID_PROTOCOLO_ETAPA = e.ID_PROTOCOLO_ETAPA)) THEN
            RAISE EXCEPTION 'Cada etapa precisa ter pelo menos uma regra de destinatários.';
        END IF;
        IF EXISTS (SELECT 1 FROM Cadastro.INSTITUICAO WHERE ID_INSTITUICAO = 1 AND NOT SN_PERMITIR_DESTINATARIOS_UNICOS)
           AND EXISTS (
               SELECT 1 FROM Processos.PROTOCOLOS_ETAPAS e
                WHERE e.ID_PROTOCOLO_VERSAO = NEW.ID_PROTOCOLO_VERSAO AND e.TP_BLOCO = 'E'
                  AND NOT EXISTS (SELECT 1 FROM Processos.PROTOCOLO_ETAPA_DESTINATARIOS d
                                   WHERE d.ID_PROTOCOLO_ETAPA = e.ID_PROTOCOLO_ETAPA
                                     AND (d.ID_GRUPO IS NOT NULL OR d.CD_TAG_GRUPO IS NOT NULL
                                          OR d.CD_TAG_USUARIO IS NOT NULL OR d.CD_TAG_VINCULO IS NOT NULL))
           ) THEN
            RAISE EXCEPTION 'Política institucional exige destinatário não nominal em cada etapa.';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validar_versao_protocolo BEFORE INSERT OR UPDATE OR DELETE ON Processos.PROTOCOLO_VERSOES
FOR EACH ROW EXECUTE FUNCTION Processos.validar_versao_protocolo();

CREATE OR REPLACE FUNCTION Processos.exigir_gestor_elegivel_publicacao() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.NR_VERSAO > 0 AND NOT EXISTS (SELECT 1 FROM Processos.PROTOCOLO_GESTORES_ELEGIVEIS WHERE ID_PROTOCOLO_VERSAO = NEW.ID_PROTOCOLO_VERSAO) THEN
        RAISE EXCEPTION 'Defina ao menos uma regra de gestor elegível antes de publicar o Protocolo.';
    END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER trg_exigir_gestor_elegivel_publicacao BEFORE INSERT OR UPDATE OF NR_VERSAO ON Processos.PROTOCOLO_VERSOES FOR EACH ROW EXECUTE FUNCTION Processos.exigir_gestor_elegivel_publicacao();

-- Impede alterações em definições de versões publicadas, inclusive filhos indiretos.
CREATE OR REPLACE FUNCTION Processos.bloquear_definicao_publicada() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
    item jsonb;
    versao uuid;
    bloqueada boolean;
BEGIN
    FOR item IN SELECT valor FROM (VALUES
        (CASE WHEN TG_OP <> 'INSERT' THEN to_jsonb(OLD) END),
        (CASE WHEN TG_OP <> 'DELETE' THEN to_jsonb(NEW) END)
    ) AS dados(valor) WHERE valor IS NOT NULL LOOP
        IF TG_ARGV[0] = 'direta' THEN
            versao := (item ->> 'id_protocolo_versao')::uuid;
            SELECT EXISTS (SELECT 1 FROM Processos.PROTOCOLO_VERSOES
                           WHERE ID_PROTOCOLO_VERSAO = versao AND NR_VERSAO > 0) INTO bloqueada;
        ELSIF TG_ARGV[0] = 'formulario' THEN
            SELECT EXISTS (SELECT 1 FROM Processos.FORMULARIOS f JOIN Processos.PROTOCOLO_VERSOES v USING (ID_PROTOCOLO_VERSAO)
                           WHERE f.ID_FORMULARIO = (item ->> 'id_formulario')::uuid AND v.NR_VERSAO > 0) INTO bloqueada;
        ELSIF TG_ARGV[0] = 'etapa' THEN
            SELECT EXISTS (SELECT 1 FROM Processos.PROTOCOLOS_ETAPAS e JOIN Processos.PROTOCOLO_VERSOES v USING (ID_PROTOCOLO_VERSAO)
                           WHERE e.ID_PROTOCOLO_ETAPA = (item ->> 'id_protocolo_etapa')::uuid AND v.NR_VERSAO > 0) INTO bloqueada;
        ELSIF TG_ARGV[0] = 'variavel' THEN
            SELECT EXISTS (SELECT 1 FROM Processos.PROTOCOLO_VERSAO_VARIAVEIS x JOIN Processos.PROTOCOLO_VERSOES v USING (ID_PROTOCOLO_VERSAO)
                           WHERE x.ID_VARIAVEL = (item ->> 'id_variavel')::uuid AND x.NR_VERSAO = (item ->> 'nr_versao')::integer
                             AND v.NR_VERSAO > 0) INTO bloqueada;
        ELSIF TG_ARGV[0] = 'documento' THEN
            SELECT EXISTS (SELECT 1 FROM Processos.PROTOCOLO_VERSAO_DOCUMENTOS x JOIN Processos.PROTOCOLO_VERSOES v USING (ID_PROTOCOLO_VERSAO)
                           WHERE x.ID_PROTOCOLO_DOCUMENTO_VERSAO = (item ->> 'id_protocolo_documento_versao')::uuid
                             AND v.NR_VERSAO > 0) INTO bloqueada;
        ELSE
            RAISE EXCEPTION 'Tipo de definição desconhecido: %', TG_ARGV[0];
        END IF;
        IF bloqueada THEN RAISE EXCEPTION 'Definição vinculada a uma versão publicada é imutável.'; END IF;
    END LOOP;
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_formularios_publicados BEFORE INSERT OR UPDATE OR DELETE ON Processos.FORMULARIOS FOR EACH ROW EXECUTE FUNCTION Processos.bloquear_definicao_publicada('direta');
CREATE TRIGGER trg_etapas_publicadas BEFORE INSERT OR UPDATE OR DELETE ON Processos.PROTOCOLOS_ETAPAS FOR EACH ROW EXECUTE FUNCTION Processos.bloquear_definicao_publicada('direta');
CREATE TRIGGER trg_versao_variaveis_publicadas BEFORE INSERT OR UPDATE OR DELETE ON Processos.PROTOCOLO_VERSAO_VARIAVEIS FOR EACH ROW EXECUTE FUNCTION Processos.bloquear_definicao_publicada('direta');
CREATE TRIGGER trg_encaminhamentos_publicados BEFORE INSERT OR UPDATE OR DELETE ON Processos.ENCAMINHAMENTOS FOR EACH ROW EXECUTE FUNCTION Processos.bloquear_definicao_publicada('direta');
CREATE TRIGGER trg_gestores_elegiveis_publicados BEFORE INSERT OR UPDATE OR DELETE ON Processos.PROTOCOLO_GESTORES_ELEGIVEIS FOR EACH ROW EXECUTE FUNCTION Processos.bloquear_definicao_publicada('direta');
CREATE TRIGGER trg_versao_documentos_publicados BEFORE INSERT OR UPDATE OR DELETE ON Processos.PROTOCOLO_VERSAO_DOCUMENTOS FOR EACH ROW EXECUTE FUNCTION Processos.bloquear_definicao_publicada('direta');
CREATE TRIGGER trg_formulario_variaveis_publicadas BEFORE INSERT OR UPDATE OR DELETE ON Processos.FORMULARIO_VARIAVEIS FOR EACH ROW EXECUTE FUNCTION Processos.bloquear_definicao_publicada('formulario');
CREATE TRIGGER trg_etapa_destinatarios_publicados BEFORE INSERT OR UPDATE OR DELETE ON Processos.PROTOCOLO_ETAPA_DESTINATARIOS FOR EACH ROW EXECUTE FUNCTION Processos.bloquear_definicao_publicada('etapa');
CREATE TRIGGER trg_variavel_versoes_publicadas BEFORE INSERT OR UPDATE OR DELETE ON Processos.PROTOCOLO_VARIAVEL_VERSOES FOR EACH ROW EXECUTE FUNCTION Processos.bloquear_definicao_publicada('variavel');
CREATE TRIGGER trg_documento_versoes_publicadas BEFORE UPDATE OR DELETE ON Processos.PROTOCOLO_DOCUMENTO_VERSOES FOR EACH ROW EXECUTE FUNCTION Processos.bloquear_definicao_publicada('documento');
CREATE TRIGGER trg_documento_html_publicado BEFORE INSERT OR UPDATE OR DELETE ON Processos.PROTOCOLO_DOCUMENTO_HTML FOR EACH ROW EXECUTE FUNCTION Processos.bloquear_definicao_publicada('documento');
CREATE TRIGGER trg_documento_html_parte_publicada BEFORE INSERT OR UPDATE OR DELETE ON Processos.PROTOCOLO_DOCUMENTO_HTML_PARTES FOR EACH ROW EXECUTE FUNCTION Processos.bloquear_definicao_publicada('documento');
CREATE TRIGGER trg_documento_html_css_publicado BEFORE INSERT OR UPDATE OR DELETE ON Processos.PROTOCOLO_DOCUMENTO_HTML_CSS FOR EACH ROW EXECUTE FUNCTION Processos.bloquear_definicao_publicada('documento');
CREATE TRIGGER trg_documento_pdf_publicado BEFORE INSERT OR UPDATE OR DELETE ON Processos.PROTOCOLO_DOCUMENTO_PDF FOR EACH ROW EXECUTE FUNCTION Processos.bloquear_definicao_publicada('documento');
CREATE TRIGGER trg_documento_pdf_campo_publicado BEFORE INSERT OR UPDATE OR DELETE ON Processos.PROTOCOLO_DOCUMENTO_PDF_CAMPOS FOR EACH ROW EXECUTE FUNCTION Processos.bloquear_definicao_publicada('documento');

CREATE OR REPLACE FUNCTION Processos.bloquear_identidade_publicada() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
    usada boolean;
BEGIN
    IF TG_ARGV[0] = 'variavel' THEN
        SELECT EXISTS (SELECT 1 FROM Processos.PROTOCOLO_VERSAO_VARIAVEIS x
                       JOIN Processos.PROTOCOLO_VERSOES v USING (ID_PROTOCOLO_VERSAO)
                       WHERE x.ID_VARIAVEL = OLD.ID_VARIAVEL AND v.NR_VERSAO > 0) INTO usada;
    ELSE
        SELECT EXISTS (SELECT 1 FROM Processos.PROTOCOLO_VERSAO_DOCUMENTOS x
                       JOIN Processos.PROTOCOLO_VERSOES v USING (ID_PROTOCOLO_VERSAO)
                       WHERE x.ID_PROTOCOLO_DOCUMENTO = OLD.ID_PROTOCOLO_DOCUMENTO AND v.NR_VERSAO > 0) INTO usada;
    END IF;
    IF usada THEN RAISE EXCEPTION 'Identidade usada por versão publicada não pode ser alterada ou excluída.'; END IF;
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER trg_variavel_identidade_publicada BEFORE UPDATE OR DELETE ON Processos.PROTOCOLO_VARIAVEIS
FOR EACH ROW EXECUTE FUNCTION Processos.bloquear_identidade_publicada('variavel');
CREATE TRIGGER trg_documento_identidade_publicada BEFORE UPDATE OR DELETE ON Processos.PROTOCOLO_DOCUMENTOS
FOR EACH ROW EXECUTE FUNCTION Processos.bloquear_identidade_publicada('documento');

-- Relações que devem permanecer dentro da mesma versão do Protocolo.
CREATE OR REPLACE FUNCTION Processos.validar_etapa_formulario() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    -- O concentrador (TP_BLOCO = 'J') não tem formulário; ck_etapa_formulario garante formulário nas etapas.
    IF NEW.ID_FORMULARIO IS NOT NULL AND NOT EXISTS
       (SELECT 1 FROM Processos.FORMULARIOS WHERE ID_FORMULARIO = NEW.ID_FORMULARIO
        AND ID_PROTOCOLO_VERSAO = NEW.ID_PROTOCOLO_VERSAO) THEN
        RAISE EXCEPTION 'Formulário e etapa devem pertencer à mesma versão do Protocolo.';
    END IF;
    IF NEW.ID_ENCAMINHAMENTO IS NOT NULL AND NOT EXISTS
       (SELECT 1 FROM Processos.ENCAMINHAMENTOS WHERE ID_ENCAMINHAMENTO = NEW.ID_ENCAMINHAMENTO
        AND ID_PROTOCOLO_VERSAO = NEW.ID_PROTOCOLO_VERSAO) THEN
        RAISE EXCEPTION 'Encaminhamento de saída pertence a outra versão do Protocolo.';
    END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER trg_validar_etapa_formulario BEFORE INSERT OR UPDATE ON Processos.PROTOCOLOS_ETAPAS
FOR EACH ROW EXECUTE FUNCTION Processos.validar_etapa_formulario();

CREATE OR REPLACE FUNCTION Processos.validar_encaminhamento() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM Processos.PROTOCOLOS_ETAPAS WHERE ID_PROTOCOLO_ETAPA = NEW.ID_PROXIMA_ETAPA
                   AND ID_PROTOCOLO_VERSAO = NEW.ID_PROTOCOLO_VERSAO) THEN
        RAISE EXCEPTION 'Destino do encaminhamento pertence a outra versão do Protocolo.';
    END IF;
    IF NEW.ID_PROXIMO_ENCAMINHAMENTO IS NOT NULL AND NOT EXISTS
       (SELECT 1 FROM Processos.ENCAMINHAMENTOS WHERE ID_ENCAMINHAMENTO = NEW.ID_PROXIMO_ENCAMINHAMENTO
        AND ID_PROTOCOLO_VERSAO = NEW.ID_PROTOCOLO_VERSAO) THEN
        RAISE EXCEPTION 'Próximo encaminhamento pertence a outra versão do Protocolo.';
    END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER trg_validar_encaminhamento BEFORE INSERT OR UPDATE ON Processos.ENCAMINHAMENTOS
FOR EACH ROW EXECUTE FUNCTION Processos.validar_encaminhamento();

CREATE OR REPLACE FUNCTION Processos.validar_versao_variavel() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM Processos.PROTOCOLO_VERSOES pv JOIN Processos.PROTOCOLO_VARIAVEIS x
                   ON x.ID_PROTOCOLO = pv.ID_PROTOCOLO WHERE pv.ID_PROTOCOLO_VERSAO = NEW.ID_PROTOCOLO_VERSAO
                   AND x.ID_VARIAVEL = NEW.ID_VARIAVEL) THEN
        RAISE EXCEPTION 'Variável não pertence ao Protocolo da versão.';
    END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER trg_validar_versao_variavel BEFORE INSERT OR UPDATE ON Processos.PROTOCOLO_VERSAO_VARIAVEIS
FOR EACH ROW EXECUTE FUNCTION Processos.validar_versao_variavel();

CREATE OR REPLACE FUNCTION Processos.validar_formulario_variavel() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM Processos.FORMULARIOS f JOIN Processos.PROTOCOLO_VERSAO_VARIAVEIS v
                   ON v.ID_PROTOCOLO_VERSAO = f.ID_PROTOCOLO_VERSAO WHERE f.ID_FORMULARIO = NEW.ID_FORMULARIO
                   AND v.ID_VARIAVEL = NEW.ID_VARIAVEL) THEN
        RAISE EXCEPTION 'Variável do formulário não está selecionada na versão do Protocolo.';
    END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER trg_validar_formulario_variavel BEFORE INSERT OR UPDATE ON Processos.FORMULARIO_VARIAVEIS
FOR EACH ROW EXECUTE FUNCTION Processos.validar_formulario_variavel();

CREATE OR REPLACE FUNCTION Processos.validar_versao_documento() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM Processos.PROTOCOLO_VERSOES v JOIN Processos.PROTOCOLO_DOCUMENTOS d
                   ON d.ID_PROTOCOLO = v.ID_PROTOCOLO WHERE v.ID_PROTOCOLO_VERSAO = NEW.ID_PROTOCOLO_VERSAO
                   AND d.ID_PROTOCOLO_DOCUMENTO = NEW.ID_PROTOCOLO_DOCUMENTO) THEN
        RAISE EXCEPTION 'Documento não pertence ao Protocolo da versão.';
    END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER trg_validar_versao_documento BEFORE INSERT OR UPDATE ON Processos.PROTOCOLO_VERSAO_DOCUMENTOS
FOR EACH ROW EXECUTE FUNCTION Processos.validar_versao_documento();

CREATE OR REPLACE FUNCTION Processos.validar_regra_participacao() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.ID_USUARIO_SISTEMA IS NULL AND NEW.ID_GRUPO IS NULL
       AND NEW.CD_TAG_GRUPO IS NULL AND NEW.CD_TAG_USUARIO IS NULL AND NEW.CD_TAG_VINCULO IS NULL THEN
        RAISE EXCEPTION 'Regra de participação precisa indicar usuário, grupo ou tag.';
    END IF;
    IF NEW.CD_TAG_GRUPO IS NOT NULL AND NOT EXISTS
       (SELECT 1 FROM Cadastro.TAGS WHERE CD_TAG = NEW.CD_TAG_GRUPO AND SN_GRUPO AND SN_ATIVA) THEN
        RAISE EXCEPTION 'Tag de grupo não está ativa e habilitada para grupos.';
    END IF;
    IF NEW.CD_TAG_USUARIO IS NOT NULL AND NOT EXISTS
       (SELECT 1 FROM Cadastro.TAGS WHERE CD_TAG = NEW.CD_TAG_USUARIO AND SN_USUARIO AND SN_ATIVA) THEN
        RAISE EXCEPTION 'Tag de usuário não está ativa e habilitada para usuários.';
    END IF;
    IF NEW.CD_TAG_VINCULO IS NOT NULL AND NOT EXISTS
       (SELECT 1 FROM Cadastro.TAGS WHERE CD_TAG = NEW.CD_TAG_VINCULO AND SN_VINCULO AND SN_ATIVA) THEN
        RAISE EXCEPTION 'Tag de vínculo não está ativa e habilitada para vínculos.';
    END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER trg_destinatario_tags BEFORE INSERT OR UPDATE ON Processos.PROTOCOLO_ETAPA_DESTINATARIOS
FOR EACH ROW EXECUTE FUNCTION Processos.validar_regra_participacao();
CREATE TRIGGER trg_gestor_elegivel_tags BEFORE INSERT OR UPDATE ON Processos.PROTOCOLO_GESTORES_ELEGIVEIS
FOR EACH ROW EXECUTE FUNCTION Processos.validar_regra_participacao();

-- A etapa executada e o documento gerado precisam pertencer à versão do Processo.
CREATE OR REPLACE FUNCTION Processos.validar_processo_protocolo() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM Processos.PROTOCOLO_VERSOES WHERE ID_PROTOCOLO_VERSAO = NEW.ID_PROTOCOLO_VERSAO
                   AND NR_VERSAO > 0) THEN
        RAISE EXCEPTION 'Processo só pode utilizar versão publicada de Protocolo.';
    END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER trg_validar_processo_protocolo BEFORE INSERT OR UPDATE OF ID_PROTOCOLO_VERSAO ON Processos.PROCESSOS
FOR EACH ROW EXECUTE FUNCTION Processos.validar_processo_protocolo();

CREATE OR REPLACE FUNCTION Processos.validar_processo_etapa() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM Processos.PROCESSOS p JOIN Processos.PROTOCOLOS_ETAPAS e
                   ON e.ID_PROTOCOLO_VERSAO = p.ID_PROTOCOLO_VERSAO
                   WHERE p.ID_PROCESSO = NEW.ID_PROCESSO AND e.ID_PROTOCOLO_ETAPA = NEW.ID_PROTOCOLO_ETAPA) THEN
        RAISE EXCEPTION 'Etapa não pertence à versão do Protocolo utilizada pelo Processo.';
    END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER trg_validar_processo_etapa BEFORE INSERT OR UPDATE ON Processos.PROCESSO_ETAPAS
FOR EACH ROW EXECUTE FUNCTION Processos.validar_processo_etapa();

CREATE OR REPLACE FUNCTION Processos.validar_passagem_encaminhamento() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
    id_versao uuid;
BEGIN
    SELECT ID_PROTOCOLO_VERSAO INTO id_versao FROM Processos.PROCESSOS WHERE ID_PROCESSO = NEW.ID_PROCESSO;
    IF NOT EXISTS (SELECT 1 FROM Processos.PROTOCOLOS_ETAPAS
                   WHERE ID_PROTOCOLO_ETAPA = NEW.ID_PROTOCOLO_ETAPA_DESTINO AND ID_PROTOCOLO_VERSAO = id_versao) THEN
        RAISE EXCEPTION 'Destino não pertence à versão do Protocolo deste Processo.';
    END IF;
    IF NEW.ID_ENCAMINHAMENTO IS NOT NULL AND NOT EXISTS
       (SELECT 1 FROM Processos.ENCAMINHAMENTOS
        WHERE ID_ENCAMINHAMENTO = NEW.ID_ENCAMINHAMENTO AND ID_PROTOCOLO_VERSAO = id_versao
          AND ID_PROXIMA_ETAPA = NEW.ID_PROTOCOLO_ETAPA_DESTINO) THEN
        RAISE EXCEPTION 'Encaminhamento não leva ao destino desta passagem.';
    END IF;
    IF NEW.ID_PROCESSO_ETAPA IS NOT NULL AND NOT EXISTS
       (SELECT 1 FROM Processos.PROCESSO_ETAPAS
        WHERE ID_PROCESSO_ETAPA = NEW.ID_PROCESSO_ETAPA AND ID_PROCESSO = NEW.ID_PROCESSO
          AND ID_PROTOCOLO_ETAPA = NEW.ID_PROTOCOLO_ETAPA_DESTINO
          AND NR_PASSAGEM = NEW.NR_PASSAGEM_DESTINO) THEN
        RAISE EXCEPTION 'Instância de destino não corresponde à etapa e passagem registradas.';
    END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER trg_validar_passagem_encaminhamento BEFORE INSERT OR UPDATE ON Processos.PROCESSO_ETAPA_ENCAMINHAMENTOS
FOR EACH ROW EXECUTE FUNCTION Processos.validar_passagem_encaminhamento();

CREATE OR REPLACE FUNCTION Processos.validar_processo_documento() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM Processos.PROCESSOS p JOIN Processos.PROTOCOLO_VERSAO_DOCUMENTOS d
                   ON d.ID_PROTOCOLO_VERSAO = p.ID_PROTOCOLO_VERSAO
                   WHERE p.ID_PROCESSO = NEW.ID_PROCESSO
                     AND d.ID_PROTOCOLO_DOCUMENTO_VERSAO = NEW.ID_PROTOCOLO_DOCUMENTO_VERSAO) THEN
        RAISE EXCEPTION 'Documento não foi selecionado pela versão do Protocolo deste Processo.';
    END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER trg_validar_processo_documento BEFORE INSERT OR UPDATE ON Processos.PROCESSO_DOCUMENTO
FOR EACH ROW EXECUTE FUNCTION Processos.validar_processo_documento();

-- O PDF de origem deve estar em uma subpasta da pasta do Protocolo.
CREATE OR REPLACE FUNCTION Processos.validar_pdf_protocolo() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM Processos.PROTOCOLO_DOCUMENTO_VERSOES dv
        JOIN Processos.PROTOCOLO_DOCUMENTOS d USING (ID_PROTOCOLO_DOCUMENTO)
        JOIN Processos.PROTOCOLOS p USING (ID_PROTOCOLO)
        JOIN Docs.ARQUIVO_VERSOES av ON av.ID_ARQUIVO_VERSAO = NEW.ID_ARQUIVO_MODELO_PDF
        JOIN Docs.ARQUIVOS a ON a.ID_ARQUIVO = av.ID_ARQUIVO
        JOIN Docs.PASTAS pasta ON pasta.ID_PASTA = a.ID_PASTA
        WHERE dv.ID_PROTOCOLO_DOCUMENTO_VERSAO = NEW.ID_PROTOCOLO_DOCUMENTO_VERSAO
          AND lower(a.CD_CONTENT_TYPE) = 'application/pdf'
          AND a.DT_LIXEIRA IS NULL AND a.DT_EXCLUSAO IS NULL
          AND pasta.ID_PASTA_PAI = p.ID_PASTA
          AND pasta.DT_LIXEIRA IS NULL AND pasta.DT_EXCLUSAO IS NULL
    ) THEN
        RAISE EXCEPTION 'PDF de origem deve estar ativo em uma subpasta do Protocolo.';
    END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER trg_validar_pdf_protocolo BEFORE INSERT OR UPDATE ON Processos.PROTOCOLO_DOCUMENTO_PDF
FOR EACH ROW EXECUTE FUNCTION Processos.validar_pdf_protocolo();

CREATE OR REPLACE FUNCTION Processos.validar_pdf_campo() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.ID_ATRIBUTO IS NOT NULL THEN
        RETURN NEW;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM Processos.PROTOCOLO_DOCUMENTO_VERSOES dv
        JOIN Processos.PROTOCOLO_DOCUMENTOS d USING (ID_PROTOCOLO_DOCUMENTO)
        JOIN Processos.PROTOCOLO_VARIAVEIS v ON v.ID_PROTOCOLO = d.ID_PROTOCOLO
        WHERE dv.ID_PROTOCOLO_DOCUMENTO_VERSAO = NEW.ID_PROTOCOLO_DOCUMENTO_VERSAO
          AND v.ID_VARIAVEL = NEW.ID_VARIAVEL
    ) THEN
        RAISE EXCEPTION 'Campo do PDF deve usar variável do mesmo Protocolo.';
    END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER trg_validar_pdf_campo BEFORE INSERT OR UPDATE ON Processos.PROTOCOLO_DOCUMENTO_PDF_CAMPOS
FOR EACH ROW EXECUTE FUNCTION Processos.validar_pdf_campo();

-- Impede que um PDF referenciado deixe de ser legível por lixeira, mudança de MIME ou pasta.
CREATE OR REPLACE FUNCTION Processos.proteger_arquivo_pdf_referenciado() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM Docs.ARQUIVO_VERSOES av JOIN Processos.PROTOCOLO_DOCUMENTO_PDF pdf
                   ON pdf.ID_ARQUIVO_MODELO_PDF = av.ID_ARQUIVO_VERSAO WHERE av.ID_ARQUIVO = OLD.ID_ARQUIVO) THEN
        IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
        RETURN NEW;
    END IF;
    IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Arquivo PDF ainda referenciado por um Protocolo.'; END IF;
    IF NEW.ID_PASTA IS DISTINCT FROM OLD.ID_PASTA OR NEW.CD_CONTENT_TYPE IS DISTINCT FROM OLD.CD_CONTENT_TYPE
       OR NEW.DT_LIXEIRA IS NOT NULL OR NEW.DT_EXCLUSAO IS NOT NULL THEN
        IF NEW.DT_LIXEIRA IS NOT NULL OR NEW.DT_EXCLUSAO IS NOT NULL
           OR lower(NEW.CD_CONTENT_TYPE) IS DISTINCT FROM 'application/pdf'
           OR EXISTS (
               SELECT 1 FROM Docs.ARQUIVO_VERSOES av
               JOIN Processos.PROTOCOLO_DOCUMENTO_PDF pdf ON pdf.ID_ARQUIVO_MODELO_PDF = av.ID_ARQUIVO_VERSAO
               JOIN Processos.PROTOCOLO_DOCUMENTO_VERSOES dv USING (ID_PROTOCOLO_DOCUMENTO_VERSAO)
               JOIN Processos.PROTOCOLO_DOCUMENTOS d USING (ID_PROTOCOLO_DOCUMENTO)
               JOIN Processos.PROTOCOLOS p USING (ID_PROTOCOLO)
               LEFT JOIN Docs.PASTAS pasta ON pasta.ID_PASTA = NEW.ID_PASTA
               WHERE av.ID_ARQUIVO = OLD.ID_ARQUIVO
                 AND (pasta.ID_PASTA IS NULL OR pasta.ID_PASTA_PAI IS DISTINCT FROM p.ID_PASTA
                      OR pasta.DT_LIXEIRA IS NOT NULL OR pasta.DT_EXCLUSAO IS NOT NULL)
           ) THEN
            RAISE EXCEPTION 'Alteração deixaria indisponível um PDF de Protocolo.';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER trg_proteger_arquivo_pdf BEFORE UPDATE OF ID_PASTA, CD_CONTENT_TYPE, DT_LIXEIRA, DT_EXCLUSAO OR DELETE ON Docs.ARQUIVOS
FOR EACH ROW EXECUTE FUNCTION Processos.proteger_arquivo_pdf_referenciado();

CREATE OR REPLACE FUNCTION Processos.proteger_pasta_pdf_referenciado() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM Docs.ARQUIVOS a JOIN Docs.ARQUIVO_VERSOES av USING (ID_ARQUIVO)
                   JOIN Processos.PROTOCOLO_DOCUMENTO_PDF pdf ON pdf.ID_ARQUIVO_MODELO_PDF = av.ID_ARQUIVO_VERSAO
                   WHERE a.ID_PASTA = OLD.ID_PASTA) THEN
        IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
        RETURN NEW;
    END IF;
    IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Pasta contém PDF referenciado por um Protocolo.'; END IF;
    IF NEW.DT_LIXEIRA IS NOT NULL OR NEW.DT_EXCLUSAO IS NOT NULL OR EXISTS (
        SELECT 1 FROM Docs.ARQUIVOS a JOIN Docs.ARQUIVO_VERSOES av USING (ID_ARQUIVO)
        JOIN Processos.PROTOCOLO_DOCUMENTO_PDF pdf ON pdf.ID_ARQUIVO_MODELO_PDF = av.ID_ARQUIVO_VERSAO
        JOIN Processos.PROTOCOLO_DOCUMENTO_VERSOES dv USING (ID_PROTOCOLO_DOCUMENTO_VERSAO)
        JOIN Processos.PROTOCOLO_DOCUMENTOS d USING (ID_PROTOCOLO_DOCUMENTO)
        JOIN Processos.PROTOCOLOS p USING (ID_PROTOCOLO)
        WHERE a.ID_PASTA = OLD.ID_PASTA AND NEW.ID_PASTA_PAI IS DISTINCT FROM p.ID_PASTA
    ) THEN
        RAISE EXCEPTION 'Pasta de PDF referenciado deve permanecer ativa e sob o Protocolo.';
    END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER trg_proteger_pasta_pdf BEFORE UPDATE OF ID_PASTA_PAI, DT_LIXEIRA, DT_EXCLUSAO OR DELETE ON Docs.PASTAS
FOR EACH ROW EXECUTE FUNCTION Processos.proteger_pasta_pdf_referenciado();

-- O responsável atual da etapa deve ser o único vínculo de responsabilidade vigente.
-- A verificação é diferida para permitir inserir o histórico e atualizar a etapa na mesma transação.
CREATE OR REPLACE FUNCTION Processos.validar_responsavel_vigente() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
    id_etapa uuid;
    id_atual uuid;
    id_historico uuid;
    quantidade integer;
BEGIN
    FOR id_etapa IN SELECT DISTINCT valor FROM (VALUES
        (CASE WHEN TG_OP <> 'INSERT' THEN OLD.ID_PROCESSO_ETAPA END),
        (CASE WHEN TG_OP <> 'DELETE' THEN NEW.ID_PROCESSO_ETAPA END)
    ) AS ids(valor) WHERE valor IS NOT NULL LOOP
        SELECT ID_USUARIO_RESPONSAVEL INTO id_atual FROM Processos.PROCESSO_ETAPAS
         WHERE ID_PROCESSO_ETAPA = id_etapa;
        IF NOT FOUND THEN CONTINUE; END IF;
        SELECT count(*) INTO quantidade
          FROM Processos.PROCESSO_ETAPA_RESPONSAVEIS
         WHERE ID_PROCESSO_ETAPA = id_etapa AND DT_FIM IS NULL;
        SELECT ID_USUARIO_SISTEMA INTO id_historico
          FROM Processos.PROCESSO_ETAPA_RESPONSAVEIS
         WHERE ID_PROCESSO_ETAPA = id_etapa AND DT_FIM IS NULL LIMIT 1;
        IF (id_atual IS NULL AND quantidade <> 0)
           OR (id_atual IS NOT NULL AND (quantidade <> 1 OR id_atual IS DISTINCT FROM id_historico)) THEN
            RAISE EXCEPTION 'Responsável atual diverge do histórico vigente da etapa %.', id_etapa;
        END IF;
    END LOOP;
    RETURN NULL;
END;
$$;
CREATE CONSTRAINT TRIGGER trg_responsavel_vigente_etapa AFTER INSERT OR UPDATE OR DELETE ON Processos.PROCESSO_ETAPAS
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION Processos.validar_responsavel_vigente();
CREATE CONSTRAINT TRIGGER trg_responsavel_vigente_historico AFTER INSERT OR UPDATE OR DELETE ON Processos.PROCESSO_ETAPA_RESPONSAVEIS
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION Processos.validar_responsavel_vigente();

-- M-03: número do processo. Gerado no INSERT, com incremento atômico por protocolo e ano; imutável.
CREATE OR REPLACE FUNCTION Processos.numerar_processo() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
    protocolo uuid;
    prefixo text;
    sequencia char(1);
    fuso text;
    ano smallint;
    numero integer;
BEGIN
    IF TG_OP = 'UPDATE' THEN
        IF NEW.CD_NUMERO IS DISTINCT FROM OLD.CD_NUMERO THEN
            RAISE EXCEPTION 'O número do processo é imutável.';
        END IF;
        RETURN NEW;
    END IF;
    IF NEW.CD_NUMERO IS NOT NULL THEN RETURN NEW; END IF;

    SELECT p.ID_PROTOCOLO, p.CD_PREFIXO, p.TP_SEQUENCIA INTO protocolo, prefixo, sequencia
      FROM Processos.PROTOCOLO_VERSOES v JOIN Processos.PROTOCOLOS p USING (ID_PROTOCOLO)
     WHERE v.ID_PROTOCOLO_VERSAO = NEW.ID_PROTOCOLO_VERSAO;
    IF prefixo IS NULL THEN
        RAISE EXCEPTION 'O Protocolo precisa de prefixo para numerar processos.';
    END IF;
    SELECT CD_FUSO_HORARIO INTO fuso FROM Cadastro.INSTITUICAO WHERE ID_INSTITUICAO = 1;
    ano := CASE WHEN sequencia = 'A'
                THEN extract(year FROM COALESCE(NEW.DT_INICIO, now()) AT TIME ZONE COALESCE(fuso, 'UTC'))::smallint
                ELSE 0 END;

    INSERT INTO Processos.PROTOCOLO_SEQUENCIAS AS s (ID_PROTOCOLO, NR_ANO, NR_ULTIMO)
    VALUES (protocolo, ano, 1)
    ON CONFLICT (ID_PROTOCOLO, NR_ANO) DO UPDATE SET NR_ULTIMO = s.NR_ULTIMO + 1
    RETURNING NR_ULTIMO INTO numero;

    NEW.CD_NUMERO := prefixo || '-' || CASE WHEN ano > 0 THEN ano::text || '-' ELSE '' END || lpad(numero::text, 6, '0');
    RETURN NEW;
END;
$$;
CREATE TRIGGER trg_numerar_processo BEFORE INSERT OR UPDATE OF CD_NUMERO ON Processos.PROCESSOS
FOR EACH ROW EXECUTE FUNCTION Processos.numerar_processo();

-- M-06: grupo de origem = lotação de quem iniciou, gravada no INSERT e imutável.
-- O valor enviado pela aplicação é ignorado; numa alteração, o valor anterior é mantido.
CREATE OR REPLACE FUNCTION Processos.definir_grupo_origem() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    NEW.ID_GRUPO_ORIGEM := OLD.ID_GRUPO_ORIGEM;
    RETURN NEW;
  END IF;
  SELECT vt.ID_GRUPO INTO NEW.ID_GRUPO_ORIGEM
    FROM Cadastro.VINCULO_TAGS vt
   WHERE vt.ID_USUARIO_SISTEMA = NEW.ID_USUARIO_INICIOU AND vt.CD_TAG = 'lotacao' AND vt.SN_ATIVO;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_definir_grupo_origem ON Processos.PROCESSOS;
CREATE TRIGGER trg_definir_grupo_origem BEFORE INSERT OR UPDATE OF ID_GRUPO_ORIGEM ON Processos.PROCESSOS
FOR EACH ROW EXECUTE FUNCTION Processos.definir_grupo_origem();

-- M-01 (b): data limite a partir do prazo. U dias úteis (seg-sex, sem feriados) e C corridos vencem no fim do dia; H horas exatas.
CREATE OR REPLACE FUNCTION Processos.calcular_limite(inicio timestamptz, prazo integer, unidade char) RETURNS timestamptz
LANGUAGE plpgsql STABLE AS $$
DECLARE
    fuso text;
    dia date;
    contados integer := 0;
BEGIN
    IF prazo IS NULL OR unidade IS NULL THEN RETURN NULL; END IF;
    IF unidade = 'H' THEN RETURN inicio + make_interval(hours => prazo); END IF;
    SELECT COALESCE(CD_FUSO_HORARIO, 'UTC') INTO fuso FROM Cadastro.INSTITUICAO WHERE ID_INSTITUICAO = 1;
    fuso := COALESCE(fuso, 'UTC');
    dia := (inicio AT TIME ZONE fuso)::date;
    IF unidade = 'C' THEN
        dia := dia + prazo;
    ELSE
        WHILE contados < prazo LOOP
            dia := dia + 1;
            IF extract(isodow FROM dia) < 6 THEN contados := contados + 1; END IF;
        END LOOP;
    END IF;
    RETURN ((dia + 1)::timestamp - interval '1 second') AT TIME ZONE fuso;
END;
$$;

CREATE OR REPLACE FUNCTION Processos.definir_limite_etapa() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.DT_LIMITE IS NULL THEN
        SELECT Processos.calcular_limite(NEW.DT_DISPONIBILIZACAO, NR_PRAZO, TP_UNIDADE_PRAZO) INTO NEW.DT_LIMITE
          FROM Processos.PROTOCOLOS_ETAPAS WHERE ID_PROTOCOLO_ETAPA = NEW.ID_PROTOCOLO_ETAPA;
    END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER trg_definir_limite_etapa BEFORE INSERT ON Processos.PROCESSO_ETAPAS
FOR EACH ROW EXECUTE FUNCTION Processos.definir_limite_etapa();

-- Opção única (O) usa PROCESSO_VARIAVEL_VALORES.CD_OPCAO; múltipla escolha (C) usa PROCESSO_VARIAVEL_OPCOES.
CREATE OR REPLACE FUNCTION Processos.validar_valor_opcao() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
    tipo char(1);
BEGIN
    IF NEW.CD_OPCAO IS NULL THEN RETURN NEW; END IF;
    SELECT TP_DADO INTO tipo FROM Processos.PROTOCOLO_VARIAVEIS WHERE ID_VARIAVEL = NEW.ID_VARIAVEL;
    IF tipo IS DISTINCT FROM 'O' THEN
        RAISE EXCEPTION 'CD_OPCAO só é usado em campo de opção única (tipo O); múltipla escolha grava em PROCESSO_VARIAVEL_OPCOES.';
    END IF;
    RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_validar_valor_opcao ON Processos.PROCESSO_VARIAVEL_VALORES;
CREATE TRIGGER trg_validar_valor_opcao BEFORE INSERT OR UPDATE OF CD_OPCAO, ID_VARIAVEL ON Processos.PROCESSO_VARIAVEL_VALORES
FOR EACH ROW EXECUTE FUNCTION Processos.validar_valor_opcao();

CREATE OR REPLACE FUNCTION Processos.validar_opcao_multipla() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM Processos.PROTOCOLO_VARIAVEIS WHERE ID_VARIAVEL = NEW.ID_VARIAVEL AND TP_DADO = 'C') THEN
        RAISE EXCEPTION 'PROCESSO_VARIAVEL_OPCOES só aceita campos de múltipla escolha (tipo C).';
    END IF;
    RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_validar_opcao_multipla ON Processos.PROCESSO_VARIAVEL_OPCOES;
CREATE TRIGGER trg_validar_opcao_multipla BEFORE INSERT OR UPDATE ON Processos.PROCESSO_VARIAVEL_OPCOES
FOR EACH ROW EXECUTE FUNCTION Processos.validar_opcao_multipla();

COMMIT;
