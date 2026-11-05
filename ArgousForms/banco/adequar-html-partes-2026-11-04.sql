-- Aplicar na base existente depois da criação de PROTOCOLO_DOCUMENTO_HTML_PARTES
-- e da função Processos.bloquear_definicao_publicada(). A FK já foi executada pelo gestor.
BEGIN;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'processos.protocolo_documento_html'::regclass AND contype = 'f' AND confrelid = 'processos.protocolo_documento_versoes'::regclass) THEN
        ALTER TABLE Processos.PROTOCOLO_DOCUMENTO_HTML ADD CONSTRAINT fk_html_documento_versao FOREIGN KEY (ID_PROTOCOLO_DOCUMENTO_VERSAO) REFERENCES Processos.PROTOCOLO_DOCUMENTO_VERSOES (ID_PROTOCOLO_DOCUMENTO_VERSAO) ON UPDATE RESTRICT ON DELETE RESTRICT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'processos.protocolo_documento_html_partes'::regclass AND conname = 'ck_html_parte_tipo') THEN
        ALTER TABLE Processos.PROTOCOLO_DOCUMENTO_HTML_PARTES ADD CONSTRAINT ck_html_parte_tipo CHECK (TP_PARTE IN ('H', 'A', 'B', 'X', 'F'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'processos.protocolo_documento_html_partes'::regclass AND conname = 'ck_html_parte_ordem') THEN
        ALTER TABLE Processos.PROTOCOLO_DOCUMENTO_HTML_PARTES ADD CONSTRAINT ck_html_parte_ordem CHECK (NR_ORDEM > 0);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'processos.protocolo_documento_html_partes'::regclass AND conname = 'ck_html_parte_conteudo') THEN
        ALTER TABLE Processos.PROTOCOLO_DOCUMENTO_HTML_PARTES ADD CONSTRAINT ck_html_parte_conteudo CHECK (BTRIM(TX_HTML) <> '');
    END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS uk_html_partes_ordem ON Processos.PROTOCOLO_DOCUMENTO_HTML_PARTES (ID_PROTOCOLO_DOCUMENTO_VERSAO, TP_PARTE, NR_ORDEM);
CREATE UNIQUE INDEX IF NOT EXISTS uk_html_partes_cabecalho_rodape ON Processos.PROTOCOLO_DOCUMENTO_HTML_PARTES (ID_PROTOCOLO_DOCUMENTO_VERSAO, TP_PARTE) WHERE TP_PARTE IN ('H', 'F');

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = 'processos.protocolo_documento_html_partes'::regclass AND tgname = 'trg_documento_html_parte_publicada') THEN
        EXECUTE 'CREATE TRIGGER trg_documento_html_parte_publicada BEFORE INSERT OR UPDATE OR DELETE ON Processos.PROTOCOLO_DOCUMENTO_HTML_PARTES FOR EACH ROW EXECUTE FUNCTION Processos.bloquear_definicao_publicada(''documento'')';
    END IF;
END;
$$;

GRANT SELECT, INSERT, UPDATE, DELETE ON Processos.PROTOCOLO_DOCUMENTO_HTML TO carlos;
GRANT SELECT, INSERT, UPDATE, DELETE ON Processos.PROTOCOLO_DOCUMENTO_HTML_PARTES TO carlos;

COMMIT;
