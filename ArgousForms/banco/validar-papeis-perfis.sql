-- ArgousForms: proteção dos papéis, perfis e vínculos históricos.
-- Aplicar como proprietário do esquema Cadastro, APÓS a carga dos registros padrão.
-- Pode ser reaplicado. Não apaga nem modifica dados existentes.

CREATE OR REPLACE FUNCTION Cadastro.validar_papel() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        IF OLD.SN_SISTEMA THEN
            RAISE EXCEPTION 'Papel do sistema não pode ser excluído';
        END IF;
        IF EXISTS (
            SELECT 1 FROM Cadastro.PERFIL_PAPEIS pp
            JOIN Cadastro.USUARIO_PERFIS up ON up.ID_PERFIL = pp.ID_PERFIL
            WHERE pp.ID_PAPEL = OLD.ID_PAPEL
        ) THEN
            RAISE EXCEPTION 'Papel já utilizado deve ser inativado';
        END IF;
        RETURN OLD;
    END IF;

    IF NEW.ID_PAPEL IS DISTINCT FROM OLD.ID_PAPEL
       OR NEW.CD_PAPEL IS DISTINCT FROM OLD.CD_PAPEL
       OR NEW.SN_SISTEMA IS DISTINCT FROM OLD.SN_SISTEMA
       OR NEW.DT_INCLUSAO IS DISTINCT FROM OLD.DT_INCLUSAO THEN
        RAISE EXCEPTION 'Identidade e código do papel não podem ser alterados';
    END IF;
    IF OLD.SN_SISTEMA AND (NEW.SN_ATIVO IS DISTINCT FROM OLD.SN_ATIVO
                           OR NEW.DT_EXCLUSAO IS DISTINCT FROM OLD.DT_EXCLUSAO) THEN
        RAISE EXCEPTION 'Papel do sistema permite alterar somente nome e descrição';
    END IF;
    IF NEW.DT_EXCLUSAO IS NOT NULL AND OLD.DT_EXCLUSAO IS NULL AND EXISTS (
        SELECT 1 FROM Cadastro.PERFIL_PAPEIS pp
        JOIN Cadastro.USUARIO_PERFIS up ON up.ID_PERFIL = pp.ID_PERFIL
        WHERE pp.ID_PAPEL = OLD.ID_PAPEL
    ) THEN
        RAISE EXCEPTION 'Papel já utilizado deve ser inativado';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validar_papel ON Cadastro.PAPEIS;
CREATE TRIGGER trg_validar_papel BEFORE UPDATE OR DELETE ON Cadastro.PAPEIS
FOR EACH ROW EXECUTE FUNCTION Cadastro.validar_papel();

CREATE OR REPLACE FUNCTION Cadastro.validar_perfil() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        IF OLD.SN_SISTEMA THEN
            RAISE EXCEPTION 'Perfil do sistema não pode ser excluído';
        END IF;
        IF EXISTS (SELECT 1 FROM Cadastro.USUARIO_PERFIS WHERE ID_PERFIL = OLD.ID_PERFIL) THEN
            RAISE EXCEPTION 'Perfil já utilizado deve ser inativado';
        END IF;
        RETURN OLD;
    END IF;

    IF NEW.ID_PERFIL IS DISTINCT FROM OLD.ID_PERFIL
       OR NEW.CD_PERFIL IS DISTINCT FROM OLD.CD_PERFIL
       OR NEW.SN_SISTEMA IS DISTINCT FROM OLD.SN_SISTEMA
       OR NEW.DT_INCLUSAO IS DISTINCT FROM OLD.DT_INCLUSAO THEN
        RAISE EXCEPTION 'Identidade e código do perfil não podem ser alterados';
    END IF;
    IF OLD.SN_SISTEMA AND (NEW.SN_ATIVO IS DISTINCT FROM OLD.SN_ATIVO
                           OR NEW.DT_EXCLUSAO IS DISTINCT FROM OLD.DT_EXCLUSAO) THEN
        RAISE EXCEPTION 'Perfil do sistema permite alterar somente nome e descrição';
    END IF;
    IF NEW.DT_EXCLUSAO IS NOT NULL AND OLD.DT_EXCLUSAO IS NULL
       AND EXISTS (SELECT 1 FROM Cadastro.USUARIO_PERFIS WHERE ID_PERFIL = OLD.ID_PERFIL) THEN
        RAISE EXCEPTION 'Perfil já utilizado deve ser inativado';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validar_perfil ON Cadastro.PERFIS;
CREATE TRIGGER trg_validar_perfil BEFORE UPDATE OR DELETE ON Cadastro.PERFIS
FOR EACH ROW EXECUTE FUNCTION Cadastro.validar_perfil();

CREATE OR REPLACE FUNCTION Cadastro.validar_perfil_papel() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    perfil_id uuid;
BEGIN
    perfil_id := CASE WHEN TG_OP = 'INSERT' THEN NEW.ID_PERFIL ELSE OLD.ID_PERFIL END;
    IF EXISTS (SELECT 1 FROM Cadastro.PERFIS WHERE ID_PERFIL = perfil_id AND SN_SISTEMA) THEN
        RAISE EXCEPTION 'Composição de perfil do sistema não pode ser alterada';
    END IF;
    IF TG_OP = 'UPDATE' THEN
        IF NEW.ID_PERFIL_PAPEL IS DISTINCT FROM OLD.ID_PERFIL_PAPEL
           OR NEW.ID_PERFIL IS DISTINCT FROM OLD.ID_PERFIL
           OR NEW.ID_PAPEL IS DISTINCT FROM OLD.ID_PAPEL
           OR NEW.DT_INCLUSAO IS DISTINCT FROM OLD.DT_INCLUSAO THEN
            RAISE EXCEPTION 'Identidade do vínculo perfil-papel não pode ser alterada';
        END IF;
        RETURN NEW;
    END IF;
    IF TG_OP = 'DELETE' THEN
        IF EXISTS (SELECT 1 FROM Cadastro.USUARIO_PERFIS WHERE ID_PERFIL = OLD.ID_PERFIL) THEN
            RAISE EXCEPTION 'Vínculo histórico de perfil atribuído não pode ser excluído';
        END IF;
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validar_perfil_papel ON Cadastro.PERFIL_PAPEIS;
CREATE TRIGGER trg_validar_perfil_papel BEFORE INSERT OR UPDATE OR DELETE ON Cadastro.PERFIL_PAPEIS
FOR EACH ROW EXECUTE FUNCTION Cadastro.validar_perfil_papel();

CREATE OR REPLACE FUNCTION Cadastro.validar_composicao_permissoes_sistema() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    dono_id uuid;
    padrao boolean;
BEGIN
    IF TG_OP = 'UPDATE' THEN
        IF TG_TABLE_NAME = 'papel_permissoes' AND NEW.ID_PAPEL IS DISTINCT FROM OLD.ID_PAPEL THEN
            RAISE EXCEPTION 'Dono da permissão não pode ser alterado';
        END IF;
        IF TG_TABLE_NAME = 'perfil_permissoes' AND NEW.ID_PERFIL IS DISTINCT FROM OLD.ID_PERFIL THEN
            RAISE EXCEPTION 'Dono da permissão não pode ser alterado';
        END IF;
    END IF;
    IF TG_TABLE_NAME = 'papel_permissoes' THEN
        dono_id := CASE WHEN TG_OP = 'INSERT' THEN NEW.ID_PAPEL ELSE OLD.ID_PAPEL END;
        SELECT SN_SISTEMA INTO padrao FROM Cadastro.PAPEIS WHERE ID_PAPEL = dono_id;
    ELSE
        dono_id := CASE WHEN TG_OP = 'INSERT' THEN NEW.ID_PERFIL ELSE OLD.ID_PERFIL END;
        SELECT SN_SISTEMA INTO padrao FROM Cadastro.PERFIS WHERE ID_PERFIL = dono_id;
    END IF;
    IF padrao THEN
        RAISE EXCEPTION 'Permissões de registro do sistema não podem ser alteradas';
    END IF;
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validar_papel_permissoes ON Cadastro.PAPEL_PERMISSOES;
CREATE TRIGGER trg_validar_papel_permissoes BEFORE INSERT OR UPDATE OR DELETE ON Cadastro.PAPEL_PERMISSOES
FOR EACH ROW EXECUTE FUNCTION Cadastro.validar_composicao_permissoes_sistema();
DROP TRIGGER IF EXISTS trg_validar_perfil_permissoes ON Cadastro.PERFIL_PERMISSOES;
CREATE TRIGGER trg_validar_perfil_permissoes BEFORE INSERT OR UPDATE OR DELETE ON Cadastro.PERFIL_PERMISSOES
FOR EACH ROW EXECUTE FUNCTION Cadastro.validar_composicao_permissoes_sistema();

CREATE OR REPLACE FUNCTION Cadastro.preservar_usuario_perfil() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'Atribuição de perfil deve ser revogada, não excluída';
    END IF;
    IF NEW.ID_USUARIO_PERFIL IS DISTINCT FROM OLD.ID_USUARIO_PERFIL
       OR NEW.ID_USUARIO_SISTEMA IS DISTINCT FROM OLD.ID_USUARIO_SISTEMA
       OR NEW.ID_PERFIL IS DISTINCT FROM OLD.ID_PERFIL
       OR NEW.DT_INCLUSAO IS DISTINCT FROM OLD.DT_INCLUSAO THEN
        RAISE EXCEPTION 'Identidade da atribuição de perfil não pode ser alterada';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_preservar_usuario_perfil ON Cadastro.USUARIO_PERFIS;
CREATE TRIGGER trg_preservar_usuario_perfil BEFORE UPDATE OR DELETE ON Cadastro.USUARIO_PERFIS
FOR EACH ROW EXECUTE FUNCTION Cadastro.preservar_usuario_perfil();
