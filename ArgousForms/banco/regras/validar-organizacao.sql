-- M-06 · Organização: hierarquia de grupos e lotação (modelo-de-dados.md, versão 1.5.3).
-- Executar com o proprietário do esquema Cadastro, depois de validar-vinculos-organizacao.sql.
-- As verificações são adiadas para o COMMIT (constraint triggers DEFERRABLE INITIALLY DEFERRED):
-- a aplicação pode criar o grupo, aplicar a tag departamento e definir o superior em qualquer ordem,
-- desde que na mesma transação.
BEGIN;

CREATE OR REPLACE FUNCTION Cadastro.grupo_e_departamento(p_grupo Integer) RETURNS Boolean
LANGUAGE sql STABLE AS $$
    SELECT EXISTS (SELECT 1 FROM Cadastro.GRUPO_TAGS
                    WHERE ID_GRUPO = p_grupo AND CD_TAG = 'departamento' AND SN_ATIVA);
$$;

CREATE OR REPLACE FUNCTION Cadastro.validar_organizacao_grupo(p_grupo Integer) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
    g Cadastro.GRUPOS%ROWTYPE;
    sup Cadastro.GRUPOS%ROWTYPE;
    atual Integer;
    passos Integer := 0;
    departamento Boolean;
BEGIN
    SELECT * INTO g FROM Cadastro.GRUPOS WHERE ID_GRUPO = p_grupo;
    IF NOT FOUND THEN RETURN; END IF;
    departamento := Cadastro.grupo_e_departamento(p_grupo);

    IF g.ID_GRUPO_SUPERIOR IS NOT NULL THEN
        IF NOT departamento THEN
            RAISE EXCEPTION 'O grupo "%" tem superior, mas não é departamento: só departamentos fazem parte da hierarquia.', g.DS_NOME_GRUPO;
        END IF;
        SELECT * INTO sup FROM Cadastro.GRUPOS WHERE ID_GRUPO = g.ID_GRUPO_SUPERIOR;
        IF NOT Cadastro.grupo_e_departamento(sup.ID_GRUPO) THEN
            RAISE EXCEPTION 'O superior do grupo "%" ("%") precisa ser departamento.', g.DS_NOME_GRUPO, sup.DS_NOME_GRUPO;
        END IF;
        IF g.SN_ATIVO AND NOT sup.SN_ATIVO THEN
            RAISE EXCEPTION 'O superior do grupo "%" ("%") está inativo.', g.DS_NOME_GRUPO, sup.DS_NOME_GRUPO;
        END IF;
        atual := g.ID_GRUPO_SUPERIOR;
        WHILE atual IS NOT NULL LOOP
            IF atual = p_grupo THEN
                RAISE EXCEPTION 'A hierarquia do grupo "%" forma um ciclo.', g.DS_NOME_GRUPO;
            END IF;
            passos := passos + 1;
            IF passos > 1000 THEN
                RAISE EXCEPTION 'A hierarquia do grupo "%" passa de 1000 níveis.', g.DS_NOME_GRUPO;
            END IF;
            SELECT ID_GRUPO_SUPERIOR INTO atual FROM Cadastro.GRUPOS WHERE ID_GRUPO = atual;
        END LOOP;
    END IF;

    IF NOT g.SN_ATIVO AND EXISTS (SELECT 1 FROM Cadastro.GRUPOS
                                   WHERE ID_GRUPO_SUPERIOR = p_grupo AND SN_ATIVO) THEN
        RAISE EXCEPTION 'O grupo "%" tem subordinados ativos: mova-os ou desligue-os da hierarquia antes de desativá-lo.', g.DS_NOME_GRUPO;
    END IF;

    IF NOT departamento THEN
        IF EXISTS (SELECT 1 FROM Cadastro.GRUPOS WHERE ID_GRUPO_SUPERIOR = p_grupo) THEN
            RAISE EXCEPTION 'O grupo "%" tem subordinados: ele precisa continuar como departamento.', g.DS_NOME_GRUPO;
        END IF;
        IF EXISTS (SELECT 1 FROM Cadastro.VINCULO_TAGS
                    WHERE ID_GRUPO = p_grupo AND CD_TAG = 'lotacao' AND SN_ATIVO) THEN
            RAISE EXCEPTION 'O grupo "%" tem pessoas lotadas: lotação só existe em departamento.', g.DS_NOME_GRUPO;
        END IF;
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION Cadastro.validar_organizacao_por_grupo() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    PERFORM Cadastro.validar_organizacao_grupo(NEW.ID_GRUPO);
    RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION Cadastro.validar_organizacao_por_tag_grupo() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP <> 'INSERT' AND OLD.CD_TAG = 'departamento' THEN
        PERFORM Cadastro.validar_organizacao_grupo(OLD.ID_GRUPO);
    END IF;
    IF TG_OP <> 'DELETE' AND NEW.CD_TAG = 'departamento' THEN
        PERFORM Cadastro.validar_organizacao_grupo(NEW.ID_GRUPO);
    END IF;
    RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION Cadastro.validar_organizacao_por_lotacao() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.CD_TAG = 'lotacao' AND NEW.SN_ATIVO THEN
        PERFORM Cadastro.validar_organizacao_grupo(NEW.ID_GRUPO);
    END IF;
    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_validar_organizacao_grupo ON Cadastro.GRUPOS;
CREATE CONSTRAINT TRIGGER trg_validar_organizacao_grupo
AFTER INSERT OR UPDATE OF ID_GRUPO_SUPERIOR, SN_ATIVO ON Cadastro.GRUPOS
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION Cadastro.validar_organizacao_por_grupo();

DROP TRIGGER IF EXISTS trg_validar_organizacao_tag_grupo ON Cadastro.GRUPO_TAGS;
CREATE CONSTRAINT TRIGGER trg_validar_organizacao_tag_grupo
AFTER INSERT OR UPDATE OR DELETE ON Cadastro.GRUPO_TAGS
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION Cadastro.validar_organizacao_por_tag_grupo();

DROP TRIGGER IF EXISTS trg_validar_organizacao_lotacao ON Cadastro.VINCULO_TAGS;
CREATE CONSTRAINT TRIGGER trg_validar_organizacao_lotacao
AFTER INSERT OR UPDATE ON Cadastro.VINCULO_TAGS
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION Cadastro.validar_organizacao_por_lotacao();

COMMIT;
