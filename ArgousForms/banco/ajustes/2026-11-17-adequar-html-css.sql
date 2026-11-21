-- Aplicar uma vez à base existente, antes de implantar a aplicação que usa os CSSs separados.
-- Preserva o CSS antigo em um arquivo chamado estilos.css, associado à mesma versão do modelo.
BEGIN;

CREATE TABLE IF NOT EXISTS Processos.PROTOCOLO_DOCUMENTO_HTML_CSS
(
    ID_DOCUMENTO_CSS UUID NOT NULL,
    ID_PROTOCOLO_DOCUMENTO_VERSAO UUID NOT NULL,
    DS_NOME_ARQUIVO Varchar(200) NOT NULL CHECK (BTRIM(DS_NOME_ARQUIVO) <> ''),
    NR_ORDEM Smallint NOT NULL CHECK (NR_ORDEM > 0),
    DS_CONTEUDO Text NULL,
    PRIMARY KEY (ID_DOCUMENTO_CSS)
);

CREATE UNIQUE INDEX IF NOT EXISTS NomeVersao ON Processos.PROTOCOLO_DOCUMENTO_HTML_CSS (ID_PROTOCOLO_DOCUMENTO_VERSAO, DS_NOME_ARQUIVO);
CREATE UNIQUE INDEX IF NOT EXISTS OrdemVersao ON Processos.PROTOCOLO_DOCUMENTO_HTML_CSS (ID_PROTOCOLO_DOCUMENTO_VERSAO, NR_ORDEM);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'processos.protocolo_documento_html_css'::regclass AND conname = 'fk_html_css_documento') THEN
        ALTER TABLE Processos.PROTOCOLO_DOCUMENTO_HTML_CSS ADD CONSTRAINT fk_html_css_documento FOREIGN KEY (ID_PROTOCOLO_DOCUMENTO_VERSAO) REFERENCES Processos.PROTOCOLO_DOCUMENTO_HTML (ID_PROTOCOLO_DOCUMENTO_VERSAO) ON UPDATE RESTRICT ON DELETE RESTRICT;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'processos' AND table_name = 'protocolo_documento_html' AND column_name = 'tx_css') THEN
        IF EXISTS (
            SELECT 1 FROM Processos.PROTOCOLO_DOCUMENTO_HTML h
            JOIN Processos.PROTOCOLO_DOCUMENTO_HTML_CSS c USING (ID_PROTOCOLO_DOCUMENTO_VERSAO)
            WHERE h.TX_CSS IS NOT NULL AND BTRIM(h.TX_CSS) <> ''
        ) THEN
            RAISE EXCEPTION 'Há versões com CSS na coluna antiga e na tabela nova. Resolva o conflito antes da migração.';
        END IF;

        INSERT INTO Processos.PROTOCOLO_DOCUMENTO_HTML_CSS (ID_DOCUMENTO_CSS, ID_PROTOCOLO_DOCUMENTO_VERSAO, DS_NOME_ARQUIVO, NR_ORDEM, DS_CONTEUDO)
        SELECT gen_random_uuid(), ID_PROTOCOLO_DOCUMENTO_VERSAO, 'estilos.css', 1, TX_CSS
        FROM Processos.PROTOCOLO_DOCUMENTO_HTML
        WHERE TX_CSS IS NOT NULL AND BTRIM(TX_CSS) <> '';

        ALTER TABLE Processos.PROTOCOLO_DOCUMENTO_HTML DROP COLUMN TX_CSS;
    END IF;

    IF EXISTS (
        SELECT 1 FROM Processos.PROTOCOLO_DOCUMENTO_HTML_PARTES
        WHERE TP_PARTE IN ('A', 'H', 'F', 'X')
        GROUP BY ID_PROTOCOLO_DOCUMENTO_VERSAO, TP_PARTE HAVING COUNT(*) > 1
    ) THEN
        RAISE EXCEPTION 'Há mais de uma apresentação, cabeçalho, rodapé ou encerramento na mesma versão. Corrija os dados antes da migração.';
    END IF;
END;
$$;

DROP INDEX IF EXISTS Processos.uk_html_partes_cabecalho_rodape;
CREATE UNIQUE INDEX IF NOT EXISTS uk_html_partes_ordem ON Processos.PROTOCOLO_DOCUMENTO_HTML_PARTES (ID_PROTOCOLO_DOCUMENTO_VERSAO, TP_PARTE, NR_ORDEM);
CREATE UNIQUE INDEX IF NOT EXISTS uk_html_partes_unicas ON Processos.PROTOCOLO_DOCUMENTO_HTML_PARTES (ID_PROTOCOLO_DOCUMENTO_VERSAO, TP_PARTE) WHERE TP_PARTE IN ('A', 'H', 'F', 'X');

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = 'processos.protocolo_documento_html_css'::regclass AND tgname = 'trg_documento_html_css_publicado') THEN
        EXECUTE 'CREATE TRIGGER trg_documento_html_css_publicado BEFORE INSERT OR UPDATE OR DELETE ON Processos.PROTOCOLO_DOCUMENTO_HTML_CSS FOR EACH ROW EXECUTE FUNCTION Processos.bloquear_definicao_publicada(''documento'')';
    END IF;
END;
$$;

COMMENT ON TABLE Processos.PROTOCOLO_DOCUMENTO_HTML IS 'Define a versão HTML de um modelo de documento do Protocolo. O conteúdo fica em PROTOCOLO_DOCUMENTO_HTML_PARTES e os arquivos de estilo em PROTOCOLO_DOCUMENTO_HTML_CSS. Uma versão HTML deve ter um registro nesta tabela e nenhum na tabela específica de PDF.';

GRANT SELECT, INSERT, UPDATE, DELETE ON Processos.PROTOCOLO_DOCUMENTO_HTML_CSS TO carlos;

COMMIT;
