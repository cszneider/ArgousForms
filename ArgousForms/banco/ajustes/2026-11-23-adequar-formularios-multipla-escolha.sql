-- Ajuste da base existente: scripts de formulário e de campo, rótulo e ajuda por formulário, e múltipla escolha (TP_DADO = 'C').
-- Modelagem do Carlos no CASE (23/11/2026), com origem nas decisões do antigo T02 (Tickets/_arquivo/T02-NOTAS-MODELAGEM-2026-11-20.md).
-- Regras: CD_OPCAO só em opção única (O); múltipla escolha grava uma linha por opção em PROCESSO_VARIAVEL_OPCOES;
-- seleção vazia = linha em PROCESSO_VARIAVEL_VALORES sem opções. Obrigatoriedade é validada pela aplicação.
-- Executar como proprietário do schema Processos. Pode ser reexecutado.
BEGIN;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM Processos.PROCESSO_VARIAVEL_VALORES v JOIN Processos.PROTOCOLO_VARIAVEIS p USING (ID_VARIAVEL)
                WHERE v.CD_OPCAO IS NOT NULL AND p.TP_DADO <> 'O') THEN
        RAISE EXCEPTION 'Há CD_OPCAO preenchido em campos que não são de opção única. Corrija antes de aplicar este ajuste.';
    END IF;
END;
$$;

ALTER TABLE Processos.FORMULARIOS ADD COLUMN IF NOT EXISTS TX_SCRIPT_AO_ABRIR Text NULL;
ALTER TABLE Processos.FORMULARIOS ADD COLUMN IF NOT EXISTS TX_SCRIPT_AO_FECHAR Text NULL;
ALTER TABLE Processos.FORMULARIO_VARIAVEIS ADD COLUMN IF NOT EXISTS TX_SCRIPT_ON_FOCUS Text NULL;
ALTER TABLE Processos.FORMULARIO_VARIAVEIS ADD COLUMN IF NOT EXISTS TX_SCRIPT_ON_CHANGE Text NULL;
ALTER TABLE Processos.FORMULARIO_VARIAVEIS ADD COLUMN IF NOT EXISTS TX_SCRIPT_ON_BLUR Text NULL;
ALTER TABLE Processos.FORMULARIO_VARIAVEIS ADD COLUMN IF NOT EXISTS DS_NOME_ALTERNATIVO Varchar(255) NULL;
ALTER TABLE Processos.FORMULARIO_VARIAVEIS ADD COLUMN IF NOT EXISTS DS_TEXTO_AJUDA Text NULL;
COMMENT ON COLUMN Processos.FORMULARIOS.TX_SCRIPT_AO_ABRIR IS 'Script executado a cada abertura do formulário (distinto do script de inicialização da etapa, que roda uma vez por passagem).';
COMMENT ON COLUMN Processos.FORMULARIOS.TX_SCRIPT_AO_FECHAR IS 'Script executado a cada fechamento do formulário.';
COMMENT ON COLUMN Processos.FORMULARIO_VARIAVEIS.TX_SCRIPT_ON_CHANGE IS 'Script do campo neste formulário ao mudar o valor; pode controlar visibilidade e obrigatoriedade de outros campos. O backend reproduz o estado efetivo antes de aceitar os dados.';
COMMENT ON COLUMN Processos.FORMULARIO_VARIAVEIS.DS_NOME_ALTERNATIVO IS 'Rótulo do campo neste formulário, quando diferente do nome da variável.';

ALTER TABLE Processos.PROTOCOLO_VARIAVEIS DROP CONSTRAINT IF EXISTS ck_protocolo_variavel_dado;
ALTER TABLE Processos.PROTOCOLO_VARIAVEIS ADD CONSTRAINT ck_protocolo_variavel_dado CHECK (TP_DADO IN ('S', 'I', 'R', 'M', 'V', 'B', 'O', 'C', 'D', 'H', 'T'));

CREATE TABLE IF NOT EXISTS Processos.PROCESSO_VARIAVEL_OPCOES
(
	ID_PROCESSO_ETAPA UUID NOT NULL,
	ID_VARIAVEL UUID NOT NULL,
	CD_OPCAO Text NOT NULL Check (BTRIM(CD_OPCAO) <> ''),
 primary key (ID_PROCESSO_ETAPA,ID_VARIAVEL,CD_OPCAO)
);
ALTER TABLE Processos.PROCESSO_VARIAVEL_OPCOES DROP CONSTRAINT IF EXISTS processo_variavel_opcoes_id_processo_etapa_id_variavel_fkey;
ALTER TABLE Processos.PROCESSO_VARIAVEL_OPCOES ADD CONSTRAINT processo_variavel_opcoes_id_processo_etapa_id_variavel_fkey FOREIGN KEY (ID_PROCESSO_ETAPA, ID_VARIAVEL)
  REFERENCES Processos.PROCESSO_VARIAVEL_VALORES (ID_PROCESSO_ETAPA, ID_VARIAVEL) ON UPDATE RESTRICT ON DELETE RESTRICT;
GRANT SELECT, INSERT, UPDATE, DELETE ON Processos.PROCESSO_VARIAVEL_OPCOES TO carlos;
COMMENT ON COLUMN Processos.PROCESSO_VARIAVEL_VALORES.CD_OPCAO IS 'Chave da opção escolhida, só em campo de opção única (TP_DADO = O). Nulo nos demais tipos, inclusive múltipla escolha (C), cujas opções ficam em PROCESSO_VARIAVEL_OPCOES.';

-- Opção única (O) usa PROCESSO_VARIAVEL_VALORES.CD_OPCAO; múltipla escolha (C) usa PROCESSO_VARIAVEL_OPCOES.
CREATE OR REPLACE FUNCTION Processos.validar_valor_opcao() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
    tipo char(1);
BEGIN
    IF NEW.CD_OPCAO IS NULL THEN RETURN NEW; END IF;
    SELECT TP_DADO INTO tipo FROM Processos.PROTOCOLO_VARIAVEIS WHERE ID_VARIAVEL = NEW.ID_VARIAVEL;
    IF tipo IS DISTINCT FROM 'O' THEN
        RAISE EXCEPTION 'CD_OPCAO só é usado em campo de opção única (tipo O); múltipla escolha grava em PROCESSO_VARIAVEL_OPCOES.';
    END IF;
    RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_validar_valor_opcao ON Processos.PROCESSO_VARIAVEL_VALORES;
CREATE TRIGGER trg_validar_valor_opcao BEFORE INSERT OR UPDATE OF CD_OPCAO, ID_VARIAVEL ON Processos.PROCESSO_VARIAVEL_VALORES
FOR EACH ROW EXECUTE FUNCTION Processos.validar_valor_opcao();

CREATE OR REPLACE FUNCTION Processos.validar_opcao_multipla() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM Processos.PROTOCOLO_VARIAVEIS WHERE ID_VARIAVEL = NEW.ID_VARIAVEL AND TP_DADO = 'C') THEN
        RAISE EXCEPTION 'PROCESSO_VARIAVEL_OPCOES só aceita campos de múltipla escolha (tipo C).';
    END IF;
    RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_validar_opcao_multipla ON Processos.PROCESSO_VARIAVEL_OPCOES;
CREATE TRIGGER trg_validar_opcao_multipla BEFORE INSERT OR UPDATE ON Processos.PROCESSO_VARIAVEL_OPCOES
FOR EACH ROW EXECUTE FUNCTION Processos.validar_opcao_multipla();

COMMIT;
