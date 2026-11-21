-- Ajuste da base existente: número do processo (M-03) e prazos de etapa e de parecer (M-01 b, M-13), decididos em 20/11/2026.
-- Executar uma vez, como proprietário do schema Processos, antes de usar a aplicação que mostra número e prazo.
-- Pode ser reexecutado.
-- Dados: protocolos sem prefixo recebem um provisório (P001, P002… por data de inclusão), a ser trocado pelo modelador;
-- processos existentes são numerados pela ordem de início, por protocolo e ano; prazos ficam vazios.
BEGIN;

-- PROTOCOLOS: prefixo e tipo de sequência.
ALTER TABLE Processos.PROTOCOLOS ADD COLUMN IF NOT EXISTS CD_PREFIXO Varchar(6) NULL;
ALTER TABLE Processos.PROTOCOLOS ADD COLUMN IF NOT EXISTS TP_SEQUENCIA Char(1) NOT NULL DEFAULT 'A';
ALTER TABLE Processos.PROTOCOLOS DROP CONSTRAINT IF EXISTS protocolos_cd_prefixo_check;
ALTER TABLE Processos.PROTOCOLOS ADD CONSTRAINT protocolos_cd_prefixo_check CHECK (CD_PREFIXO IS NULL OR CD_PREFIXO ~ '^[A-Z0-9]{2,6}$');
ALTER TABLE Processos.PROTOCOLOS DROP CONSTRAINT IF EXISTS protocolos_tp_sequencia_check;
ALTER TABLE Processos.PROTOCOLOS ADD CONSTRAINT protocolos_tp_sequencia_check CHECK (TP_SEQUENCIA IN ('A', 'C'));
WITH sem_prefixo AS (
    SELECT ID_PROTOCOLO, row_number() OVER (ORDER BY DT_INCLUSAO, ID_PROTOCOLO) AS ordem
      FROM Processos.PROTOCOLOS WHERE CD_PREFIXO IS NULL
), base AS (
    SELECT COALESCE(max(substr(CD_PREFIXO, 2)::integer), 0) AS ultimo
      FROM Processos.PROTOCOLOS WHERE CD_PREFIXO ~ '^P[0-9]{3,5}$'
)
UPDATE Processos.PROTOCOLOS p SET CD_PREFIXO = 'P' || lpad((base.ultimo + s.ordem)::text, 3, '0')
  FROM sem_prefixo s, base WHERE p.ID_PROTOCOLO = s.ID_PROTOCOLO;
CREATE UNIQUE INDEX IF NOT EXISTS ProtocoloPrefixo ON Processos.PROTOCOLOS (CD_PREFIXO);
COMMENT ON COLUMN Processos.PROTOCOLOS.CD_PREFIXO IS 'Prefixo do número dos processos (ex.: AUT). Obrigatório para publicar; único entre todos os protocolos, ativos ou não.';
COMMENT ON COLUMN Processos.PROTOCOLOS.TP_SEQUENCIA IS 'A: anual (AUT-2026-000131); C: contínua (AUT-000131).';

-- PROTOCOLO_SEQUENCIAS
CREATE TABLE IF NOT EXISTS Processos.PROTOCOLO_SEQUENCIAS
(
	ID_PROTOCOLO UUID   NOT NULL,
	NR_ANO Smallint NOT NULL Check (NR_ANO >= 0),
	NR_ULTIMO Integer NOT NULL Check (NR_ULTIMO > 0),
 primary key (ID_PROTOCOLO,NR_ANO)
);
ALTER TABLE Processos.PROTOCOLO_SEQUENCIAS DROP CONSTRAINT IF EXISTS protocolo_sequencias_id_protocolo_fkey;
ALTER TABLE Processos.PROTOCOLO_SEQUENCIAS ADD CONSTRAINT protocolo_sequencias_id_protocolo_fkey FOREIGN KEY (ID_PROTOCOLO)
  REFERENCES Processos.PROTOCOLOS (ID_PROTOCOLO) ON UPDATE RESTRICT ON DELETE RESTRICT;
GRANT SELECT, INSERT, UPDATE, DELETE ON Processos.PROTOCOLO_SEQUENCIAS TO carlos;

-- PROCESSOS: numeração dos processos existentes, continuando a sequência já emitida.
ALTER TABLE Processos.PROCESSOS ADD COLUMN IF NOT EXISTS CD_NUMERO Varchar(30) NULL;
WITH fuso AS (SELECT COALESCE((SELECT CD_FUSO_HORARIO FROM Cadastro.INSTITUICAO WHERE ID_INSTITUICAO = 1), 'UTC') AS nome),
pendentes AS (
    SELECT pr.ID_PROCESSO, p.ID_PROTOCOLO, p.CD_PREFIXO,
           CASE WHEN p.TP_SEQUENCIA = 'A' THEN extract(year FROM pr.DT_INICIO AT TIME ZONE fuso.nome)::smallint ELSE 0 END AS ano,
           pr.DT_INICIO
      FROM Processos.PROCESSOS pr
      JOIN Processos.PROTOCOLO_VERSOES v ON v.ID_PROTOCOLO_VERSAO = pr.ID_PROTOCOLO_VERSAO
      JOIN Processos.PROTOCOLOS p ON p.ID_PROTOCOLO = v.ID_PROTOCOLO
      CROSS JOIN fuso
     WHERE pr.CD_NUMERO IS NULL
), numerados AS (
    SELECT d.*, COALESCE(s.NR_ULTIMO, 0) + row_number() OVER (PARTITION BY d.ID_PROTOCOLO, d.ano ORDER BY d.DT_INICIO, d.ID_PROCESSO) AS numero
      FROM pendentes d LEFT JOIN Processos.PROTOCOLO_SEQUENCIAS s ON s.ID_PROTOCOLO = d.ID_PROTOCOLO AND s.NR_ANO = d.ano
), gravados AS (
    UPDATE Processos.PROCESSOS pr
       SET CD_NUMERO = n.CD_PREFIXO || '-' || CASE WHEN n.ano > 0 THEN n.ano::text || '-' ELSE '' END || lpad(n.numero::text, 6, '0')
      FROM numerados n WHERE pr.ID_PROCESSO = n.ID_PROCESSO
    RETURNING n.ID_PROTOCOLO, n.ano, n.numero
)
INSERT INTO Processos.PROTOCOLO_SEQUENCIAS AS s (ID_PROTOCOLO, NR_ANO, NR_ULTIMO)
SELECT ID_PROTOCOLO, ano, max(numero) FROM gravados GROUP BY ID_PROTOCOLO, ano
ON CONFLICT (ID_PROTOCOLO, NR_ANO) DO UPDATE SET NR_ULTIMO = GREATEST(s.NR_ULTIMO, EXCLUDED.NR_ULTIMO);
ALTER TABLE Processos.PROCESSOS ALTER COLUMN CD_NUMERO SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS NumeroDeProcesso ON Processos.PROCESSOS (CD_NUMERO);
COMMENT ON COLUMN Processos.PROCESSOS.CD_NUMERO IS 'Número do processo, gerado pelo banco no INSERT (Processos.numerar_processo); imutável e nunca reutilizado.';

-- Prazos
ALTER TABLE Processos.PROTOCOLOS_ETAPAS ADD COLUMN IF NOT EXISTS NR_PRAZO Smallint NULL;
ALTER TABLE Processos.PROTOCOLOS_ETAPAS ADD COLUMN IF NOT EXISTS TP_UNIDADE_PRAZO Char(1) NULL;
ALTER TABLE Processos.PROTOCOLOS_ETAPAS DROP CONSTRAINT IF EXISTS protocolos_etapas_nr_prazo_check;
ALTER TABLE Processos.PROTOCOLOS_ETAPAS ADD CONSTRAINT protocolos_etapas_nr_prazo_check CHECK (NR_PRAZO IS NULL OR NR_PRAZO > 0);
ALTER TABLE Processos.PROTOCOLOS_ETAPAS DROP CONSTRAINT IF EXISTS protocolos_etapas_tp_unidade_prazo_check;
ALTER TABLE Processos.PROTOCOLOS_ETAPAS ADD CONSTRAINT protocolos_etapas_tp_unidade_prazo_check CHECK (TP_UNIDADE_PRAZO IS NULL OR TP_UNIDADE_PRAZO IN ('U', 'C', 'H'));
ALTER TABLE Processos.PROTOCOLOS_ETAPAS DROP CONSTRAINT IF EXISTS ck_etapa_prazo;
ALTER TABLE Processos.PROTOCOLOS_ETAPAS ADD CONSTRAINT ck_etapa_prazo CHECK ((NR_PRAZO IS NULL) = (TP_UNIDADE_PRAZO IS NULL) AND (TP_BLOCO = 'E' OR NR_PRAZO IS NULL));
COMMENT ON COLUMN Processos.PROTOCOLOS_ETAPAS.TP_UNIDADE_PRAZO IS 'U: dias úteis (segunda a sexta, ainda sem feriados), vence no fim do dia; C: dias corridos, vence no fim do dia; H: horas exatas. Fuso: Cadastro.INSTITUICAO.CD_FUSO_HORARIO.';

ALTER TABLE Processos.PROCESSO_ETAPAS ADD COLUMN IF NOT EXISTS DT_LIMITE Timestamp with time zone NULL;
ALTER TABLE Processos.PROCESSO_ETAPAS DROP CONSTRAINT IF EXISTS processo_etapas_dt_limite_check;
ALTER TABLE Processos.PROCESSO_ETAPAS ADD CONSTRAINT processo_etapas_dt_limite_check CHECK (DT_LIMITE IS NULL OR DT_LIMITE > DT_DISPONIBILIZACAO);
COMMENT ON COLUMN Processos.PROCESSO_ETAPAS.DT_LIMITE IS 'Prazo desta passagem, calculado pelo banco ao inserir (Processos.definir_limite_etapa) a partir do prazo da etapa do Protocolo.';

ALTER TABLE Processos.PROCESSO_CONSULTAS ADD COLUMN IF NOT EXISTS DT_LIMITE Timestamp with time zone NULL;
ALTER TABLE Processos.PROCESSO_CONSULTAS DROP CONSTRAINT IF EXISTS processo_consultas_dt_limite_check;
ALTER TABLE Processos.PROCESSO_CONSULTAS ADD CONSTRAINT processo_consultas_dt_limite_check CHECK (DT_LIMITE IS NULL OR DT_LIMITE > DT_SOLICITACAO);
COMMENT ON COLUMN Processos.PROCESSO_CONSULTAS.DT_LIMITE IS 'Prazo do parecer, opcional, informado por quem pede (a tela sugere 2 dias).';

-- Funções e triggers
-- M-03: número do processo. Gerado no INSERT, com incremento atômico por protocolo e ano; imutável.
CREATE OR REPLACE FUNCTION Processos.numerar_processo() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
    protocolo uuid;
    prefixo text;
    sequencia char(1);
    fuso text;
    ano smallint;
    numero integer;
BEGIN
    IF TG_OP = 'UPDATE' THEN
        IF NEW.CD_NUMERO IS DISTINCT FROM OLD.CD_NUMERO THEN
            RAISE EXCEPTION 'O número do processo é imutável.';
        END IF;
        RETURN NEW;
    END IF;
    IF NEW.CD_NUMERO IS NOT NULL THEN RETURN NEW; END IF;

    SELECT p.ID_PROTOCOLO, p.CD_PREFIXO, p.TP_SEQUENCIA INTO protocolo, prefixo, sequencia
      FROM Processos.PROTOCOLO_VERSOES v JOIN Processos.PROTOCOLOS p USING (ID_PROTOCOLO)
     WHERE v.ID_PROTOCOLO_VERSAO = NEW.ID_PROTOCOLO_VERSAO;
    IF prefixo IS NULL THEN
        RAISE EXCEPTION 'O Protocolo precisa de prefixo para numerar processos.';
    END IF;
    SELECT CD_FUSO_HORARIO INTO fuso FROM Cadastro.INSTITUICAO WHERE ID_INSTITUICAO = 1;
    ano := CASE WHEN sequencia = 'A'
                THEN extract(year FROM COALESCE(NEW.DT_INICIO, now()) AT TIME ZONE COALESCE(fuso, 'UTC'))::smallint
                ELSE 0 END;

    INSERT INTO Processos.PROTOCOLO_SEQUENCIAS AS s (ID_PROTOCOLO, NR_ANO, NR_ULTIMO)
    VALUES (protocolo, ano, 1)
    ON CONFLICT (ID_PROTOCOLO, NR_ANO) DO UPDATE SET NR_ULTIMO = s.NR_ULTIMO + 1
    RETURNING NR_ULTIMO INTO numero;

    NEW.CD_NUMERO := prefixo || '-' || CASE WHEN ano > 0 THEN ano::text || '-' ELSE '' END || lpad(numero::text, 6, '0');
    RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_numerar_processo ON Processos.PROCESSOS;
CREATE TRIGGER trg_numerar_processo BEFORE INSERT OR UPDATE OF CD_NUMERO ON Processos.PROCESSOS
FOR EACH ROW EXECUTE FUNCTION Processos.numerar_processo();

-- M-01 (b): data limite a partir do prazo. U dias úteis (seg-sex, sem feriados) e C corridos vencem no fim do dia; H horas exatas.
CREATE OR REPLACE FUNCTION Processos.calcular_limite(inicio timestamptz, prazo integer, unidade char) RETURNS timestamptz
LANGUAGE plpgsql STABLE AS $$
DECLARE
    fuso text;
    dia date;
    contados integer := 0;
BEGIN
    IF prazo IS NULL OR unidade IS NULL THEN RETURN NULL; END IF;
    IF unidade = 'H' THEN RETURN inicio + make_interval(hours => prazo); END IF;
    SELECT COALESCE(CD_FUSO_HORARIO, 'UTC') INTO fuso FROM Cadastro.INSTITUICAO WHERE ID_INSTITUICAO = 1;
    fuso := COALESCE(fuso, 'UTC');
    dia := (inicio AT TIME ZONE fuso)::date;
    IF unidade = 'C' THEN
        dia := dia + prazo;
    ELSE
        WHILE contados < prazo LOOP
            dia := dia + 1;
            IF extract(isodow FROM dia) < 6 THEN contados := contados + 1; END IF;
        END LOOP;
    END IF;
    RETURN ((dia + 1)::timestamp - interval '1 second') AT TIME ZONE fuso;
END;
$$;

CREATE OR REPLACE FUNCTION Processos.definir_limite_etapa() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.DT_LIMITE IS NULL THEN
        SELECT Processos.calcular_limite(NEW.DT_DISPONIBILIZACAO, NR_PRAZO, TP_UNIDADE_PRAZO) INTO NEW.DT_LIMITE
          FROM Processos.PROTOCOLOS_ETAPAS WHERE ID_PROTOCOLO_ETAPA = NEW.ID_PROTOCOLO_ETAPA;
    END IF;
    RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_definir_limite_etapa ON Processos.PROCESSO_ETAPAS;
CREATE TRIGGER trg_definir_limite_etapa BEFORE INSERT ON Processos.PROCESSO_ETAPAS
FOR EACH ROW EXECUTE FUNCTION Processos.definir_limite_etapa();


-- Publicação passa a exigir prefixo.
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
        IF EXISTS (SELECT 1 FROM Processos.PROTOCOLOS WHERE ID_PROTOCOLO = NEW.ID_PROTOCOLO AND CD_PREFIXO IS NULL) THEN
            RAISE EXCEPTION 'Defina o prefixo do número dos processos antes de publicar o Protocolo.';
        END IF;

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
