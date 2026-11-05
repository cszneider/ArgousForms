-- Aplicar manualmente à base existente antes de publicar o primeiro Protocolo.
BEGIN;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'processos.protocolo_versoes'::regclass AND conname = 'ck_protocolo_versao_publicacao') THEN
        ALTER TABLE Processos.PROTOCOLO_VERSOES ADD CONSTRAINT ck_protocolo_versao_publicacao CHECK ((NR_VERSAO = -1 AND TP_SITUACAO = 'R' AND ID_USUARIO_PUBLICOU IS NULL AND DT_PUBLICACAO IS NULL) OR (NR_VERSAO > 0 AND TP_SITUACAO = 'P' AND ID_USUARIO_PUBLICOU IS NOT NULL AND DT_PUBLICACAO IS NOT NULL));
    END IF;
END $$;

COMMIT;
