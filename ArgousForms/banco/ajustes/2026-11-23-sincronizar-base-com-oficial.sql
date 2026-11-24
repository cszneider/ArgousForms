-- Sincroniza a base de desenvolvimento atual com os scripts oficiais (estrutura/ e regras/).
-- Origem: comparação, em 23/11/2026, do pg_dump --schema-only da base atual com um banco criado do zero pelos scripts oficiais.
-- A base atual não tinha algumas regras que os índices de ajustes davam como aplicadas: triggers de tags e vínculos,
-- exigência de gestor elegível na publicação, restrições de documentos HTML e de publicação, índices únicos de Docs
-- e a versão atual de validar_pdf_campo (campo de PDF com origem na instituição).
-- Executar uma vez, como proprietário dos schemas. Pode ser reexecutado. Se algum dado existente violar uma regra,
-- o script para com a mensagem do PostgreSQL e nada é aplicado (transação única).
BEGIN;

-- 1. Pré-condições
DO $$
DECLARE
    tem_dados boolean := false;
BEGIN
    IF EXISTS (SELECT 1 FROM Cadastro.INSTITUICAO WHERE CD_FUSO_HORARIO IS NULL) THEN
        RAISE EXCEPTION 'Preencha Cadastro.INSTITUICAO.CD_FUSO_HORARIO (ex.: America/Sao_Paulo) antes de aplicar este ajuste.';
    END IF;
    IF to_regclass('processos.recursos_instituicao') IS NOT NULL THEN
        EXECUTE 'SELECT EXISTS (SELECT 1 FROM processos.recursos_instituicao)' INTO tem_dados;
    END IF;
    IF tem_dados THEN
        RAISE EXCEPTION 'A tabela indevida Processos.RECURSOS_INSTITUICAO tem dados; mova-os para Cadastro.RECURSOS_INSTITUICAO antes de aplicar este ajuste.';
    END IF;
END;
$$;

-- 2. Tabela criada por engano no schema Processos (a oficial é Cadastro.RECURSOS_INSTITUICAO).
DROP TABLE IF EXISTS Processos.RECURSOS_INSTITUICAO;

-- 3. Coluna obrigatória
ALTER TABLE Cadastro.INSTITUICAO ALTER COLUMN CD_FUSO_HORARIO SET NOT NULL;

-- 4. Funções (versões oficiais)
CREATE OR REPLACE FUNCTION processos.exigir_gestor_elegivel_publicacao()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    IF NEW.NR_VERSAO > 0 AND NOT EXISTS (SELECT 1 FROM Processos.PROTOCOLO_GESTORES_ELEGIVEIS WHERE ID_PROTOCOLO_VERSAO = NEW.ID_PROTOCOLO_VERSAO) THEN
        RAISE EXCEPTION 'Defina ao menos uma regra de gestor elegível antes de publicar o Protocolo.';
    END IF;
    RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION cadastro.validar_vinculo_tag()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    IF NEW.SN_ATIVO AND NOT EXISTS (
        SELECT 1 FROM Cadastro.USUARIO_GRUPOS ug
        JOIN Cadastro.USUARIOS_SISTEMA u ON u.ID_USUARIO_SISTEMA = ug.ID_USUARIO_SISTEMA
        JOIN Cadastro.GRUPOS g ON g.ID_GRUPO = ug.ID_GRUPO
        JOIN Cadastro.TAGS t ON t.CD_TAG = NEW.CD_TAG
        WHERE ug.ID_USUARIO_SISTEMA = NEW.ID_USUARIO_SISTEMA AND ug.ID_GRUPO = NEW.ID_GRUPO
          AND ug.SN_ATIVO AND u.DT_EXCLUSAO IS NULL AND g.SN_ATIVO AND t.SN_ATIVA AND t.SN_VINCULO
    ) THEN
        RAISE EXCEPTION 'Tag de vínculo ativa exige participação ativa e tag habilitada.';
    END IF;
    RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION processos.bloquear_definicao_publicada()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
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
$function$
;
CREATE OR REPLACE FUNCTION cadastro.validar_alteracao_tag()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    IF NEW.CD_TAG IS DISTINCT FROM OLD.CD_TAG THEN
        RAISE EXCEPTION 'O código da tag não pode ser alterado.';
    END IF;

    IF OLD.SN_GRUPO AND NOT NEW.SN_GRUPO
       AND EXISTS (SELECT 1 FROM Cadastro.GRUPO_TAGS WHERE CD_TAG = OLD.CD_TAG AND SN_ATIVA = true) THEN
        RAISE EXCEPTION 'Remova os vínculos com grupos antes de desmarcar essa aplicação.';
    END IF;

    IF OLD.SN_USUARIO AND NOT NEW.SN_USUARIO
       AND EXISTS (SELECT 1 FROM Cadastro.USUARIO_TAGS WHERE CD_TAG = OLD.CD_TAG AND SN_ATIVA = true) THEN
        RAISE EXCEPTION 'Remova os vínculos com usuários antes de desmarcar essa aplicação.';
    END IF;

    IF OLD.SN_VINCULO AND NOT NEW.SN_VINCULO
       AND EXISTS (SELECT 1 FROM Cadastro.VINCULO_TAGS WHERE CD_TAG = OLD.CD_TAG AND SN_ATIVO = true) THEN
        RAISE EXCEPTION 'Remova os vínculos de usuários em grupos antes de desmarcar essa aplicação.';
    END IF;

    RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION cadastro.validar_vinculo_grupo_tag()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    IF NEW.SN_ATIVA THEN
        PERFORM 1 FROM Cadastro.TAGS
         WHERE CD_TAG = NEW.CD_TAG AND SN_GRUPO = true AND SN_ATIVA = true
         FOR SHARE;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'A tag deve estar ativa e habilitada para grupos.';
        END IF;
    END IF;

    RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION processos.validar_pdf_campo()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
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
$function$
;
CREATE OR REPLACE FUNCTION cadastro.validar_usuario_grupo()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    IF NEW.SN_ATIVO AND NOT EXISTS (
        SELECT 1 FROM Cadastro.USUARIOS_SISTEMA u JOIN Cadastro.GRUPOS g ON g.ID_GRUPO = NEW.ID_GRUPO
        WHERE u.ID_USUARIO_SISTEMA = NEW.ID_USUARIO_SISTEMA AND u.DT_EXCLUSAO IS NULL AND g.SN_ATIVO
    ) THEN
        RAISE EXCEPTION 'Vínculo ativo exige usuário e grupo ativos.';
    END IF;
    RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION cadastro.validar_usuario_tag()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    IF NEW.SN_ATIVA AND NOT EXISTS (
        SELECT 1 FROM Cadastro.USUARIOS_SISTEMA u JOIN Cadastro.TAGS t ON t.CD_TAG = NEW.CD_TAG
        WHERE u.ID_USUARIO_SISTEMA = NEW.ID_USUARIO_SISTEMA AND u.DT_EXCLUSAO IS NULL AND t.SN_ATIVA AND t.SN_USUARIO
    ) THEN
        RAISE EXCEPTION 'Tag de usuário ativa exige usuário ativo e tag habilitada.';
    END IF;
    RETURN NEW;
END;
$function$
;

-- 5. Triggers que faltavam
DROP TRIGGER IF EXISTS trg_validar_usuario_grupo ON cadastro.usuario_grupos; CREATE TRIGGER trg_validar_usuario_grupo BEFORE INSERT OR UPDATE ON cadastro.usuario_grupos FOR EACH ROW EXECUTE FUNCTION cadastro.validar_usuario_grupo();
DROP TRIGGER IF EXISTS trg_validar_usuario_tag ON cadastro.usuario_tags; CREATE TRIGGER trg_validar_usuario_tag BEFORE INSERT OR UPDATE ON cadastro.usuario_tags FOR EACH ROW EXECUTE FUNCTION cadastro.validar_usuario_tag();
DROP TRIGGER IF EXISTS trg_validar_vinculo_grupo_tag ON cadastro.grupo_tags; CREATE TRIGGER trg_validar_vinculo_grupo_tag BEFORE INSERT OR UPDATE ON cadastro.grupo_tags FOR EACH ROW EXECUTE FUNCTION cadastro.validar_vinculo_grupo_tag();
DROP TRIGGER IF EXISTS trg_validar_vinculo_tag ON cadastro.vinculo_tags; CREATE TRIGGER trg_validar_vinculo_tag BEFORE INSERT OR UPDATE ON cadastro.vinculo_tags FOR EACH ROW EXECUTE FUNCTION cadastro.validar_vinculo_tag();
DROP TRIGGER IF EXISTS trg_validar_alteracao_tag ON cadastro.tags; CREATE TRIGGER trg_validar_alteracao_tag BEFORE UPDATE ON cadastro.tags FOR EACH ROW EXECUTE FUNCTION cadastro.validar_alteracao_tag();
DROP TRIGGER IF EXISTS trg_documento_html_publicado ON processos.protocolo_documento_html; CREATE TRIGGER trg_documento_html_publicado BEFORE INSERT OR DELETE OR UPDATE ON processos.protocolo_documento_html FOR EACH ROW EXECUTE FUNCTION processos.bloquear_definicao_publicada('documento');
DROP TRIGGER IF EXISTS trg_exigir_gestor_elegivel_publicacao ON processos.protocolo_versoes; CREATE TRIGGER trg_exigir_gestor_elegivel_publicacao BEFORE INSERT OR UPDATE OF nr_versao ON processos.protocolo_versoes FOR EACH ROW EXECUTE FUNCTION processos.exigir_gestor_elegivel_publicacao();

-- 6. Restrições que faltavam
ALTER TABLE Processos.PROTOCOLO_VERSOES DROP CONSTRAINT IF EXISTS ck_protocolo_versao_publicacao;
ALTER TABLE Processos.PROTOCOLO_VERSOES ADD CONSTRAINT ck_protocolo_versao_publicacao CHECK ((NR_VERSAO = -1 AND TP_SITUACAO = 'R' AND ID_USUARIO_PUBLICOU IS NULL AND DT_PUBLICACAO IS NULL) OR (NR_VERSAO > 0 AND TP_SITUACAO = 'P' AND ID_USUARIO_PUBLICOU IS NOT NULL AND DT_PUBLICACAO IS NOT NULL));
ALTER TABLE Processos.PROTOCOLO_DOCUMENTO_HTML DROP CONSTRAINT IF EXISTS protocolo_documento_html_id_protocolo_documento_versao_fkey;
ALTER TABLE Processos.PROTOCOLO_DOCUMENTO_HTML ADD CONSTRAINT protocolo_documento_html_id_protocolo_documento_versao_fkey FOREIGN KEY (ID_PROTOCOLO_DOCUMENTO_VERSAO) REFERENCES Processos.PROTOCOLO_DOCUMENTO_VERSOES (ID_PROTOCOLO_DOCUMENTO_VERSAO) ON UPDATE RESTRICT ON DELETE RESTRICT;
ALTER TABLE Processos.PROTOCOLO_DOCUMENTO_HTML_PARTES DROP CONSTRAINT IF EXISTS protocolo_documento_html_partes_nr_ordem_check;
ALTER TABLE Processos.PROTOCOLO_DOCUMENTO_HTML_PARTES ADD CONSTRAINT protocolo_documento_html_partes_nr_ordem_check CHECK (NR_ORDEM > 0);
ALTER TABLE Processos.PROTOCOLO_DOCUMENTO_HTML_PARTES DROP CONSTRAINT IF EXISTS protocolo_documento_html_partes_tp_parte_check;
ALTER TABLE Processos.PROTOCOLO_DOCUMENTO_HTML_PARTES ADD CONSTRAINT protocolo_documento_html_partes_tp_parte_check CHECK (TP_PARTE IN ('H', 'A', 'B', 'X', 'F'));
ALTER TABLE Processos.PROTOCOLO_DOCUMENTO_HTML_PARTES DROP CONSTRAINT IF EXISTS protocolo_documento_html_partes_tx_html_check;
ALTER TABLE Processos.PROTOCOLO_DOCUMENTO_HTML_PARTES ADD CONSTRAINT protocolo_documento_html_partes_tx_html_check CHECK (BTRIM(TX_HTML) <> '');

-- 7. Índices únicos de Docs que faltavam
CREATE UNIQUE INDEX IF NOT EXISTS uq_arquivo_versoes_numero ON Docs.ARQUIVO_VERSOES (ID_ARQUIVO, NR_VERSAO);
CREATE UNIQUE INDEX IF NOT EXISTS uq_arquivos_nome_ativo ON Docs.ARQUIVOS (ID_PASTA, DS_NOME_ARQUIVO) WHERE DT_LIXEIRA IS NULL AND DT_EXCLUSAO IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_pastas_raiz ON Docs.PASTAS ((true)) WHERE ID_PASTA_PAI IS NULL;

COMMIT;
