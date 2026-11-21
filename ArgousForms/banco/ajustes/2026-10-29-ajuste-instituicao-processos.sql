-- Atualiza a estrutura da instituição sem remover o registro existente.
-- Executar como proprietário do schema Cadastro, uma única vez.
BEGIN;

ALTER TABLE Cadastro.INSTITUICAO ALTER COLUMN NR_TAMANHO_MAXIMO_ARQUIVO_BYTES TYPE BIGINT;
ALTER TABLE Cadastro.INSTITUICAO ADD COLUMN SN_PERMITIR_DESTINATARIOS_UNICOS BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE Cadastro.INSTITUICAO ADD CONSTRAINT ck_instituicao_dias_lixeira_positivo CHECK (NR_DIAS_PERMANENCIA_LIXEIRA > 0);

COMMIT;
