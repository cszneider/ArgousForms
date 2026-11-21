-- Aplicar uma vez na instalação existente. Novas instalações usam validar-processos.sql.
BEGIN;
CREATE OR REPLACE FUNCTION Processos.exigir_gestor_elegivel_publicacao() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.NR_VERSAO > 0 AND NOT EXISTS (SELECT 1 FROM Processos.PROTOCOLO_GESTORES_ELEGIVEIS WHERE ID_PROTOCOLO_VERSAO = NEW.ID_PROTOCOLO_VERSAO) THEN
        RAISE EXCEPTION 'Defina ao menos uma regra de gestor elegível antes de publicar o Protocolo.';
    END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER trg_exigir_gestor_elegivel_publicacao BEFORE INSERT OR UPDATE OF NR_VERSAO ON Processos.PROTOCOLO_VERSOES FOR EACH ROW EXECUTE FUNCTION Processos.exigir_gestor_elegivel_publicacao();
COMMIT;
