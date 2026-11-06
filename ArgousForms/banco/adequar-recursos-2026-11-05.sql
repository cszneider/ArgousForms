-- Adequa a instalação existente sem recriar tabelas nem apagar arquivos.
-- Executar como proprietário dos schemas, após Cadastro, Docs e Processos.
BEGIN;

ALTER TABLE Cadastro.INSTITUICAO ADD COLUMN IF NOT EXISTS ID_PASTA UUID NULL;

CREATE TABLE IF NOT EXISTS Cadastro.RECURSOS_INSTITUICAO (
    ID_INSTITUICAO Smallint NOT NULL DEFAULT 1,
    ID_ARQUIVO_VERSAO UUID NOT NULL,
    CD_RECURSO Varchar(40) NOT NULL,
    PRIMARY KEY (ID_INSTITUICAO, ID_ARQUIVO_VERSAO)
);
CREATE UNIQUE INDEX IF NOT EXISTS CodigoDoRecurso ON Cadastro.RECURSOS_INSTITUICAO (CD_RECURSO);

CREATE TABLE IF NOT EXISTS Processos.PROTOCOLO_RECURSOS (
    ID_DOCUMENTO_HTML_RECURSO UUID NOT NULL,
    ID_PROTOCOLO UUID NOT NULL,
    ID_ARQUIVO_VERSAO UUID NOT NULL,
    CD_RECURSO Varchar(40) NOT NULL,
    PRIMARY KEY (ID_DOCUMENTO_HTML_RECURSO)
);
CREATE UNIQUE INDEX IF NOT EXISTS CodigoRecursoProtocolo ON Processos.PROTOCOLO_RECURSOS (ID_PROTOCOLO, CD_RECURSO);

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'cadastro.instituicao'::regclass AND conname = 'fk_instituicao_pasta_recursos') THEN
        ALTER TABLE Cadastro.INSTITUICAO ADD CONSTRAINT fk_instituicao_pasta_recursos FOREIGN KEY (ID_PASTA) REFERENCES Docs.PASTAS (ID_PASTA) ON UPDATE RESTRICT ON DELETE RESTRICT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'cadastro.recursos_instituicao'::regclass AND conname = 'fk_recurso_instituicao') THEN
        ALTER TABLE Cadastro.RECURSOS_INSTITUICAO ADD CONSTRAINT fk_recurso_instituicao FOREIGN KEY (ID_INSTITUICAO) REFERENCES Cadastro.INSTITUICAO (ID_INSTITUICAO) ON UPDATE RESTRICT ON DELETE RESTRICT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'cadastro.recursos_instituicao'::regclass AND conname = 'fk_recurso_instituicao_arquivo') THEN
        ALTER TABLE Cadastro.RECURSOS_INSTITUICAO ADD CONSTRAINT fk_recurso_instituicao_arquivo FOREIGN KEY (ID_ARQUIVO_VERSAO) REFERENCES Docs.ARQUIVO_VERSOES (ID_ARQUIVO_VERSAO) ON UPDATE RESTRICT ON DELETE RESTRICT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'processos.protocolo_recursos'::regclass AND conname = 'fk_recurso_protocolo') THEN
        ALTER TABLE Processos.PROTOCOLO_RECURSOS ADD CONSTRAINT fk_recurso_protocolo FOREIGN KEY (ID_PROTOCOLO) REFERENCES Processos.PROTOCOLOS (ID_PROTOCOLO) ON UPDATE RESTRICT ON DELETE RESTRICT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'processos.protocolo_recursos'::regclass AND conname = 'fk_recurso_protocolo_arquivo') THEN
        ALTER TABLE Processos.PROTOCOLO_RECURSOS ADD CONSTRAINT fk_recurso_protocolo_arquivo FOREIGN KEY (ID_ARQUIVO_VERSAO) REFERENCES Docs.ARQUIVO_VERSOES (ID_ARQUIVO_VERSAO) ON UPDATE RESTRICT ON DELETE RESTRICT;
    END IF;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON Cadastro.RECURSOS_INSTITUICAO TO carlos;
GRANT SELECT, INSERT, UPDATE, DELETE ON Processos.PROTOCOLO_RECURSOS TO carlos;

COMMIT;
