-- Executar manualmente com o proprietário do esquema Cadastro.
BEGIN;

CREATE OR REPLACE FUNCTION Cadastro.validar_alteracao_tag()
RETURNS trigger
LANGUAGE plpgsql
AS $$
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
$$;

DROP TRIGGER IF EXISTS TRG_VALIDAR_ALTERACAO_TAG ON Cadastro.TAGS;
CREATE TRIGGER TRG_VALIDAR_ALTERACAO_TAG
BEFORE UPDATE ON Cadastro.TAGS
FOR EACH ROW EXECUTE FUNCTION Cadastro.validar_alteracao_tag();

CREATE OR REPLACE FUNCTION Cadastro.validar_vinculo_grupo_tag()
RETURNS trigger
LANGUAGE plpgsql
AS $$
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
$$;

DROP TRIGGER IF EXISTS TRG_VALIDAR_VINCULO_GRUPO_TAG ON Cadastro.GRUPO_TAGS;
CREATE TRIGGER TRG_VALIDAR_VINCULO_GRUPO_TAG
BEFORE INSERT OR UPDATE ON Cadastro.GRUPO_TAGS
FOR EACH ROW EXECUTE FUNCTION Cadastro.validar_vinculo_grupo_tag();

COMMIT;
