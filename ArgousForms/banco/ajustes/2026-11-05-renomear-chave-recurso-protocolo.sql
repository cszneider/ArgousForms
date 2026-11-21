-- Aplicar à base que já recebeu adequar-recursos-2026-11-05.sql.
-- Preserva os registros e seus UUIDs.
BEGIN;

DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = 'processos.protocolo_recursos'::regclass AND attname = 'id_documento_html_recurso' AND NOT attisdropped) THEN
        ALTER TABLE Processos.PROTOCOLO_RECURSOS RENAME COLUMN ID_DOCUMENTO_HTML_RECURSO TO ID_PROTOCOLO_RECURSO;
    END IF;
    IF to_regclass('processos.codigorecursoprotocolo') IS NOT NULL AND to_regclass('processos.codigodorecursonoprotocolo') IS NULL THEN
        ALTER INDEX Processos.CodigoRecursoProtocolo RENAME TO CodigoDoRecursoNoProtocolo;
    END IF;
END $$;

COMMIT;
