-- Adequa a base existente aos campos de finalização e vencimento dos modelos.
-- Executar uma vez. Versões existentes preservam a finalização pelo gestor.
BEGIN;

-- O DEFAULT preenche as linhas existentes ao adicionar a coluna, sem executar UPDATE
-- e sem acionar a trigger que protege as versões publicadas.
ALTER TABLE Processos.PROTOCOLO_VERSOES ADD COLUMN SN_GESTOR_FINALIZA Boolean NOT NULL DEFAULT TRUE;
-- Nas inclusões futuras, o programa deve informar a opção escolhida.
ALTER TABLE Processos.PROTOCOLO_VERSOES ALTER COLUMN SN_GESTOR_FINALIZA DROP DEFAULT;

ALTER TABLE Processos.PROTOCOLO_DOCUMENTO_VERSOES ADD COLUMN NR_DIAS_VENCIMENTO Smallint NULL;
ALTER TABLE Processos.PROTOCOLO_DOCUMENTO_VERSOES ADD CONSTRAINT ck_protocolo_documento_versoes_dias_vencimento CHECK (NR_DIAS_VENCIMENTO IS NULL OR NR_DIAS_VENCIMENTO > 0);

COMMIT;
