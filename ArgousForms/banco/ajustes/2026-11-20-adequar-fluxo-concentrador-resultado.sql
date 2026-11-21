-- Ajuste da base existente às decisões de fluxo e resultado de 20/11/2026 (modelo-de-dados.md, 4.1 e M-01).
-- Executar uma vez, como proprietário do schema Processos, JUNTO com a versão da aplicação que grava
-- PROCESSOS.TP_SITUACAO = 'E' no início e TP_RESULTADO no encerramento (ticket T02). Antes dela, a aplicação
-- atual falharia ao iniciar ('I' deixa de existir) e ao finalizar (resultado passa a ser obrigatório).
-- Pode ser reexecutado: colunas, restrições e funções são criadas ou substituídas sem duplicar.
-- Dados: todas as etapas atuais viram TP_BLOCO = 'E'; etapas finais sem resultado padrão recebem 'P';
-- processos 'I' passam a 'E'; processos finalizados sem resultado recebem 'P'.
BEGIN;

-- Pré-condições: dados que não teriam correção automática.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM Processos.ENCAMINHAMENTOS WHERE TP_ENCAMINHAMENTO = 'E' AND TX_TESTE IS NOT NULL) THEN
        RAISE EXCEPTION 'Há encaminhamentos diretos (E) com TX_TESTE preenchido. Corrija antes de aplicar este ajuste.';
    END IF;
    IF EXISTS (SELECT 1 FROM Processos.ENCAMINHAMENTOS WHERE TP_ENCAMINHAMENTO = 'T' AND BTRIM(COALESCE(TX_TESTE, '')) = '') THEN
        RAISE EXCEPTION 'Há encaminhamentos de teste (T) sem TX_TESTE. Corrija antes de aplicar este ajuste.';
    END IF;
    IF EXISTS (SELECT 1 FROM Processos.PROCESSOS WHERE TP_SITUACAO NOT IN ('I', 'E', 'A', 'F', 'C')) THEN
        RAISE EXCEPTION 'Há processos com TP_SITUACAO fora de I, E, A, F, C. Corrija antes de aplicar este ajuste.';
    END IF;
END;
$$;

-- PROTOCOLOS_ETAPAS: etapa (E) ou concentrador (J); resultado padrão nas etapas finais.
ALTER TABLE Processos.PROTOCOLOS_ETAPAS ADD COLUMN IF NOT EXISTS TP_BLOCO Char(1) NOT NULL DEFAULT 'E';
-- O DEFAULT 'E' é mantido: a aplicação atual insere etapas sem informar TP_BLOCO.
ALTER TABLE Processos.PROTOCOLOS_ETAPAS ALTER COLUMN TP_BLOCO SET DEFAULT 'E';
ALTER TABLE Processos.PROTOCOLOS_ETAPAS ALTER COLUMN ID_FORMULARIO DROP NOT NULL;
ALTER TABLE Processos.PROTOCOLOS_ETAPAS ADD COLUMN IF NOT EXISTS TP_RESULTADO_PADRAO Char(1) NULL;

-- Versões publicadas são imutáveis; a trigger é suspensa só nesta transação para preencher o resultado padrão.
ALTER TABLE Processos.PROTOCOLOS_ETAPAS DISABLE TRIGGER trg_etapas_publicadas;
UPDATE Processos.PROTOCOLOS_ETAPAS SET TP_RESULTADO_PADRAO = 'P'
 WHERE TP_BLOCO = 'E' AND ID_ENCAMINHAMENTO IS NULL AND TP_RESULTADO_PADRAO IS NULL;
ALTER TABLE Processos.PROTOCOLOS_ETAPAS ENABLE TRIGGER trg_etapas_publicadas;

ALTER TABLE Processos.PROTOCOLOS_ETAPAS DROP CONSTRAINT IF EXISTS protocolos_etapas_tp_bloco_check;
ALTER TABLE Processos.PROTOCOLOS_ETAPAS ADD CONSTRAINT protocolos_etapas_tp_bloco_check CHECK (TP_BLOCO IN ('E', 'J'));
ALTER TABLE Processos.PROTOCOLOS_ETAPAS DROP CONSTRAINT IF EXISTS protocolos_etapas_tp_resultado_padrao_check;
ALTER TABLE Processos.PROTOCOLOS_ETAPAS ADD CONSTRAINT protocolos_etapas_tp_resultado_padrao_check CHECK (TP_RESULTADO_PADRAO IS NULL OR TP_RESULTADO_PADRAO IN ('P', 'N'));
ALTER TABLE Processos.PROTOCOLOS_ETAPAS DROP CONSTRAINT IF EXISTS ck_etapa_formulario;
ALTER TABLE Processos.PROTOCOLOS_ETAPAS ADD CONSTRAINT ck_etapa_formulario CHECK ((TP_BLOCO = 'E') = (ID_FORMULARIO IS NOT NULL));
ALTER TABLE Processos.PROTOCOLOS_ETAPAS DROP CONSTRAINT IF EXISTS ck_concentrador;
ALTER TABLE Processos.PROTOCOLOS_ETAPAS ADD CONSTRAINT ck_concentrador CHECK (TP_BLOCO = 'E' OR (JS_GERACAO_DOCUMENTOS IS NULL AND TP_RESULTADO_PADRAO IS NULL));

-- PROCESSOS: situação E/A/F/C e resultado P/N/C.
ALTER TABLE Processos.PROCESSOS ADD COLUMN IF NOT EXISTS TP_RESULTADO Char(1) NULL;
ALTER TABLE Processos.PROCESSOS ADD COLUMN IF NOT EXISTS DS_RESULTADO Text NULL;
UPDATE Processos.PROCESSOS SET TP_SITUACAO = 'E' WHERE TP_SITUACAO = 'I';
UPDATE Processos.PROCESSOS SET TP_RESULTADO = 'P' WHERE TP_SITUACAO = 'F' AND TP_RESULTADO IS NULL;

ALTER TABLE Processos.PROCESSOS DROP CONSTRAINT IF EXISTS processos_tp_situacao_check;
ALTER TABLE Processos.PROCESSOS ADD CONSTRAINT processos_tp_situacao_check CHECK (TP_SITUACAO IN ('E', 'A', 'F', 'C'));
ALTER TABLE Processos.PROCESSOS DROP CONSTRAINT IF EXISTS ck_processo_resultado;
ALTER TABLE Processos.PROCESSOS ADD CONSTRAINT ck_processo_resultado CHECK (
     (TP_SITUACAO = 'E' AND TP_RESULTADO IS NULL)
  OR (TP_SITUACAO = 'A' AND (TP_RESULTADO IS NULL OR TP_RESULTADO IN ('P', 'N')))
  OR (TP_SITUACAO = 'F' AND COALESCE(TP_RESULTADO, '-') IN ('P', 'N'))
  OR (TP_SITUACAO = 'C' AND COALESCE(TP_RESULTADO, '-') = 'C'));
ALTER TABLE Processos.PROCESSOS DROP CONSTRAINT IF EXISTS ck_processo_motivo;
ALTER TABLE Processos.PROCESSOS ADD CONSTRAINT ck_processo_motivo CHECK (
  TP_SITUACAO NOT IN ('F', 'C') OR TP_RESULTADO = 'P' OR BTRIM(COALESCE(DS_RESULTADO, '')) <> '');
ALTER TABLE Processos.PROCESSOS DROP CONSTRAINT IF EXISTS ck_processo_encerramento;
ALTER TABLE Processos.PROCESSOS ADD CONSTRAINT ck_processo_encerramento CHECK ((TP_SITUACAO IN ('F', 'C')) = (DT_ENCERRAMENTO IS NOT NULL));

-- ENCAMINHAMENTOS: novo tipo C (condicional) e coerência do teste.
ALTER TABLE Processos.ENCAMINHAMENTOS DROP CONSTRAINT IF EXISTS ck_encaminhamento_tipo;
ALTER TABLE Processos.ENCAMINHAMENTOS ADD CONSTRAINT ck_encaminhamento_tipo CHECK (TP_ENCAMINHAMENTO IN ('E', 'T', 'C'));
ALTER TABLE Processos.ENCAMINHAMENTOS DROP CONSTRAINT IF EXISTS ck_encaminhamento_teste;
ALTER TABLE Processos.ENCAMINHAMENTOS ADD CONSTRAINT ck_encaminhamento_teste CHECK ((TP_ENCAMINHAMENTO = 'E' AND TX_TESTE IS NULL)
  OR (TP_ENCAMINHAMENTO IN ('T', 'C') AND BTRIM(COALESCE(TX_TESTE, '')) <> ''));

COMMENT ON COLUMN Processos.PROTOCOLOS_ETAPAS.TP_BLOCO IS 'E: etapa (formulário e ação humana); J: concentrador (junção de ramos paralelos, sem formulário nem destinatários).';
COMMENT ON COLUMN Processos.PROTOCOLOS_ETAPAS.TP_RESULTADO_PADRAO IS 'Resultado do Processo quando termina nesta etapa final: P positivo, N negativo. Obrigatório em toda etapa final na publicação.';
COMMENT ON COLUMN Processos.PROCESSOS.TP_SITUACAO IS 'E: em execução; A: aguardando finalização pelo gestor; F: finalizado; C: cancelado.';
COMMENT ON COLUMN Processos.PROCESSOS.TP_RESULTADO IS 'P positivo; N negativo; C cancelado. Nulo em execução; em A pode vir pré-preenchido pelo resultado padrão da etapa final.';
COMMENT ON COLUMN Processos.ENCAMINHAMENTOS.TP_ENCAMINHAMENTO IS 'E direto (dispara e continua a cadeia); T teste (verdadeiro dispara e para; falso continua); C condicional (verdadeiro dispara e continua; falso continua sem disparar).';

-- Funções substituídas (as triggers existentes continuam apontando para elas).
CREATE OR REPLACE FUNCTION Processos.validar_etapa_formulario() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    -- O concentrador (TP_BLOCO = 'J') não tem formulário; ck_etapa_formulario garante formulário nas etapas.
    IF NEW.ID_FORMULARIO IS NOT NULL AND NOT EXISTS
       (SELECT 1 FROM Processos.FORMULARIOS WHERE ID_FORMULARIO = NEW.ID_FORMULARIO
        AND ID_PROTOCOLO_VERSAO = NEW.ID_PROTOCOLO_VERSAO) THEN
        RAISE EXCEPTION 'Formulário e etapa devem pertencer à mesma versão do Protocolo.';
    END IF;
    IF NEW.ID_ENCAMINHAMENTO IS NOT NULL AND NOT EXISTS
       (SELECT 1 FROM Processos.ENCAMINHAMENTOS WHERE ID_ENCAMINHAMENTO = NEW.ID_ENCAMINHAMENTO
        AND ID_PROTOCOLO_VERSAO = NEW.ID_PROTOCOLO_VERSAO) THEN
        RAISE EXCEPTION 'Encaminhamento de saída pertence a outra versão do Protocolo.';
    END IF;
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION Processos.validar_versao_protocolo() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
    iniciais integer;
    finais integer;
    no_fluxo record;
    atual uuid;
    tipos text[];
    passos integer;
BEGIN
    IF TG_OP = 'DELETE' THEN
        IF OLD.NR_VERSAO > 0 THEN RAISE EXCEPTION 'Versão publicada do Protocolo não pode ser excluída.'; END IF;
        RETURN OLD;
    END IF;

    IF TG_OP = 'UPDATE' AND OLD.NR_VERSAO > 0 THEN
        RAISE EXCEPTION 'Versão publicada do Protocolo é imutável.';
    END IF;
    IF NEW.NR_VERSAO <> -1 AND NEW.NR_VERSAO <= 0 THEN
        RAISE EXCEPTION 'NR_VERSAO deve ser -1 no rascunho ou positivo na publicação.';
    END IF;
    IF NEW.NR_VERSAO = -1 AND (NEW.ID_USUARIO_PUBLICOU IS NOT NULL OR NEW.DT_PUBLICACAO IS NOT NULL) THEN
        RAISE EXCEPTION 'Rascunho não pode conter dados de publicação.';
    END IF;
    IF NEW.NR_VERSAO > 0 THEN
        IF NEW.ID_USUARIO_PUBLICOU IS NULL OR NEW.DT_PUBLICACAO IS NULL THEN
            RAISE EXCEPTION 'Versão publicada requer publicador e data de publicação.';
        END IF;
        IF TG_OP = 'INSERT' THEN RAISE EXCEPTION 'Crie o rascunho antes de publicar o Protocolo.'; END IF;

        -- Início: exatamente um nó sem entrada, e ele deve ser uma etapa. Fim: etapas sem encaminhamento.
        SELECT count(*) FILTER (WHERE NOT EXISTS (
                   SELECT 1 FROM Processos.ENCAMINHAMENTOS caminho
                    WHERE caminho.ID_PROTOCOLO_VERSAO = etapa.ID_PROTOCOLO_VERSAO
                      AND caminho.ID_PROXIMA_ETAPA = etapa.ID_PROTOCOLO_ETAPA)),
               count(*) FILTER (WHERE etapa.TP_BLOCO = 'E' AND etapa.ID_ENCAMINHAMENTO IS NULL)
          INTO iniciais, finais FROM Processos.PROTOCOLOS_ETAPAS etapa
         WHERE etapa.ID_PROTOCOLO_VERSAO = NEW.ID_PROTOCOLO_VERSAO;
        IF iniciais <> 1 OR finais < 1 THEN
            RAISE EXCEPTION 'Publicação requer uma etapa após o início e pelo menos uma etapa que leve ao fim.';
        END IF;

        -- M-01: regras do concentrador.
        IF EXISTS (SELECT 1 FROM Processos.PROTOCOLOS_ETAPAS j
                    WHERE j.ID_PROTOCOLO_VERSAO = NEW.ID_PROTOCOLO_VERSAO AND j.TP_BLOCO = 'J'
                      AND (j.ID_ENCAMINHAMENTO IS NULL
                           OR NOT EXISTS (SELECT 1 FROM Processos.ENCAMINHAMENTOS c
                                           WHERE c.ID_PROTOCOLO_VERSAO = j.ID_PROTOCOLO_VERSAO
                                             AND c.ID_PROXIMA_ETAPA = j.ID_PROTOCOLO_ETAPA))) THEN
            RAISE EXCEPTION 'Concentrador precisa receber ramos e ter um encaminhamento de saída; não pode iniciar nem encerrar o fluxo.';
        END IF;
        IF EXISTS (SELECT 1 FROM Processos.PROTOCOLOS_ETAPAS j
                     JOIN Processos.PROTOCOLO_ETAPA_DESTINATARIOS d ON d.ID_PROTOCOLO_ETAPA = j.ID_PROTOCOLO_ETAPA
                    WHERE j.ID_PROTOCOLO_VERSAO = NEW.ID_PROTOCOLO_VERSAO AND j.TP_BLOCO = 'J') THEN
            RAISE EXCEPTION 'Concentrador não tem destinatários.';
        END IF;

        -- M-01: resultado padrão obrigatório nas etapas finais e proibido nas demais.
        IF EXISTS (SELECT 1 FROM Processos.PROTOCOLOS_ETAPAS e
                    WHERE e.ID_PROTOCOLO_VERSAO = NEW.ID_PROTOCOLO_VERSAO AND e.TP_BLOCO = 'E'
                      AND (e.ID_ENCAMINHAMENTO IS NULL) <> (e.TP_RESULTADO_PADRAO IS NOT NULL)) THEN
            RAISE EXCEPTION 'Toda etapa final precisa de resultado padrão (P ou N), e só etapas finais o possuem.';
        END IF;

        -- 4.1: tipos de cadeia permitidos (direta, paralela, paralela condicional, decisão com "caso contrário").
        FOR no_fluxo IN SELECT ID_PROTOCOLO_ETAPA, DS_TITULO, ID_ENCAMINHAMENTO FROM Processos.PROTOCOLOS_ETAPAS
                         WHERE ID_PROTOCOLO_VERSAO = NEW.ID_PROTOCOLO_VERSAO AND ID_ENCAMINHAMENTO IS NOT NULL LOOP
            tipos := ARRAY[]::text[];
            atual := no_fluxo.ID_ENCAMINHAMENTO;
            passos := 0;
            WHILE atual IS NOT NULL LOOP
                passos := passos + 1;
                IF passos > 500 THEN
                    RAISE EXCEPTION 'Cadeia de encaminhamentos de "%" contém ciclo.', no_fluxo.DS_TITULO;
                END IF;
                SELECT tipos || TP_ENCAMINHAMENTO::text, ID_PROXIMO_ENCAMINHAMENTO INTO tipos, atual
                  FROM Processos.ENCAMINHAMENTOS WHERE ID_ENCAMINHAMENTO = atual;
            END LOOP;
            IF 'T' = ANY (tipos) THEN
                IF array_length(tipos, 1) < 2 OR tipos[array_length(tipos, 1)] <> 'E'
                   OR EXISTS (SELECT 1 FROM unnest(tipos[1:array_length(tipos, 1) - 1]) t WHERE t <> 'T') THEN
                    RAISE EXCEPTION 'Decisão em "%" deve ter só testes e terminar em um encaminhamento direto ("caso contrário").', no_fluxo.DS_TITULO;
                END IF;
            ELSIF 'C' = ANY (tipos) AND NOT 'E' = ANY (tipos) THEN
                RAISE EXCEPTION 'Paralelo condicional em "%" precisa de ao menos um ramo direto, que sempre dispara.', no_fluxo.DS_TITULO;
            END IF;
        END LOOP;

        IF EXISTS (SELECT 1 FROM Processos.PROTOCOLOS_ETAPAS e
                    WHERE e.ID_PROTOCOLO_VERSAO = NEW.ID_PROTOCOLO_VERSAO AND e.TP_BLOCO = 'E'
                      AND NOT EXISTS (SELECT 1 FROM Processos.PROTOCOLO_ETAPA_DESTINATARIOS d
                                      WHERE d.ID_PROTOCOLO_ETAPA = e.ID_PROTOCOLO_ETAPA)) THEN
            RAISE EXCEPTION 'Cada etapa precisa ter pelo menos uma regra de destinatários.';
        END IF;
        IF EXISTS (SELECT 1 FROM Cadastro.INSTITUICAO WHERE ID_INSTITUICAO = 1 AND NOT SN_PERMITIR_DESTINATARIOS_UNICOS)
           AND EXISTS (
               SELECT 1 FROM Processos.PROTOCOLOS_ETAPAS e
                WHERE e.ID_PROTOCOLO_VERSAO = NEW.ID_PROTOCOLO_VERSAO AND e.TP_BLOCO = 'E'
                  AND NOT EXISTS (SELECT 1 FROM Processos.PROTOCOLO_ETAPA_DESTINATARIOS d
                                   WHERE d.ID_PROTOCOLO_ETAPA = e.ID_PROTOCOLO_ETAPA
                                     AND (d.ID_GRUPO IS NOT NULL OR d.CD_TAG_GRUPO IS NOT NULL
                                          OR d.CD_TAG_USUARIO IS NOT NULL OR d.CD_TAG_VINCULO IS NOT NULL))
           ) THEN
            RAISE EXCEPTION 'Política institucional exige destinatário não nominal em cada etapa.';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

COMMIT;
