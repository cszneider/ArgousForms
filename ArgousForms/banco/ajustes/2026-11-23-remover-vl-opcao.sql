-- Remove a coluna obsoleta PROCESSO_VARIAVEL_VALORES.VL_OPCAO (substituída por CD_OPCAO em 20/11/2026).
-- Decisão do Carlos em 23/11/2026; a aplicação não referencia mais VL_OPCAO.
-- Os valores antigos já foram copiados para CD_OPCAO por 2026-11-20-adequar-cd-opcao.sql; a cópia é repetida aqui por segurança.
-- Executar como proprietário do schema Processos. Pode ser reexecutado.
BEGIN;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'processos' AND table_name = 'processo_variavel_valores' AND column_name = 'vl_opcao') THEN
        EXECUTE 'UPDATE Processos.PROCESSO_VARIAVEL_VALORES SET CD_OPCAO = VL_OPCAO WHERE CD_OPCAO IS NULL AND VL_OPCAO IS NOT NULL';
    END IF;
END;
$$;

ALTER TABLE Processos.PROCESSO_VARIAVEL_VALORES DROP COLUMN IF EXISTS VL_OPCAO;
COMMENT ON COLUMN Processos.PROCESSO_VARIAVEL_VALORES.CD_OPCAO IS 'Chave da opção escolhida (campo do tipo O).';

COMMIT;
