-- Executar depois de estrutura-inicial.sql.
-- Garante que o país gravado na identificação seja o país do tipo escolhido.
BEGIN;

CREATE OR REPLACE FUNCTION Cadastro.validar_pais_pessoa_identificacao()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    v_id_pais integer;
BEGIN
    SELECT ID_PAIS INTO v_id_pais
      FROM Cadastro.TIPOS_IDENTIFICACAO
     WHERE ID_TIPO_IDENTIFICACAO = NEW.ID_TIPO_IDENTIFICACAO
     FOR SHARE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Tipo de identificação inexistente: %', NEW.ID_TIPO_IDENTIFICACAO
            USING ERRCODE = '23503';
    END IF;

    IF NEW.ID_PAIS <> v_id_pais THEN
        RAISE EXCEPTION 'O país da identificação deve corresponder ao país do tipo selecionado.'
            USING ERRCODE = '23514';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validar_pais_pessoa_identificacao ON Cadastro.PESSOA_IDENTIFICACOES;
CREATE TRIGGER trg_validar_pais_pessoa_identificacao
BEFORE INSERT OR UPDATE OF ID_TIPO_IDENTIFICACAO, ID_PAIS
ON Cadastro.PESSOA_IDENTIFICACOES
FOR EACH ROW EXECUTE FUNCTION Cadastro.validar_pais_pessoa_identificacao();

CREATE OR REPLACE FUNCTION Cadastro.impedir_alteracao_pais_tipo_em_uso()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.ID_PAIS IS DISTINCT FROM OLD.ID_PAIS
       AND EXISTS (
           SELECT 1 FROM Cadastro.PESSOA_IDENTIFICACOES
            WHERE ID_TIPO_IDENTIFICACAO = OLD.ID_TIPO_IDENTIFICACAO
       ) THEN
        RAISE EXCEPTION 'Não é possível alterar o país de um tipo de identificação já utilizado.'
            USING ERRCODE = '23514';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_impedir_alteracao_pais_tipo_em_uso ON Cadastro.TIPOS_IDENTIFICACAO;
CREATE TRIGGER trg_impedir_alteracao_pais_tipo_em_uso
BEFORE UPDATE OF ID_PAIS
ON Cadastro.TIPOS_IDENTIFICACAO
FOR EACH ROW EXECUTE FUNCTION Cadastro.impedir_alteracao_pais_tipo_em_uso();

COMMIT;
