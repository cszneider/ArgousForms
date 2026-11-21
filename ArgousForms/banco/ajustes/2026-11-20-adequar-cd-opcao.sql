-- Ajuste da base existente: PROCESSO_VARIAVEL_VALORES.CD_OPCAO (chave da opção escolhida), decidido pelo Carlos no DDL de 19/11/2026.
-- VL_OPCAO permanece temporariamente, marcado como obsoleto; será removido em ajuste posterior.
-- Executar uma vez, como proprietário do schema Processos, antes de usar a aplicação que grava CD_OPCAO (T02).
-- Pode ser reexecutado.
BEGIN;

ALTER TABLE Processos.PROCESSO_VARIAVEL_VALORES ADD COLUMN IF NOT EXISTS CD_OPCAO Text NULL;

-- Valores antigos (de teste) passam a ser lidos pela coluna nova.
UPDATE Processos.PROCESSO_VARIAVEL_VALORES SET CD_OPCAO = VL_OPCAO
 WHERE CD_OPCAO IS NULL AND VL_OPCAO IS NOT NULL;

COMMENT ON COLUMN Processos.PROCESSO_VARIAVEL_VALORES.CD_OPCAO IS 'Chave da opção escolhida (campo do tipo O). Substitui VL_OPCAO.';
COMMENT ON COLUMN Processos.PROCESSO_VARIAVEL_VALORES.VL_OPCAO IS 'OBSOLETO: mantido temporariamente por compatibilidade; usar CD_OPCAO. Será removido.';

COMMIT;
