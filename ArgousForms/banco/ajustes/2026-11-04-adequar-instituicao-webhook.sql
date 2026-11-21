-- Aplicar manualmente à instalação de desenvolvimento existente.
-- O fuso informado pelo gestor para esta instalação é America/Sao_Paulo.
BEGIN;

ALTER TABLE Cadastro.INSTITUICAO ALTER COLUMN NR_TAMANHO_MAXIMO_ARQUIVO_BYTES TYPE BIGINT;
ALTER TABLE Cadastro.INSTITUICAO ADD COLUMN IF NOT EXISTS SN_PERMITIR_DESTINATARIOS_UNICOS BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE Cadastro.INSTITUICAO ADD COLUMN IF NOT EXISTS CD_FUSO_HORARIO VARCHAR(64);
ALTER TABLE Cadastro.INSTITUICAO ADD COLUMN IF NOT EXISTS DS_URL_WEBHOOK TEXT;
ALTER TABLE Cadastro.INSTITUICAO ADD COLUMN IF NOT EXISTS DS_URL_WEBHOOK_ALTERNATIVO TEXT;

UPDATE Cadastro.INSTITUICAO SET CD_FUSO_HORARIO = 'America/Sao_Paulo' WHERE CD_FUSO_HORARIO IS NULL;
ALTER TABLE Cadastro.INSTITUICAO ALTER COLUMN CD_FUSO_HORARIO SET NOT NULL;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'cadastro.instituicao'::regclass AND conname = 'ck_instituicao_dias_lixeira_positivo') THEN
        ALTER TABLE Cadastro.INSTITUICAO ADD CONSTRAINT ck_instituicao_dias_lixeira_positivo CHECK (NR_DIAS_PERMANENCIA_LIXEIRA > 0);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'cadastro.instituicao'::regclass AND conname = 'ck_instituicao_tamanho_maximo_positivo') THEN
        ALTER TABLE Cadastro.INSTITUICAO ADD CONSTRAINT ck_instituicao_tamanho_maximo_positivo CHECK (NR_TAMANHO_MAXIMO_ARQUIVO_BYTES > 0);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'cadastro.instituicao'::regclass AND conname = 'ck_instituicao_fuso_preenchido') THEN
        ALTER TABLE Cadastro.INSTITUICAO ADD CONSTRAINT ck_instituicao_fuso_preenchido CHECK (BTRIM(CD_FUSO_HORARIO) <> '');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'cadastro.instituicao'::regclass AND conname = 'ck_instituicao_webhook_preenchido') THEN
        ALTER TABLE Cadastro.INSTITUICAO ADD CONSTRAINT ck_instituicao_webhook_preenchido CHECK (DS_URL_WEBHOOK IS NULL OR BTRIM(DS_URL_WEBHOOK) <> '');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'cadastro.instituicao'::regclass AND conname = 'ck_instituicao_webhook_alternativo') THEN
        ALTER TABLE Cadastro.INSTITUICAO ADD CONSTRAINT ck_instituicao_webhook_alternativo CHECK (DS_URL_WEBHOOK_ALTERNATIVO IS NULL OR (DS_URL_WEBHOOK IS NOT NULL AND BTRIM(DS_URL_WEBHOOK_ALTERNATIVO) <> ''));
    END IF;
END $$;

COMMIT;
