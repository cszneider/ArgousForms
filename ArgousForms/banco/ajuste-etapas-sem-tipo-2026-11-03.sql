-- Aplicar no banco existente após remover PROTOCOLOS_ETAPAS.TP_ETAPA.
-- Substitui funções usadas pelas triggers já instaladas. Não recria as triggers.
BEGIN;

CREATE OR REPLACE FUNCTION Processos.validar_etapa_formulario() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM Processos.FORMULARIOS WHERE ID_FORMULARIO = NEW.ID_FORMULARIO
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
BEGIN
    IF TG_OP = 'DELETE' THEN
        IF OLD.NR_VERSAO > 0 THEN RAISE EXCEPTION 'Versão publicada do Protocolo não pode ser excluída.'; END IF;
        RETURN OLD;
    END IF;
    IF TG_OP = 'UPDATE' AND OLD.NR_VERSAO > 0 THEN RAISE EXCEPTION 'Versão publicada do Protocolo é imutável.'; END IF;
    IF NEW.NR_VERSAO <> -1 AND NEW.NR_VERSAO <= 0 THEN RAISE EXCEPTION 'NR_VERSAO deve ser -1 no rascunho ou positivo na publicação.'; END IF;
    IF NEW.NR_VERSAO = -1 AND (NEW.ID_USUARIO_PUBLICOU IS NOT NULL OR NEW.DT_PUBLICACAO IS NOT NULL) THEN
        RAISE EXCEPTION 'Rascunho não pode conter dados de publicação.';
    END IF;
    IF NEW.NR_VERSAO > 0 THEN
        IF NEW.ID_USUARIO_PUBLICOU IS NULL OR NEW.DT_PUBLICACAO IS NULL THEN
            RAISE EXCEPTION 'Versão publicada requer publicador e data de publicação.';
        END IF;
        IF TG_OP = 'INSERT' THEN RAISE EXCEPTION 'Crie o rascunho antes de publicar o Protocolo.'; END IF;

        SELECT count(*) FILTER (WHERE NOT EXISTS (
                   SELECT 1 FROM Processos.ENCAMINHAMENTOS caminho
                    WHERE caminho.ID_PROTOCOLO_VERSAO = etapa.ID_PROTOCOLO_VERSAO
                      AND caminho.ID_PROXIMA_ETAPA = etapa.ID_PROTOCOLO_ETAPA)),
               count(*) FILTER (WHERE etapa.ID_ENCAMINHAMENTO IS NULL)
          INTO iniciais, finais FROM Processos.PROTOCOLOS_ETAPAS etapa
         WHERE etapa.ID_PROTOCOLO_VERSAO = NEW.ID_PROTOCOLO_VERSAO;
        IF iniciais <> 1 OR finais < 1 THEN
            RAISE EXCEPTION 'Publicação requer uma etapa após o início e pelo menos uma etapa que leve ao fim.';
        END IF;
        IF EXISTS (SELECT 1 FROM Processos.PROTOCOLOS_ETAPAS e
                    WHERE e.ID_PROTOCOLO_VERSAO = NEW.ID_PROTOCOLO_VERSAO
                      AND NOT EXISTS (SELECT 1 FROM Processos.PROTOCOLO_ETAPA_DESTINATARIOS d
                                      WHERE d.ID_PROTOCOLO_ETAPA = e.ID_PROTOCOLO_ETAPA)) THEN
            RAISE EXCEPTION 'Cada etapa precisa ter pelo menos uma regra de destinatários.';
        END IF;
        IF EXISTS (SELECT 1 FROM Cadastro.INSTITUICAO WHERE ID_INSTITUICAO = 1 AND NOT SN_PERMITIR_DESTINATARIOS_UNICOS)
           AND EXISTS (
               SELECT 1 FROM Processos.PROTOCOLOS_ETAPAS e
                WHERE e.ID_PROTOCOLO_VERSAO = NEW.ID_PROTOCOLO_VERSAO
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
