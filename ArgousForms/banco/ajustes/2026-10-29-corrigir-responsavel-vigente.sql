-- Corrige a função já instalada: PostgreSQL não implementa max(uuid).
-- Executar como proprietário da função/schema Processos. Os triggers existentes permanecem.
BEGIN;

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

COMMIT;
