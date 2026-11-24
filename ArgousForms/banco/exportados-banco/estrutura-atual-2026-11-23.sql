--
-- PostgreSQL database dump
--

\restrict LdmareDwz739WugGv6X4d12du4xyl11AE6pftN00KfNytv9afs7PeGEqHLOzGQp

-- Dumped from database version 18.6 (Ubuntu 18.6-0ubuntu0.26.04.1)
-- Dumped by pg_dump version 18.6 (Ubuntu 18.6-0ubuntu0.26.04.1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: cadastro; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA cadastro;


--
-- Name: docs; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA docs;


--
-- Name: notificacoes; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA notificacoes;


--
-- Name: processos; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA processos;


--
-- Name: impedir_alteracao_pais_tipo_em_uso(); Type: FUNCTION; Schema: cadastro; Owner: -
--

CREATE FUNCTION cadastro.impedir_alteracao_pais_tipo_em_uso() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF NEW.ID_PAIS IS DISTINCT FROM OLD.ID_PAIS
       AND EXISTS (
           SELECT 1 FROM Cadastro.PESSOA_IDENTIFICACOES
            WHERE ID_TIPO_IDENTIFICACAO = OLD.ID_TIPO_IDENTIFICACAO
       ) THEN
        RAISE EXCEPTION 'Não é possível alterar o país de um tipo de identificação já utilizado.'
            USING ERRCODE = '23514';
    END IF;

    RETURN NEW;
END;
$$;


--
-- Name: limpar_historico_integracao(); Type: FUNCTION; Schema: cadastro; Owner: -
--

CREATE FUNCTION cadastro.limpar_historico_integracao() RETURNS integer
    LANGUAGE plpgsql
    AS $$
declare
    eliminadas integer;
begin
    delete from Cadastro.INTEGRACAO_TENTATIVAS t using Cadastro.INTEGRACAO_CONSULTAS c, Cadastro.INSTITUICAO i
     where t.ID_REQUISICAO = c.ID_REQUISICAO
       and c.DT_FIM < CURRENT_TIMESTAMP - make_interval(days => i.NR_DIAS_RETENCAO_LOG_INTEGRACAO);
    delete from Cadastro.INTEGRACAO_CONSULTAS c using Cadastro.INSTITUICAO i
     where c.DT_FIM < CURRENT_TIMESTAMP - make_interval(days => i.NR_DIAS_RETENCAO_LOG_INTEGRACAO);
    get diagnostics eliminadas = ROW_COUNT;
    return eliminadas;
end;
$$;


--
-- Name: preservar_usuario_perfil(); Type: FUNCTION; Schema: cadastro; Owner: -
--

CREATE FUNCTION cadastro.preservar_usuario_perfil() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'Atribuição de perfil deve ser revogada, não excluída';
    END IF;
    IF NEW.ID_USUARIO_PERFIL IS DISTINCT FROM OLD.ID_USUARIO_PERFIL
       OR NEW.ID_USUARIO_SISTEMA IS DISTINCT FROM OLD.ID_USUARIO_SISTEMA
       OR NEW.ID_PERFIL IS DISTINCT FROM OLD.ID_PERFIL
       OR NEW.DT_INCLUSAO IS DISTINCT FROM OLD.DT_INCLUSAO THEN
        RAISE EXCEPTION 'Identidade da atribuição de perfil não pode ser alterada';
    END IF;
    RETURN NEW;
END;
$$;


--
-- Name: validar_ciclo_chave_webhook(); Type: FUNCTION; Schema: cadastro; Owner: -
--

CREATE FUNCTION cadastro.validar_ciclo_chave_webhook() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
    if TG_OP = 'DELETE' then
        raise exception 'Chaves de webhook devem ser invalidadas, não excluídas.';
    end if;

    if TG_OP = 'UPDATE' then
        if NEW.ID_WEBHOOK IS DISTINCT FROM OLD.ID_WEBHOOK
            or NEW.VL_CHAVE_CIFRADA IS DISTINCT FROM OLD.VL_CHAVE_CIFRADA
            or NEW.VL_NONCE IS DISTINCT FROM OLD.VL_NONCE
            or NEW.ID_USUARIO_INCLUSAO IS DISTINCT FROM OLD.ID_USUARIO_INCLUSAO
            or NEW.DT_INCLUSAO IS DISTINCT FROM OLD.DT_INCLUSAO
            or NEW.DT_ATIVACAO IS DISTINCT FROM OLD.DT_ATIVACAO and OLD.DT_ATIVACAO IS NOT NULL
            or NEW.DT_INVALIDACAO IS DISTINCT FROM OLD.DT_INVALIDACAO and OLD.DT_INVALIDACAO IS NOT NULL then
            raise exception 'Identidade, segredo e eventos já registrados da chave são imutáveis.';
        end if;
        if OLD.DT_INVALIDACAO IS NOT NULL and NEW.ID_USUARIO_INVALIDACAO IS DISTINCT FROM OLD.ID_USUARIO_INVALIDACAO then
            raise exception 'A invalidação da chave é definitiva.';
        end if;
    end if;

    if NEW.DT_INVALIDACAO IS NOT NULL and NEW.DT_ATIVACAO IS NOT NULL and NEW.DT_INVALIDACAO < NEW.DT_ATIVACAO then
        raise exception 'A invalidação não pode anteceder a ativação.';
    end if;
    return NEW;
end;
$$;


--
-- Name: validar_composicao_permissoes_sistema(); Type: FUNCTION; Schema: cadastro; Owner: -
--

CREATE FUNCTION cadastro.validar_composicao_permissoes_sistema() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    dono_id uuid;
    padrao boolean;
BEGIN
    IF TG_OP = 'UPDATE' THEN
        IF TG_TABLE_NAME = 'papel_permissoes' AND NEW.ID_PAPEL IS DISTINCT FROM OLD.ID_PAPEL THEN
            RAISE EXCEPTION 'Dono da permissão não pode ser alterado';
        END IF;
        IF TG_TABLE_NAME = 'perfil_permissoes' AND NEW.ID_PERFIL IS DISTINCT FROM OLD.ID_PERFIL THEN
            RAISE EXCEPTION 'Dono da permissão não pode ser alterado';
        END IF;
    END IF;
    IF TG_TABLE_NAME = 'papel_permissoes' THEN
        dono_id := CASE WHEN TG_OP = 'INSERT' THEN NEW.ID_PAPEL ELSE OLD.ID_PAPEL END;
        SELECT SN_SISTEMA INTO padrao FROM Cadastro.PAPEIS WHERE ID_PAPEL = dono_id;
    ELSE
        dono_id := CASE WHEN TG_OP = 'INSERT' THEN NEW.ID_PERFIL ELSE OLD.ID_PERFIL END;
        SELECT SN_SISTEMA INTO padrao FROM Cadastro.PERFIS WHERE ID_PERFIL = dono_id;
    END IF;
    IF padrao THEN
        RAISE EXCEPTION 'Permissões de registro do sistema não podem ser alteradas';
    END IF;
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
END;
$$;


--
-- Name: validar_pais_pessoa_identificacao(); Type: FUNCTION; Schema: cadastro; Owner: -
--

CREATE FUNCTION cadastro.validar_pais_pessoa_identificacao() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_id_pais integer;
BEGIN
    SELECT ID_PAIS INTO v_id_pais
      FROM Cadastro.TIPOS_IDENTIFICACAO
     WHERE ID_TIPO_IDENTIFICACAO = NEW.ID_TIPO_IDENTIFICACAO
     FOR SHARE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Tipo de identificação inexistente: %', NEW.ID_TIPO_IDENTIFICACAO
            USING ERRCODE = '23503';
    END IF;

    IF NEW.ID_PAIS <> v_id_pais THEN
        RAISE EXCEPTION 'O país da identificação deve corresponder ao país do tipo selecionado.'
            USING ERRCODE = '23514';
    END IF;

    RETURN NEW;
END;
$$;


--
-- Name: validar_papel(); Type: FUNCTION; Schema: cadastro; Owner: -
--

CREATE FUNCTION cadastro.validar_papel() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        IF OLD.SN_SISTEMA THEN
            RAISE EXCEPTION 'Papel do sistema não pode ser excluído';
        END IF;
        IF EXISTS (
            SELECT 1 FROM Cadastro.PERFIL_PAPEIS pp
            JOIN Cadastro.USUARIO_PERFIS up ON up.ID_PERFIL = pp.ID_PERFIL
            WHERE pp.ID_PAPEL = OLD.ID_PAPEL
        ) THEN
            RAISE EXCEPTION 'Papel já utilizado deve ser inativado';
        END IF;
        RETURN OLD;
    END IF;

    IF NEW.ID_PAPEL IS DISTINCT FROM OLD.ID_PAPEL
       OR NEW.CD_PAPEL IS DISTINCT FROM OLD.CD_PAPEL
       OR NEW.SN_SISTEMA IS DISTINCT FROM OLD.SN_SISTEMA
       OR NEW.DT_INCLUSAO IS DISTINCT FROM OLD.DT_INCLUSAO THEN
        RAISE EXCEPTION 'Identidade e código do papel não podem ser alterados';
    END IF;
    IF OLD.SN_SISTEMA AND (NEW.SN_ATIVO IS DISTINCT FROM OLD.SN_ATIVO
                           OR NEW.DT_EXCLUSAO IS DISTINCT FROM OLD.DT_EXCLUSAO) THEN
        RAISE EXCEPTION 'Papel do sistema permite alterar somente nome e descrição';
    END IF;
    IF NEW.DT_EXCLUSAO IS NOT NULL AND OLD.DT_EXCLUSAO IS NULL AND EXISTS (
        SELECT 1 FROM Cadastro.PERFIL_PAPEIS pp
        JOIN Cadastro.USUARIO_PERFIS up ON up.ID_PERFIL = pp.ID_PERFIL
        WHERE pp.ID_PAPEL = OLD.ID_PAPEL
    ) THEN
        RAISE EXCEPTION 'Papel já utilizado deve ser inativado';
    END IF;
    RETURN NEW;
END;
$$;


--
-- Name: validar_perfil(); Type: FUNCTION; Schema: cadastro; Owner: -
--

CREATE FUNCTION cadastro.validar_perfil() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        IF OLD.SN_SISTEMA THEN
            RAISE EXCEPTION 'Perfil do sistema não pode ser excluído';
        END IF;
        IF EXISTS (SELECT 1 FROM Cadastro.USUARIO_PERFIS WHERE ID_PERFIL = OLD.ID_PERFIL) THEN
            RAISE EXCEPTION 'Perfil já utilizado deve ser inativado';
        END IF;
        RETURN OLD;
    END IF;

    IF NEW.ID_PERFIL IS DISTINCT FROM OLD.ID_PERFIL
       OR NEW.CD_PERFIL IS DISTINCT FROM OLD.CD_PERFIL
       OR NEW.SN_SISTEMA IS DISTINCT FROM OLD.SN_SISTEMA
       OR NEW.DT_INCLUSAO IS DISTINCT FROM OLD.DT_INCLUSAO THEN
        RAISE EXCEPTION 'Identidade e código do perfil não podem ser alterados';
    END IF;
    IF OLD.SN_SISTEMA AND (NEW.SN_ATIVO IS DISTINCT FROM OLD.SN_ATIVO
                           OR NEW.DT_EXCLUSAO IS DISTINCT FROM OLD.DT_EXCLUSAO) THEN
        RAISE EXCEPTION 'Perfil do sistema permite alterar somente nome e descrição';
    END IF;
    IF NEW.DT_EXCLUSAO IS NOT NULL AND OLD.DT_EXCLUSAO IS NULL
       AND EXISTS (SELECT 1 FROM Cadastro.USUARIO_PERFIS WHERE ID_PERFIL = OLD.ID_PERFIL) THEN
        RAISE EXCEPTION 'Perfil já utilizado deve ser inativado';
    END IF;
    RETURN NEW;
END;
$$;


--
-- Name: validar_perfil_papel(); Type: FUNCTION; Schema: cadastro; Owner: -
--

CREATE FUNCTION cadastro.validar_perfil_papel() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    perfil_id uuid;
BEGIN
    perfil_id := CASE WHEN TG_OP = 'INSERT' THEN NEW.ID_PERFIL ELSE OLD.ID_PERFIL END;
    IF EXISTS (SELECT 1 FROM Cadastro.PERFIS WHERE ID_PERFIL = perfil_id AND SN_SISTEMA) THEN
        RAISE EXCEPTION 'Composição de perfil do sistema não pode ser alterada';
    END IF;
    IF TG_OP = 'UPDATE' THEN
        IF NEW.ID_PERFIL_PAPEL IS DISTINCT FROM OLD.ID_PERFIL_PAPEL
           OR NEW.ID_PERFIL IS DISTINCT FROM OLD.ID_PERFIL
           OR NEW.ID_PAPEL IS DISTINCT FROM OLD.ID_PAPEL
           OR NEW.DT_INCLUSAO IS DISTINCT FROM OLD.DT_INCLUSAO THEN
            RAISE EXCEPTION 'Identidade do vínculo perfil-papel não pode ser alterada';
        END IF;
        RETURN NEW;
    END IF;
    IF TG_OP = 'DELETE' THEN
        IF EXISTS (SELECT 1 FROM Cadastro.USUARIO_PERFIS WHERE ID_PERFIL = OLD.ID_PERFIL) THEN
            RAISE EXCEPTION 'Vínculo histórico de perfil atribuído não pode ser excluído';
        END IF;
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$;


--
-- Name: definir_alteracao_metadados_arquivo(); Type: FUNCTION; Schema: docs; Owner: -
--

CREATE FUNCTION docs.definir_alteracao_metadados_arquivo() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        NEW.DT_ALTERACAO := NEW.DT_INCLUSAO;
    ELSIF (NEW.DS_TITULO, NEW.DS_DESCRICAO, NEW.TP_CLASSIFICACAO) IS DISTINCT FROM (OLD.DS_TITULO, OLD.DS_DESCRICAO, OLD.TP_CLASSIFICACAO) THEN
        NEW.DT_ALTERACAO := GREATEST(CURRENT_TIMESTAMP, NEW.DT_INCLUSAO);
    ELSE
        NEW.DT_ALTERACAO := OLD.DT_ALTERACAO;
    END IF;
    RETURN NEW;
END;
$$;


--
-- Name: bloquear_definicao_publicada(); Type: FUNCTION; Schema: processos; Owner: -
--

CREATE FUNCTION processos.bloquear_definicao_publicada() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    item jsonb;
    versao uuid;
    bloqueada boolean;
BEGIN
    FOR item IN SELECT valor FROM (VALUES
        (CASE WHEN TG_OP <> 'INSERT' THEN to_jsonb(OLD) END),
        (CASE WHEN TG_OP <> 'DELETE' THEN to_jsonb(NEW) END)
    ) AS dados(valor) WHERE valor IS NOT NULL LOOP
        IF TG_ARGV[0] = 'direta' THEN
            versao := (item ->> 'id_protocolo_versao')::uuid;
            SELECT EXISTS (SELECT 1 FROM Processos.PROTOCOLO_VERSOES
                           WHERE ID_PROTOCOLO_VERSAO = versao AND NR_VERSAO > 0) INTO bloqueada;
        ELSIF TG_ARGV[0] = 'formulario' THEN
            SELECT EXISTS (SELECT 1 FROM Processos.FORMULARIOS f JOIN Processos.PROTOCOLO_VERSOES v USING (ID_PROTOCOLO_VERSAO)
                           WHERE f.ID_FORMULARIO = (item ->> 'id_formulario')::uuid AND v.NR_VERSAO > 0) INTO bloqueada;
        ELSIF TG_ARGV[0] = 'etapa' THEN
            SELECT EXISTS (SELECT 1 FROM Processos.PROTOCOLOS_ETAPAS e JOIN Processos.PROTOCOLO_VERSOES v USING (ID_PROTOCOLO_VERSAO)
                           WHERE e.ID_PROTOCOLO_ETAPA = (item ->> 'id_protocolo_etapa')::uuid AND v.NR_VERSAO > 0) INTO bloqueada;
        ELSIF TG_ARGV[0] = 'variavel' THEN
            SELECT EXISTS (SELECT 1 FROM Processos.PROTOCOLO_VERSAO_VARIAVEIS x JOIN Processos.PROTOCOLO_VERSOES v USING (ID_PROTOCOLO_VERSAO)
                           WHERE x.ID_VARIAVEL = (item ->> 'id_variavel')::uuid AND x.NR_VERSAO = (item ->> 'nr_versao')::integer
                             AND v.NR_VERSAO > 0) INTO bloqueada;
        ELSIF TG_ARGV[0] = 'documento' THEN
            SELECT EXISTS (SELECT 1 FROM Processos.PROTOCOLO_VERSAO_DOCUMENTOS x JOIN Processos.PROTOCOLO_VERSOES v USING (ID_PROTOCOLO_VERSAO)
                           WHERE x.ID_PROTOCOLO_DOCUMENTO_VERSAO = (item ->> 'id_protocolo_documento_versao')::uuid
                             AND v.NR_VERSAO > 0) INTO bloqueada;
        ELSE
            RAISE EXCEPTION 'Tipo de definição desconhecido: %', TG_ARGV[0];
        END IF;
        IF bloqueada THEN RAISE EXCEPTION 'Definição vinculada a uma versão publicada é imutável.'; END IF;
    END LOOP;
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
END;
$$;


--
-- Name: bloquear_identidade_publicada(); Type: FUNCTION; Schema: processos; Owner: -
--

CREATE FUNCTION processos.bloquear_identidade_publicada() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    usada boolean;
BEGIN
    IF TG_ARGV[0] = 'variavel' THEN
        SELECT EXISTS (SELECT 1 FROM Processos.PROTOCOLO_VERSAO_VARIAVEIS x
                       JOIN Processos.PROTOCOLO_VERSOES v USING (ID_PROTOCOLO_VERSAO)
                       WHERE x.ID_VARIAVEL = OLD.ID_VARIAVEL AND v.NR_VERSAO > 0) INTO usada;
    ELSE
        SELECT EXISTS (SELECT 1 FROM Processos.PROTOCOLO_VERSAO_DOCUMENTOS x
                       JOIN Processos.PROTOCOLO_VERSOES v USING (ID_PROTOCOLO_VERSAO)
                       WHERE x.ID_PROTOCOLO_DOCUMENTO = OLD.ID_PROTOCOLO_DOCUMENTO AND v.NR_VERSAO > 0) INTO usada;
    END IF;
    IF usada THEN RAISE EXCEPTION 'Identidade usada por versão publicada não pode ser alterada ou excluída.'; END IF;
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
END;
$$;


--
-- Name: calcular_limite(timestamp with time zone, integer, character); Type: FUNCTION; Schema: processos; Owner: -
--

CREATE FUNCTION processos.calcular_limite(inicio timestamp with time zone, prazo integer, unidade character) RETURNS timestamp with time zone
    LANGUAGE plpgsql STABLE
    AS $$
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


--
-- Name: definir_limite_etapa(); Type: FUNCTION; Schema: processos; Owner: -
--

CREATE FUNCTION processos.definir_limite_etapa() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF NEW.DT_LIMITE IS NULL THEN
        SELECT Processos.calcular_limite(NEW.DT_DISPONIBILIZACAO, NR_PRAZO, TP_UNIDADE_PRAZO) INTO NEW.DT_LIMITE
          FROM Processos.PROTOCOLOS_ETAPAS WHERE ID_PROTOCOLO_ETAPA = NEW.ID_PROTOCOLO_ETAPA;
    END IF;
    RETURN NEW;
END;
$$;


--
-- Name: numerar_processo(); Type: FUNCTION; Schema: processos; Owner: -
--

CREATE FUNCTION processos.numerar_processo() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
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


--
-- Name: proteger_arquivo_pdf_referenciado(); Type: FUNCTION; Schema: processos; Owner: -
--

CREATE FUNCTION processos.proteger_arquivo_pdf_referenciado() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM Docs.ARQUIVO_VERSOES av JOIN Processos.PROTOCOLO_DOCUMENTO_PDF pdf
                   ON pdf.ID_ARQUIVO_MODELO_PDF = av.ID_ARQUIVO_VERSAO WHERE av.ID_ARQUIVO = OLD.ID_ARQUIVO) THEN
        IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
        RETURN NEW;
    END IF;
    IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Arquivo PDF ainda referenciado por um Protocolo.'; END IF;
    IF NEW.ID_PASTA IS DISTINCT FROM OLD.ID_PASTA OR NEW.CD_CONTENT_TYPE IS DISTINCT FROM OLD.CD_CONTENT_TYPE
       OR NEW.DT_LIXEIRA IS NOT NULL OR NEW.DT_EXCLUSAO IS NOT NULL THEN
        IF NEW.DT_LIXEIRA IS NOT NULL OR NEW.DT_EXCLUSAO IS NOT NULL
           OR lower(NEW.CD_CONTENT_TYPE) IS DISTINCT FROM 'application/pdf'
           OR EXISTS (
               SELECT 1 FROM Docs.ARQUIVO_VERSOES av
               JOIN Processos.PROTOCOLO_DOCUMENTO_PDF pdf ON pdf.ID_ARQUIVO_MODELO_PDF = av.ID_ARQUIVO_VERSAO
               JOIN Processos.PROTOCOLO_DOCUMENTO_VERSOES dv USING (ID_PROTOCOLO_DOCUMENTO_VERSAO)
               JOIN Processos.PROTOCOLO_DOCUMENTOS d USING (ID_PROTOCOLO_DOCUMENTO)
               JOIN Processos.PROTOCOLOS p USING (ID_PROTOCOLO)
               LEFT JOIN Docs.PASTAS pasta ON pasta.ID_PASTA = NEW.ID_PASTA
               WHERE av.ID_ARQUIVO = OLD.ID_ARQUIVO
                 AND (pasta.ID_PASTA IS NULL OR pasta.ID_PASTA_PAI IS DISTINCT FROM p.ID_PASTA
                      OR pasta.DT_LIXEIRA IS NOT NULL OR pasta.DT_EXCLUSAO IS NOT NULL)
           ) THEN
            RAISE EXCEPTION 'Alteração deixaria indisponível um PDF de Protocolo.';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;


--
-- Name: proteger_pasta_pdf_referenciado(); Type: FUNCTION; Schema: processos; Owner: -
--

CREATE FUNCTION processos.proteger_pasta_pdf_referenciado() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM Docs.ARQUIVOS a JOIN Docs.ARQUIVO_VERSOES av USING (ID_ARQUIVO)
                   JOIN Processos.PROTOCOLO_DOCUMENTO_PDF pdf ON pdf.ID_ARQUIVO_MODELO_PDF = av.ID_ARQUIVO_VERSAO
                   WHERE a.ID_PASTA = OLD.ID_PASTA) THEN
        IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
        RETURN NEW;
    END IF;
    IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Pasta contém PDF referenciado por um Protocolo.'; END IF;
    IF NEW.DT_LIXEIRA IS NOT NULL OR NEW.DT_EXCLUSAO IS NOT NULL OR EXISTS (
        SELECT 1 FROM Docs.ARQUIVOS a JOIN Docs.ARQUIVO_VERSOES av USING (ID_ARQUIVO)
        JOIN Processos.PROTOCOLO_DOCUMENTO_PDF pdf ON pdf.ID_ARQUIVO_MODELO_PDF = av.ID_ARQUIVO_VERSAO
        JOIN Processos.PROTOCOLO_DOCUMENTO_VERSOES dv USING (ID_PROTOCOLO_DOCUMENTO_VERSAO)
        JOIN Processos.PROTOCOLO_DOCUMENTOS d USING (ID_PROTOCOLO_DOCUMENTO)
        JOIN Processos.PROTOCOLOS p USING (ID_PROTOCOLO)
        WHERE a.ID_PASTA = OLD.ID_PASTA AND NEW.ID_PASTA_PAI IS DISTINCT FROM p.ID_PASTA
    ) THEN
        RAISE EXCEPTION 'Pasta de PDF referenciado deve permanecer ativa e sob o Protocolo.';
    END IF;
    RETURN NEW;
END;
$$;


--
-- Name: validar_encaminhamento(); Type: FUNCTION; Schema: processos; Owner: -
--

CREATE FUNCTION processos.validar_encaminhamento() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM Processos.PROTOCOLOS_ETAPAS WHERE ID_PROTOCOLO_ETAPA = NEW.ID_PROXIMA_ETAPA
                   AND ID_PROTOCOLO_VERSAO = NEW.ID_PROTOCOLO_VERSAO) THEN
        RAISE EXCEPTION 'Destino do encaminhamento pertence a outra versão do Protocolo.';
    END IF;
    IF NEW.ID_PROXIMO_ENCAMINHAMENTO IS NOT NULL AND NOT EXISTS
       (SELECT 1 FROM Processos.ENCAMINHAMENTOS WHERE ID_ENCAMINHAMENTO = NEW.ID_PROXIMO_ENCAMINHAMENTO
        AND ID_PROTOCOLO_VERSAO = NEW.ID_PROTOCOLO_VERSAO) THEN
        RAISE EXCEPTION 'Próximo encaminhamento pertence a outra versão do Protocolo.';
    END IF;
    RETURN NEW;
END;
$$;


--
-- Name: validar_etapa_formulario(); Type: FUNCTION; Schema: processos; Owner: -
--

CREATE FUNCTION processos.validar_etapa_formulario() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
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


--
-- Name: validar_formulario_variavel(); Type: FUNCTION; Schema: processos; Owner: -
--

CREATE FUNCTION processos.validar_formulario_variavel() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM Processos.FORMULARIOS f JOIN Processos.PROTOCOLO_VERSAO_VARIAVEIS v
                   ON v.ID_PROTOCOLO_VERSAO = f.ID_PROTOCOLO_VERSAO WHERE f.ID_FORMULARIO = NEW.ID_FORMULARIO
                   AND v.ID_VARIAVEL = NEW.ID_VARIAVEL) THEN
        RAISE EXCEPTION 'Variável do formulário não está selecionada na versão do Protocolo.';
    END IF;
    RETURN NEW;
END;
$$;


--
-- Name: validar_passagem_encaminhamento(); Type: FUNCTION; Schema: processos; Owner: -
--

CREATE FUNCTION processos.validar_passagem_encaminhamento() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    id_versao uuid;
BEGIN
    SELECT ID_PROTOCOLO_VERSAO INTO id_versao FROM Processos.PROCESSOS WHERE ID_PROCESSO = NEW.ID_PROCESSO;
    IF NOT EXISTS (SELECT 1 FROM Processos.PROTOCOLOS_ETAPAS
                   WHERE ID_PROTOCOLO_ETAPA = NEW.ID_PROTOCOLO_ETAPA_DESTINO AND ID_PROTOCOLO_VERSAO = id_versao) THEN
        RAISE EXCEPTION 'Destino não pertence à versão do Protocolo deste Processo.';
    END IF;
    IF NEW.ID_ENCAMINHAMENTO IS NOT NULL AND NOT EXISTS
       (SELECT 1 FROM Processos.ENCAMINHAMENTOS
        WHERE ID_ENCAMINHAMENTO = NEW.ID_ENCAMINHAMENTO AND ID_PROTOCOLO_VERSAO = id_versao
          AND ID_PROXIMA_ETAPA = NEW.ID_PROTOCOLO_ETAPA_DESTINO) THEN
        RAISE EXCEPTION 'Encaminhamento não leva ao destino desta passagem.';
    END IF;
    IF NEW.ID_PROCESSO_ETAPA IS NOT NULL AND NOT EXISTS
       (SELECT 1 FROM Processos.PROCESSO_ETAPAS
        WHERE ID_PROCESSO_ETAPA = NEW.ID_PROCESSO_ETAPA AND ID_PROCESSO = NEW.ID_PROCESSO
          AND ID_PROTOCOLO_ETAPA = NEW.ID_PROTOCOLO_ETAPA_DESTINO
          AND NR_PASSAGEM = NEW.NR_PASSAGEM_DESTINO) THEN
        RAISE EXCEPTION 'Instância de destino não corresponde à etapa e passagem registradas.';
    END IF;
    RETURN NEW;
END;
$$;


--
-- Name: validar_pdf_campo(); Type: FUNCTION; Schema: processos; Owner: -
--

CREATE FUNCTION processos.validar_pdf_campo() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM Processos.PROTOCOLO_DOCUMENTO_VERSOES dv
        JOIN Processos.PROTOCOLO_DOCUMENTOS d USING (ID_PROTOCOLO_DOCUMENTO)
        JOIN Processos.PROTOCOLO_VARIAVEIS v ON v.ID_PROTOCOLO = d.ID_PROTOCOLO
        WHERE dv.ID_PROTOCOLO_DOCUMENTO_VERSAO = NEW.ID_PROTOCOLO_DOCUMENTO_VERSAO
          AND v.ID_VARIAVEL = NEW.ID_VARIAVEL
    ) THEN
        RAISE EXCEPTION 'Campo do PDF deve usar variável do mesmo Protocolo.';
    END IF;
    RETURN NEW;
END;
$$;


--
-- Name: validar_pdf_protocolo(); Type: FUNCTION; Schema: processos; Owner: -
--

CREATE FUNCTION processos.validar_pdf_protocolo() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM Processos.PROTOCOLO_DOCUMENTO_VERSOES dv
        JOIN Processos.PROTOCOLO_DOCUMENTOS d USING (ID_PROTOCOLO_DOCUMENTO)
        JOIN Processos.PROTOCOLOS p USING (ID_PROTOCOLO)
        JOIN Docs.ARQUIVO_VERSOES av ON av.ID_ARQUIVO_VERSAO = NEW.ID_ARQUIVO_MODELO_PDF
        JOIN Docs.ARQUIVOS a ON a.ID_ARQUIVO = av.ID_ARQUIVO
        JOIN Docs.PASTAS pasta ON pasta.ID_PASTA = a.ID_PASTA
        WHERE dv.ID_PROTOCOLO_DOCUMENTO_VERSAO = NEW.ID_PROTOCOLO_DOCUMENTO_VERSAO
          AND lower(a.CD_CONTENT_TYPE) = 'application/pdf'
          AND a.DT_LIXEIRA IS NULL AND a.DT_EXCLUSAO IS NULL
          AND pasta.ID_PASTA_PAI = p.ID_PASTA
          AND pasta.DT_LIXEIRA IS NULL AND pasta.DT_EXCLUSAO IS NULL
    ) THEN
        RAISE EXCEPTION 'PDF de origem deve estar ativo em uma subpasta do Protocolo.';
    END IF;
    RETURN NEW;
END;
$$;


--
-- Name: validar_processo_documento(); Type: FUNCTION; Schema: processos; Owner: -
--

CREATE FUNCTION processos.validar_processo_documento() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM Processos.PROCESSOS p JOIN Processos.PROTOCOLO_VERSAO_DOCUMENTOS d
                   ON d.ID_PROTOCOLO_VERSAO = p.ID_PROTOCOLO_VERSAO
                   WHERE p.ID_PROCESSO = NEW.ID_PROCESSO
                     AND d.ID_PROTOCOLO_DOCUMENTO_VERSAO = NEW.ID_PROTOCOLO_DOCUMENTO_VERSAO) THEN
        RAISE EXCEPTION 'Documento não foi selecionado pela versão do Protocolo deste Processo.';
    END IF;
    RETURN NEW;
END;
$$;


--
-- Name: validar_processo_etapa(); Type: FUNCTION; Schema: processos; Owner: -
--

CREATE FUNCTION processos.validar_processo_etapa() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM Processos.PROCESSOS p JOIN Processos.PROTOCOLOS_ETAPAS e
                   ON e.ID_PROTOCOLO_VERSAO = p.ID_PROTOCOLO_VERSAO
                   WHERE p.ID_PROCESSO = NEW.ID_PROCESSO AND e.ID_PROTOCOLO_ETAPA = NEW.ID_PROTOCOLO_ETAPA) THEN
        RAISE EXCEPTION 'Etapa não pertence à versão do Protocolo utilizada pelo Processo.';
    END IF;
    RETURN NEW;
END;
$$;


--
-- Name: validar_processo_protocolo(); Type: FUNCTION; Schema: processos; Owner: -
--

CREATE FUNCTION processos.validar_processo_protocolo() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM Processos.PROTOCOLO_VERSOES WHERE ID_PROTOCOLO_VERSAO = NEW.ID_PROTOCOLO_VERSAO
                   AND NR_VERSAO > 0) THEN
        RAISE EXCEPTION 'Processo só pode utilizar versão publicada de Protocolo.';
    END IF;
    RETURN NEW;
END;
$$;


--
-- Name: validar_regra_participacao(); Type: FUNCTION; Schema: processos; Owner: -
--

CREATE FUNCTION processos.validar_regra_participacao() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF NEW.ID_USUARIO_SISTEMA IS NULL AND NEW.ID_GRUPO IS NULL
       AND NEW.CD_TAG_GRUPO IS NULL AND NEW.CD_TAG_USUARIO IS NULL AND NEW.CD_TAG_VINCULO IS NULL THEN
        RAISE EXCEPTION 'Regra de participação precisa indicar usuário, grupo ou tag.';
    END IF;
    IF NEW.CD_TAG_GRUPO IS NOT NULL AND NOT EXISTS
       (SELECT 1 FROM Cadastro.TAGS WHERE CD_TAG = NEW.CD_TAG_GRUPO AND SN_GRUPO AND SN_ATIVA) THEN
        RAISE EXCEPTION 'Tag de grupo não está ativa e habilitada para grupos.';
    END IF;
    IF NEW.CD_TAG_USUARIO IS NOT NULL AND NOT EXISTS
       (SELECT 1 FROM Cadastro.TAGS WHERE CD_TAG = NEW.CD_TAG_USUARIO AND SN_USUARIO AND SN_ATIVA) THEN
        RAISE EXCEPTION 'Tag de usuário não está ativa e habilitada para usuários.';
    END IF;
    IF NEW.CD_TAG_VINCULO IS NOT NULL AND NOT EXISTS
       (SELECT 1 FROM Cadastro.TAGS WHERE CD_TAG = NEW.CD_TAG_VINCULO AND SN_VINCULO AND SN_ATIVA) THEN
        RAISE EXCEPTION 'Tag de vínculo não está ativa e habilitada para vínculos.';
    END IF;
    RETURN NEW;
END;
$$;


--
-- Name: validar_responsavel_vigente(); Type: FUNCTION; Schema: processos; Owner: -
--

CREATE FUNCTION processos.validar_responsavel_vigente() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    id_etapa uuid;
    id_atual uuid;
    id_historico uuid;
    quantidade integer;
BEGIN
    FOR id_etapa IN SELECT DISTINCT valor FROM (VALUES
        (CASE WHEN TG_OP <> 'INSERT' THEN OLD.ID_PROCESSO_ETAPA END),
        (CASE WHEN TG_OP <> 'DELETE' THEN NEW.ID_PROCESSO_ETAPA END)
    ) AS ids(valor) WHERE valor IS NOT NULL LOOP
        SELECT ID_USUARIO_RESPONSAVEL INTO id_atual FROM Processos.PROCESSO_ETAPAS
         WHERE ID_PROCESSO_ETAPA = id_etapa;
        IF NOT FOUND THEN CONTINUE; END IF;
        SELECT count(*) INTO quantidade
          FROM Processos.PROCESSO_ETAPA_RESPONSAVEIS
         WHERE ID_PROCESSO_ETAPA = id_etapa AND DT_FIM IS NULL;
        SELECT ID_USUARIO_SISTEMA INTO id_historico
          FROM Processos.PROCESSO_ETAPA_RESPONSAVEIS
         WHERE ID_PROCESSO_ETAPA = id_etapa AND DT_FIM IS NULL LIMIT 1;
        IF (id_atual IS NULL AND quantidade <> 0)
           OR (id_atual IS NOT NULL AND (quantidade <> 1 OR id_atual IS DISTINCT FROM id_historico)) THEN
            RAISE EXCEPTION 'Responsável atual diverge do histórico vigente da etapa %.', id_etapa;
        END IF;
    END LOOP;
    RETURN NULL;
END;
$$;


--
-- Name: validar_versao_documento(); Type: FUNCTION; Schema: processos; Owner: -
--

CREATE FUNCTION processos.validar_versao_documento() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM Processos.PROTOCOLO_VERSOES v JOIN Processos.PROTOCOLO_DOCUMENTOS d
                   ON d.ID_PROTOCOLO = v.ID_PROTOCOLO WHERE v.ID_PROTOCOLO_VERSAO = NEW.ID_PROTOCOLO_VERSAO
                   AND d.ID_PROTOCOLO_DOCUMENTO = NEW.ID_PROTOCOLO_DOCUMENTO) THEN
        RAISE EXCEPTION 'Documento não pertence ao Protocolo da versão.';
    END IF;
    RETURN NEW;
END;
$$;


--
-- Name: validar_versao_protocolo(); Type: FUNCTION; Schema: processos; Owner: -
--

CREATE FUNCTION processos.validar_versao_protocolo() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
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


--
-- Name: validar_versao_variavel(); Type: FUNCTION; Schema: processos; Owner: -
--

CREATE FUNCTION processos.validar_versao_variavel() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM Processos.PROTOCOLO_VERSOES pv JOIN Processos.PROTOCOLO_VARIAVEIS x
                   ON x.ID_PROTOCOLO = pv.ID_PROTOCOLO WHERE pv.ID_PROTOCOLO_VERSAO = NEW.ID_PROTOCOLO_VERSAO
                   AND x.ID_VARIAVEL = NEW.ID_VARIAVEL) THEN
        RAISE EXCEPTION 'Variável não pertence ao Protocolo da versão.';
    END IF;
    RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: chaves_webhook; Type: TABLE; Schema: cadastro; Owner: -
--

CREATE TABLE cadastro.chaves_webhook (
    id_webhook uuid NOT NULL,
    ds_titulo character varying(50) NOT NULL,
    vl_chave_cifrada bytea NOT NULL,
    vl_nonce bytea NOT NULL,
    id_usuario_inclusao uuid NOT NULL,
    dt_inclusao timestamp with time zone NOT NULL,
    dt_ativacao timestamp with time zone,
    dt_vencimento timestamp with time zone,
    id_usuario_invalidacao uuid,
    dt_invalidacao timestamp with time zone,
    CONSTRAINT chaves_webhook_check CHECK (((dt_vencimento IS NULL) OR (dt_vencimento > dt_inclusao))),
    CONSTRAINT chaves_webhook_ds_titulo_check CHECK ((btrim((ds_titulo)::text) <> ''::text)),
    CONSTRAINT ck_chave_webhook_ativacao CHECK (((dt_ativacao IS NULL) OR ((dt_ativacao >= dt_inclusao) AND ((dt_vencimento IS NULL) OR (dt_ativacao < dt_vencimento))))),
    CONSTRAINT ck_chave_webhook_invalidacao CHECK ((((dt_invalidacao IS NULL) AND (id_usuario_invalidacao IS NULL)) OR ((dt_invalidacao IS NOT NULL) AND (id_usuario_invalidacao IS NOT NULL) AND (dt_invalidacao >= dt_inclusao))))
);


--
-- Name: confirmacoes_email; Type: TABLE; Schema: cadastro; Owner: -
--

CREATE TABLE cadastro.confirmacoes_email (
    id_confirmacao_email uuid NOT NULL,
    id_usuario_sistema uuid NOT NULL,
    ds_email character varying(120) NOT NULL,
    cd_hash_token character varying(64) NOT NULL,
    dt_inclusao timestamp without time zone NOT NULL,
    dt_validade timestamp without time zone NOT NULL,
    dt_confirmacao timestamp without time zone,
    dt_revogacao timestamp without time zone,
    nr_tentativas_invalidas smallint DEFAULT 0 NOT NULL
);


--
-- Name: grupo_tags; Type: TABLE; Schema: cadastro; Owner: -
--

CREATE TABLE cadastro.grupo_tags (
    id_grupo integer NOT NULL,
    cd_tag character varying(30) NOT NULL,
    sn_ativa boolean NOT NULL,
    dt_inclusao timestamp without time zone NOT NULL,
    dt_alteracao timestamp without time zone NOT NULL
);


--
-- Name: grupos; Type: TABLE; Schema: cadastro; Owner: -
--

CREATE TABLE cadastro.grupos (
    id_grupo integer NOT NULL,
    ds_nome_grupo character varying(50) NOT NULL,
    sn_ativo boolean NOT NULL,
    dt_inclusao timestamp without time zone NOT NULL,
    dt_alteracao timestamp without time zone NOT NULL
);


--
-- Name: grupos_id_grupo_seq; Type: SEQUENCE; Schema: cadastro; Owner: -
--

CREATE SEQUENCE cadastro.grupos_id_grupo_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: grupos_id_grupo_seq; Type: SEQUENCE OWNED BY; Schema: cadastro; Owner: -
--

ALTER SEQUENCE cadastro.grupos_id_grupo_seq OWNED BY cadastro.grupos.id_grupo;


--
-- Name: historico_logins; Type: TABLE; Schema: cadastro; Owner: -
--

CREATE TABLE cadastro.historico_logins (
    id_login uuid NOT NULL,
    id_usuario_origem_login uuid NOT NULL,
    cd_bearer_sha256 character varying(64) NOT NULL,
    dt_login timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    dt_validade timestamp without time zone DEFAULT (CURRENT_TIMESTAMP + '7 days'::interval) NOT NULL,
    dt_ultimo_acesso timestamp without time zone,
    dt_revogacao timestamp without time zone,
    ds_endereco_ip character varying(45) NOT NULL,
    ds_user_agent text NOT NULL,
    ds_dados_navegador jsonb
);


--
-- Name: instituicao; Type: TABLE; Schema: cadastro; Owner: -
--

CREATE TABLE cadastro.instituicao (
    id_instituicao smallint DEFAULT 1 NOT NULL,
    ds_nome character varying(200) NOT NULL,
    nr_dias_permanencia_lixeira integer DEFAULT 30 NOT NULL,
    nr_tamanho_maximo_arquivo_bytes bigint DEFAULT 33554432 NOT NULL,
    dt_inclusao timestamp without time zone NOT NULL,
    dt_alteracao timestamp without time zone NOT NULL,
    sn_permitir_destinatarios_unicos boolean DEFAULT true NOT NULL,
    cd_fuso_horario character varying(64),
    ds_url_webhook text,
    ds_url_webhook_alternativo text,
    id_pasta uuid,
    nr_dias_sessao_movel smallint DEFAULT 7 NOT NULL,
    nr_dias_sessao_absoluta smallint DEFAULT 60 NOT NULL,
    nr_dias_retencao_log_integracao smallint DEFAULT 90 NOT NULL,
    ds_dominios_css_importacao text,
    CONSTRAINT ck_instituicao_dias_lixeira_positivo CHECK ((nr_dias_permanencia_lixeira > 0)),
    CONSTRAINT ck_instituicao_dominios_css_importacao CHECK (((ds_dominios_css_importacao IS NULL) OR (btrim(ds_dominios_css_importacao) <> ''::text))),
    CONSTRAINT ck_instituicao_fuso_horario_preenchido CHECK ((btrim((cd_fuso_horario)::text) <> ''::text)),
    CONSTRAINT ck_instituicao_retencao_integracao CHECK ((nr_dias_retencao_log_integracao > 0)),
    CONSTRAINT ck_instituicao_tamanho_maximo_positivo CHECK ((nr_tamanho_maximo_arquivo_bytes > 0)),
    CONSTRAINT ck_instituicao_url_webhook CHECK (((ds_url_webhook IS NULL) OR (btrim(ds_url_webhook) <> ''::text))),
    CONSTRAINT ck_instituicao_url_webhook_alternativo CHECK (((ds_url_webhook_alternativo IS NULL) OR ((ds_url_webhook IS NOT NULL) AND (btrim(ds_url_webhook_alternativo) <> ''::text)))),
    CONSTRAINT ck_instituicoes_registro_unico CHECK ((id_instituicao = 1)),
    CONSTRAINT instituicao_nr_dias_sessao_absoluta_check CHECK ((nr_dias_sessao_absoluta > 0)),
    CONSTRAINT instituicao_nr_dias_sessao_movel_check CHECK ((nr_dias_sessao_movel > 0))
);


--
-- Name: integracao_consultas; Type: TABLE; Schema: cadastro; Owner: -
--

CREATE TABLE cadastro.integracao_consultas (
    id_requisicao uuid NOT NULL,
    dt_inicio timestamp with time zone NOT NULL,
    dt_fim timestamp with time zone,
    id_usuario_origem uuid,
    id_protocolo uuid,
    id_processo uuid,
    tp_origem character(1) NOT NULL,
    cd_acao character varying(30) NOT NULL,
    cd_consulta character varying(100) NOT NULL,
    tp_resultado character(1) NOT NULL,
    id_cache character varying(64),
    cd_erro character varying(60),
    ds_erro text,
    CONSTRAINT ck_integracao_consulta_origem CHECK ((tp_origem = ANY (ARRAY['U'::bpchar, 'S'::bpchar]))),
    CONSTRAINT ck_integracao_consulta_pendente CHECK (((tp_resultado = 'P'::bpchar) = (dt_fim IS NULL))),
    CONSTRAINT ck_integracao_consulta_periodo CHECK (((dt_fim IS NULL) OR (dt_fim >= dt_inicio))),
    CONSTRAINT ck_integracao_consulta_resultado CHECK ((tp_resultado = ANY (ARRAY['P'::bpchar, 'S'::bpchar, 'N'::bpchar, 'C'::bpchar, 'E'::bpchar]))),
    CONSTRAINT ck_integracao_consulta_usuario CHECK (((tp_origem <> 'U'::bpchar) OR (id_usuario_origem IS NOT NULL))),
    CONSTRAINT integracao_consultas_cd_acao_check CHECK ((btrim((cd_acao)::text) <> ''::text)),
    CONSTRAINT integracao_consultas_cd_consulta_check CHECK ((btrim((cd_consulta)::text) <> ''::text)),
    CONSTRAINT integracao_consultas_tp_origem_check CHECK ((tp_origem = ANY (ARRAY['U'::bpchar, 'S'::bpchar]))),
    CONSTRAINT integracao_consultas_tp_resultado_check CHECK ((tp_resultado = ANY (ARRAY['P'::bpchar, 'S'::bpchar, 'N'::bpchar, 'C'::bpchar, 'E'::bpchar])))
);


--
-- Name: integracao_tentativas; Type: TABLE; Schema: cadastro; Owner: -
--

CREATE TABLE cadastro.integracao_tentativas (
    id_tentativa uuid NOT NULL,
    id_requisicao uuid NOT NULL,
    id_webhook uuid NOT NULL,
    tp_destino character(1) NOT NULL,
    dt_inicio timestamp with time zone NOT NULL,
    dt_fim timestamp with time zone,
    nr_status_http smallint,
    tp_resultado character(1) NOT NULL,
    cd_erro character varying(60),
    ds_erro text,
    CONSTRAINT ck_integracao_tentativa_destino CHECK ((tp_destino = ANY (ARRAY['P'::bpchar, 'A'::bpchar]))),
    CONSTRAINT ck_integracao_tentativa_pendente CHECK (((tp_resultado = 'P'::bpchar) = (dt_fim IS NULL))),
    CONSTRAINT ck_integracao_tentativa_periodo CHECK (((dt_fim IS NULL) OR (dt_fim >= dt_inicio))),
    CONSTRAINT ck_integracao_tentativa_resultado CHECK ((tp_resultado = ANY (ARRAY['P'::bpchar, 'S'::bpchar, 'N'::bpchar, 'H'::bpchar, 'T'::bpchar, 'R'::bpchar, 'V'::bpchar]))),
    CONSTRAINT ck_integracao_tentativa_status_http CHECK (((nr_status_http IS NULL) OR ((nr_status_http >= 100) AND (nr_status_http <= 599)))),
    CONSTRAINT integracao_tentativas_nr_status_http_check CHECK (((nr_status_http IS NULL) OR ((nr_status_http >= 100) AND (nr_status_http <= 599)))),
    CONSTRAINT integracao_tentativas_tp_destino_check CHECK ((tp_destino = ANY (ARRAY['P'::bpchar, 'A'::bpchar]))),
    CONSTRAINT integracao_tentativas_tp_resultado_check CHECK ((tp_resultado = ANY (ARRAY['P'::bpchar, 'S'::bpchar, 'N'::bpchar, 'H'::bpchar, 'T'::bpchar, 'R'::bpchar, 'V'::bpchar])))
);


--
-- Name: origens_login; Type: TABLE; Schema: cadastro; Owner: -
--

CREATE TABLE cadastro.origens_login (
    id_origem_login uuid NOT NULL,
    cd_origem smallint NOT NULL,
    ds_nome character varying(120) NOT NULL,
    ds_descricao text NOT NULL,
    tp_autenticacao character(1) NOT NULL,
    sn_permite_autocadastro boolean NOT NULL,
    sn_ativa boolean NOT NULL,
    dt_inclusao timestamp without time zone NOT NULL,
    dt_alteracao timestamp without time zone NOT NULL,
    dt_exclusao timestamp without time zone
);


--
-- Name: paises; Type: TABLE; Schema: cadastro; Owner: -
--

CREATE TABLE cadastro.paises (
    id_pais integer NOT NULL,
    cd_iso_2 character(2) NOT NULL,
    cd_iso_3 character(3) NOT NULL,
    ds_nome character varying(100) NOT NULL,
    ds_nome_oficial character varying(150) NOT NULL,
    cd_telefone character varying(10) NOT NULL,
    cd_moeda character(3) NOT NULL,
    cd_idioma character varying(20) NOT NULL,
    ds_capital character varying(100) NOT NULL,
    sn_ativo boolean NOT NULL,
    dt_inclusao timestamp without time zone NOT NULL
);


--
-- Name: paises_id_pais_seq; Type: SEQUENCE; Schema: cadastro; Owner: -
--

CREATE SEQUENCE cadastro.paises_id_pais_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: paises_id_pais_seq; Type: SEQUENCE OWNED BY; Schema: cadastro; Owner: -
--

ALTER SEQUENCE cadastro.paises_id_pais_seq OWNED BY cadastro.paises.id_pais;


--
-- Name: papeis; Type: TABLE; Schema: cadastro; Owner: -
--

CREATE TABLE cadastro.papeis (
    id_papel uuid NOT NULL,
    cd_papel character varying(70) NOT NULL,
    ds_nome character varying(120) NOT NULL,
    ds_descricao text NOT NULL,
    sn_sistema boolean DEFAULT false NOT NULL,
    sn_ativo boolean DEFAULT true NOT NULL,
    dt_inclusao timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    dt_alteracao timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    dt_exclusao timestamp without time zone
);


--
-- Name: papel_permissoes; Type: TABLE; Schema: cadastro; Owner: -
--

CREATE TABLE cadastro.papel_permissoes (
    id_papel_permissao uuid NOT NULL,
    id_papel uuid NOT NULL,
    id_permissao uuid NOT NULL,
    dt_inclusao timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    dt_exclusao timestamp without time zone
);


--
-- Name: perfil_papeis; Type: TABLE; Schema: cadastro; Owner: -
--

CREATE TABLE cadastro.perfil_papeis (
    id_perfil_papel uuid NOT NULL,
    id_perfil uuid NOT NULL,
    id_papel uuid NOT NULL,
    dt_inclusao timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    dt_exclusao timestamp without time zone
);


--
-- Name: perfil_permissoes; Type: TABLE; Schema: cadastro; Owner: -
--

CREATE TABLE cadastro.perfil_permissoes (
    id_perfil_permissao uuid NOT NULL,
    id_perfil uuid NOT NULL,
    id_permissao uuid NOT NULL,
    tp_efeito character(1) NOT NULL,
    ds_justificativa text,
    dt_inclusao timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    dt_exclusao timestamp without time zone,
    CONSTRAINT ck_perfil_permissoes_efeito CHECK ((tp_efeito = ANY (ARRAY['C'::bpchar, 'N'::bpchar])))
);


--
-- Name: perfis; Type: TABLE; Schema: cadastro; Owner: -
--

CREATE TABLE cadastro.perfis (
    id_perfil uuid NOT NULL,
    cd_perfil character varying(70) NOT NULL,
    ds_nome character varying(120) NOT NULL,
    ds_descricao text NOT NULL,
    sn_sistema boolean DEFAULT false NOT NULL,
    sn_ativo boolean DEFAULT true NOT NULL,
    dt_inclusao timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    dt_alteracao timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    dt_exclusao timestamp without time zone
);


--
-- Name: permissoes; Type: TABLE; Schema: cadastro; Owner: -
--

CREATE TABLE cadastro.permissoes (
    id_permissao uuid NOT NULL,
    id_programa uuid NOT NULL,
    cd_permissao character varying(120) NOT NULL,
    ds_nome character varying(120) NOT NULL,
    ds_descricao text NOT NULL,
    cd_acao character varying(30) NOT NULL,
    sn_sensivel boolean DEFAULT false NOT NULL,
    sn_requer_confirmacao boolean DEFAULT false NOT NULL,
    sn_ativa boolean DEFAULT true NOT NULL,
    dt_inclusao timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    dt_alteracao timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    dt_exclusao timestamp without time zone
);


--
-- Name: pessoa_identificacoes; Type: TABLE; Schema: cadastro; Owner: -
--

CREATE TABLE cadastro.pessoa_identificacoes (
    id_pessoa uuid NOT NULL,
    id_tipo_identificacao integer NOT NULL,
    id_pais integer NOT NULL,
    cd_identificacao character varying(70) NOT NULL,
    dt_inclusao timestamp without time zone NOT NULL
);


--
-- Name: pessoa_nacionalidades; Type: TABLE; Schema: cadastro; Owner: -
--

CREATE TABLE cadastro.pessoa_nacionalidades (
    id_pessoa uuid NOT NULL,
    id_pais integer NOT NULL
);


--
-- Name: pessoas; Type: TABLE; Schema: cadastro; Owner: -
--

CREATE TABLE cadastro.pessoas (
    id_pessoa uuid NOT NULL,
    ds_nome_pessoa character varying(255) NOT NULL,
    ds_nome_social character varying(255),
    tp_sexo character(1),
    ds_end_email character varying(120),
    ds_telefone character varying(30),
    dt_nascimento timestamp without time zone,
    dt_inclusao timestamp without time zone NOT NULL,
    dt_exclusao timestamp without time zone
);


--
-- Name: programas; Type: TABLE; Schema: cadastro; Owner: -
--

CREATE TABLE cadastro.programas (
    id_programa uuid NOT NULL,
    id_programa_pai uuid,
    cd_programa character varying(70) NOT NULL,
    ds_nome character varying(120) NOT NULL,
    ds_descricao text NOT NULL,
    tp_programa character(1) NOT NULL,
    ds_rota_interface character varying(200),
    sn_ativo boolean DEFAULT true NOT NULL,
    dt_inclusao timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    dt_alteracao timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    dt_exclusao timestamp without time zone
);


--
-- Name: recursos_instituicao; Type: TABLE; Schema: cadastro; Owner: -
--

CREATE TABLE cadastro.recursos_instituicao (
    id_instituicao smallint DEFAULT 1 NOT NULL,
    id_arquivo_versao uuid NOT NULL,
    cd_recurso character varying(40) NOT NULL
);


--
-- Name: tags; Type: TABLE; Schema: cadastro; Owner: -
--

CREATE TABLE cadastro.tags (
    cd_tag character varying(30) NOT NULL,
    ds_tag character varying(255),
    sn_grupo boolean NOT NULL,
    sn_usuario boolean NOT NULL,
    sn_vinculo boolean NOT NULL,
    sn_ativa boolean NOT NULL,
    dt_inclusao timestamp without time zone NOT NULL,
    dt_alteracao timestamp without time zone NOT NULL,
    CONSTRAINT ck_tags_aplicacao CHECK ((sn_grupo OR sn_usuario OR sn_vinculo))
);


--
-- Name: tipos_identificacao; Type: TABLE; Schema: cadastro; Owner: -
--

CREATE TABLE cadastro.tipos_identificacao (
    id_tipo_identificacao integer NOT NULL,
    id_pais integer NOT NULL,
    cd_tipo character varying(10) NOT NULL,
    ds_nome character varying(70) NOT NULL,
    ds_descricao character varying(255),
    cd_regex character varying(50) NOT NULL,
    ds_mascara character varying(30),
    sn_ativo boolean NOT NULL,
    dt_inclusao timestamp without time zone NOT NULL,
    dt_alteracao timestamp without time zone NOT NULL
);


--
-- Name: tipos_identificacao_id_tipo_identificacao_seq; Type: SEQUENCE; Schema: cadastro; Owner: -
--

CREATE SEQUENCE cadastro.tipos_identificacao_id_tipo_identificacao_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tipos_identificacao_id_tipo_identificacao_seq; Type: SEQUENCE OWNED BY; Schema: cadastro; Owner: -
--

ALTER SEQUENCE cadastro.tipos_identificacao_id_tipo_identificacao_seq OWNED BY cadastro.tipos_identificacao.id_tipo_identificacao;


--
-- Name: usuario_grupos; Type: TABLE; Schema: cadastro; Owner: -
--

CREATE TABLE cadastro.usuario_grupos (
    id_usuario_sistema uuid NOT NULL,
    id_grupo integer NOT NULL,
    sn_ativo boolean NOT NULL,
    dt_inclusao timestamp without time zone NOT NULL,
    dt_alteracao timestamp without time zone NOT NULL
);


--
-- Name: usuario_origens_login; Type: TABLE; Schema: cadastro; Owner: -
--

CREATE TABLE cadastro.usuario_origens_login (
    id_usuario_origem_login uuid NOT NULL,
    id_usuario_sistema uuid NOT NULL,
    id_origem_login uuid NOT NULL,
    cd_usuario_na_origem character varying(255) NOT NULL,
    ds_email_origem character varying(320),
    sn_email_verificado boolean NOT NULL,
    dt_inclusao timestamp without time zone NOT NULL,
    dt_ultimo_login timestamp without time zone,
    dt_revogacao timestamp without time zone
);


--
-- Name: usuario_perfis; Type: TABLE; Schema: cadastro; Owner: -
--

CREATE TABLE cadastro.usuario_perfis (
    id_usuario_perfil uuid NOT NULL,
    id_usuario_sistema uuid NOT NULL,
    id_perfil uuid NOT NULL,
    dt_inclusao timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    dt_inicio_vigencia timestamp without time zone,
    dt_fim_vigencia timestamp without time zone,
    dt_revogacao timestamp without time zone
);


--
-- Name: usuario_tags; Type: TABLE; Schema: cadastro; Owner: -
--

CREATE TABLE cadastro.usuario_tags (
    id_usuario_sistema uuid NOT NULL,
    cd_tag character varying(30) NOT NULL,
    sn_ativa boolean NOT NULL,
    dt_inclusao timestamp without time zone NOT NULL,
    dt_alteracao timestamp without time zone NOT NULL
);


--
-- Name: usuarios_sistema; Type: TABLE; Schema: cadastro; Owner: -
--

CREATE TABLE cadastro.usuarios_sistema (
    id_usuario_sistema uuid NOT NULL,
    id_pessoa uuid NOT NULL,
    ds_nome character varying(200) NOT NULL,
    ds_email character varying(120) NOT NULL,
    cd_hash_senha character varying(255),
    dt_nascimento timestamp without time zone,
    dt_inclusao timestamp without time zone NOT NULL,
    dt_exclusao timestamp without time zone
);


--
-- Name: variaveis_instituicao; Type: TABLE; Schema: cadastro; Owner: -
--

CREATE TABLE cadastro.variaveis_instituicao (
    id_atributo integer NOT NULL,
    id_atributo_pai integer,
    cd_nome_tecnico character varying(21) NOT NULL,
    tp_atributo character(1) NOT NULL,
    vl_atributo character varying(255),
    dt_inclusao timestamp with time zone NOT NULL,
    dt_alteracao timestamp with time zone NOT NULL,
    dt_invalidacao timestamp with time zone,
    CONSTRAINT variaveis_instituicao_check CHECK ((((tp_atributo = 'G'::bpchar) AND (vl_atributo IS NULL)) OR ((tp_atributo = 'V'::bpchar) AND (vl_atributo IS NOT NULL) AND (btrim((vl_atributo)::text) <> ''::text))))
);


--
-- Name: variaveis_instituicao_id_atributo_seq; Type: SEQUENCE; Schema: cadastro; Owner: -
--

CREATE SEQUENCE cadastro.variaveis_instituicao_id_atributo_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: variaveis_instituicao_id_atributo_seq; Type: SEQUENCE OWNED BY; Schema: cadastro; Owner: -
--

ALTER SEQUENCE cadastro.variaveis_instituicao_id_atributo_seq OWNED BY cadastro.variaveis_instituicao.id_atributo;


--
-- Name: vinculo_tags; Type: TABLE; Schema: cadastro; Owner: -
--

CREATE TABLE cadastro.vinculo_tags (
    id_usuario_sistema uuid NOT NULL,
    id_grupo integer NOT NULL,
    cd_tag character varying(30) NOT NULL,
    sn_ativo boolean NOT NULL,
    dt_inclusao timestamp without time zone NOT NULL,
    dt_alteracao timestamp without time zone NOT NULL
);


--
-- Name: arquivo_permissoes; Type: TABLE; Schema: docs; Owner: -
--

CREATE TABLE docs.arquivo_permissoes (
    id_arquivo_permissao uuid NOT NULL,
    id_arquivo uuid NOT NULL,
    tp_destinatario character(1) NOT NULL,
    id_usuario_sistema uuid,
    id_grupo integer,
    cd_tag character varying(30),
    dt_inicio timestamp with time zone NOT NULL,
    dt_fim timestamp with time zone,
    id_usuario_concedeu uuid NOT NULL,
    id_usuario_revogou uuid,
    CONSTRAINT arquivo_permissoes_tp_destinatario_check CHECK ((tp_destinatario = ANY (ARRAY['U'::bpchar, 'G'::bpchar, 'T'::bpchar])))
);


--
-- Name: arquivo_tags; Type: TABLE; Schema: docs; Owner: -
--

CREATE TABLE docs.arquivo_tags (
    id_arquivo uuid NOT NULL,
    cd_tag character varying(60) NOT NULL,
    dt_associacao timestamp with time zone NOT NULL,
    id_usuario_associou uuid NOT NULL,
    dt_remocao timestamp with time zone,
    id_usuario_removeu uuid
);


--
-- Name: arquivo_versoes; Type: TABLE; Schema: docs; Owner: -
--

CREATE TABLE docs.arquivo_versoes (
    id_arquivo_versao uuid NOT NULL,
    id_arquivo uuid NOT NULL,
    id_usuario_incluiu uuid NOT NULL,
    nr_versao integer NOT NULL,
    nr_tamanho_bytes bigint NOT NULL,
    cd_hash_sha256 character(64) NOT NULL,
    tp_origem character(1) NOT NULL,
    dt_inclusao timestamp with time zone NOT NULL
);


--
-- Name: arquivos; Type: TABLE; Schema: docs; Owner: -
--

CREATE TABLE docs.arquivos (
    id_arquivo uuid NOT NULL,
    id_pasta uuid NOT NULL,
    ds_nome_arquivo character varying(255) NOT NULL,
    ds_titulo character varying(255) NOT NULL,
    ds_descricao text,
    tp_classificacao character(1) NOT NULL,
    dt_vencimento timestamp with time zone,
    dt_inclusao timestamp with time zone NOT NULL,
    dt_lixeira timestamp with time zone,
    dt_exclusao timestamp with time zone,
    cd_content_type character varying(255),
    dt_alteracao timestamp with time zone NOT NULL,
    CONSTRAINT ck_arquivos_alteracao CHECK ((dt_alteracao >= dt_inclusao))
);


--
-- Name: arquivos_atributos; Type: TABLE; Schema: docs; Owner: -
--

CREATE TABLE docs.arquivos_atributos (
    id_arquivo uuid NOT NULL,
    id_atributo uuid NOT NULL,
    id_atributo_valor uuid NOT NULL,
    dt_alteracao timestamp without time zone NOT NULL,
    id_usuario_alterou uuid NOT NULL
);


--
-- Name: atributo_valores; Type: TABLE; Schema: docs; Owner: -
--

CREATE TABLE docs.atributo_valores (
    id_atributo_valor uuid NOT NULL,
    id_atributo uuid NOT NULL,
    ds_valor character varying(255) NOT NULL,
    nr_ordem smallint NOT NULL,
    sn_ativo boolean NOT NULL
);


--
-- Name: atributos; Type: TABLE; Schema: docs; Owner: -
--

CREATE TABLE docs.atributos (
    id_atributo uuid NOT NULL,
    ds_nome character varying(100) NOT NULL,
    ds_descricao text,
    sn_ativo boolean NOT NULL,
    dt_inclusao timestamp without time zone NOT NULL,
    dt_ultima_alteracao timestamp without time zone NOT NULL,
    id_usuario_criou uuid NOT NULL
);


--
-- Name: pasta_gestores; Type: TABLE; Schema: docs; Owner: -
--

CREATE TABLE docs.pasta_gestores (
    id_pasta_gestor uuid NOT NULL,
    id_pasta uuid NOT NULL,
    id_usuario_sistema uuid NOT NULL,
    dt_inicio timestamp with time zone NOT NULL,
    dt_exclusao timestamp with time zone,
    id_usuario_nomeou uuid NOT NULL,
    id_usuario_revogou uuid
);


--
-- Name: pasta_permissoes; Type: TABLE; Schema: docs; Owner: -
--

CREATE TABLE docs.pasta_permissoes (
    id_pasta_permissao uuid NOT NULL,
    id_pasta uuid NOT NULL,
    tp_acao character(1) NOT NULL,
    tp_destinatario character(1) NOT NULL,
    id_usuario_sistema uuid,
    id_grupo integer,
    cd_tag character varying(30),
    dt_inicio timestamp with time zone NOT NULL,
    dt_fim timestamp with time zone,
    id_usuario_concedeu uuid NOT NULL,
    id_usuario_revogou uuid
);


--
-- Name: pastas; Type: TABLE; Schema: docs; Owner: -
--

CREATE TABLE docs.pastas (
    id_pasta uuid NOT NULL,
    id_pasta_pai uuid,
    ds_nome character varying(255) NOT NULL,
    ds_descricao text,
    id_usuario_criou uuid NOT NULL,
    dt_inclusao timestamp with time zone NOT NULL,
    dt_alteracao timestamp with time zone NOT NULL,
    dt_lixeira timestamp with time zone,
    dt_exclusao timestamp without time zone,
    CONSTRAINT pastas_check CHECK ((dt_alteracao >= dt_inclusao))
);


--
-- Name: tags_arquivo; Type: TABLE; Schema: docs; Owner: -
--

CREATE TABLE docs.tags_arquivo (
    cd_tag character varying(60) NOT NULL,
    ds_descricao character varying(255),
    dt_inclusao timestamp with time zone NOT NULL
);


--
-- Name: eventos; Type: TABLE; Schema: notificacoes; Owner: -
--

CREATE TABLE notificacoes.eventos (
    id_evento uuid CONSTRAINT notificacoes_eventos_id_evento_not_null NOT NULL,
    cd_tipo character varying(40) CONSTRAINT notificacoes_eventos_cd_tipo_not_null NOT NULL,
    id_processo uuid,
    id_processo_etapa uuid,
    id_protocolo_versao uuid,
    id_usuario_ator uuid,
    dt_evento timestamp with time zone CONSTRAINT notificacoes_eventos_dt_evento_not_null NOT NULL,
    ds_titulo character varying(160) CONSTRAINT notificacoes_eventos_ds_titulo_not_null NOT NULL,
    ds_resumo text,
    cd_chave_evento character varying(160) CONSTRAINT notificacoes_eventos_cd_chave_evento_not_null NOT NULL,
    CONSTRAINT ck_notificacao_evento_etapa_processo CHECK (((id_processo_etapa IS NULL) OR (id_processo IS NOT NULL))),
    CONSTRAINT notificacoes_eventos_cd_chave_evento_check CHECK ((btrim((cd_chave_evento)::text) <> ''::text)),
    CONSTRAINT notificacoes_eventos_cd_tipo_check CHECK ((btrim((cd_tipo)::text) <> ''::text)),
    CONSTRAINT notificacoes_eventos_ds_titulo_check CHECK ((btrim((ds_titulo)::text) <> ''::text))
);


--
-- Name: notificacoes; Type: TABLE; Schema: notificacoes; Owner: -
--

CREATE TABLE notificacoes.notificacoes (
    id_notificacao uuid NOT NULL,
    id_evento uuid NOT NULL,
    id_usuario_destino uuid NOT NULL,
    tp_natureza character(1) NOT NULL,
    dt_entrega timestamp with time zone NOT NULL,
    dt_visualizacao timestamp with time zone,
    tp_situacao character(1) NOT NULL,
    dt_encerramento timestamp with time zone,
    id_usuario_atendeu uuid,
    ds_resultado text,
    CONSTRAINT ck_notificacao_encerramento CHECK ((((tp_situacao = ANY (ARRAY['P'::bpchar, 'I'::bpchar])) AND (dt_encerramento IS NULL)) OR ((tp_situacao = ANY (ARRAY['A'::bpchar, 'E'::bpchar, 'C'::bpchar])) AND (dt_encerramento IS NOT NULL)))),
    CONSTRAINT ck_notificacao_natureza_situacao CHECK ((((tp_natureza = 'I'::bpchar) AND (tp_situacao = 'I'::bpchar)) OR ((tp_natureza = 'A'::bpchar) AND (tp_situacao = ANY (ARRAY['P'::bpchar, 'A'::bpchar, 'E'::bpchar, 'C'::bpchar]))))),
    CONSTRAINT notificacoes_check CHECK (((dt_visualizacao IS NULL) OR (dt_visualizacao >= dt_entrega))),
    CONSTRAINT notificacoes_check1 CHECK (((dt_encerramento IS NULL) OR (dt_encerramento >= dt_entrega))),
    CONSTRAINT notificacoes_ds_resultado_check CHECK (((ds_resultado IS NULL) OR (btrim(ds_resultado) <> ''::text))),
    CONSTRAINT notificacoes_tp_natureza_check CHECK ((tp_natureza = ANY (ARRAY['A'::bpchar, 'I'::bpchar]))),
    CONSTRAINT notificacoes_tp_situacao_check CHECK ((tp_situacao = ANY (ARRAY['P'::bpchar, 'A'::bpchar, 'E'::bpchar, 'C'::bpchar, 'I'::bpchar])))
);


--
-- Name: encaminhamentos; Type: TABLE; Schema: processos; Owner: -
--

CREATE TABLE processos.encaminhamentos (
    id_encaminhamento uuid NOT NULL,
    id_protocolo_versao uuid NOT NULL,
    tp_encaminhamento character(1) NOT NULL,
    tx_teste text,
    id_proxima_etapa uuid NOT NULL,
    id_proximo_encaminhamento uuid,
    CONSTRAINT ck_encaminhamento_teste CHECK ((((tp_encaminhamento = 'E'::bpchar) AND (tx_teste IS NULL)) OR ((tp_encaminhamento = ANY (ARRAY['T'::bpchar, 'C'::bpchar])) AND (btrim(COALESCE(tx_teste, ''::text)) <> ''::text)))),
    CONSTRAINT ck_encaminhamento_tipo CHECK ((tp_encaminhamento = ANY (ARRAY['E'::bpchar, 'T'::bpchar, 'C'::bpchar])))
);


--
-- Name: COLUMN encaminhamentos.tp_encaminhamento; Type: COMMENT; Schema: processos; Owner: -
--

COMMENT ON COLUMN processos.encaminhamentos.tp_encaminhamento IS 'E direto (dispara e continua a cadeia); T teste (verdadeiro dispara e para; falso continua); C condicional (verdadeiro dispara e continua; falso continua sem disparar).';


--
-- Name: formulario_variaveis; Type: TABLE; Schema: processos; Owner: -
--

CREATE TABLE processos.formulario_variaveis (
    id_formulario uuid NOT NULL,
    id_variavel uuid NOT NULL,
    tp_acesso character(1) NOT NULL,
    nr_ordem smallint NOT NULL,
    sn_obrigatoria boolean NOT NULL,
    tp_apresentacao character(1) NOT NULL,
    CONSTRAINT ck_formulario_apresentacao CHECK ((tp_apresentacao = ANY (ARRAY['1'::bpchar, '2'::bpchar, '3'::bpchar, '4'::bpchar, '5'::bpchar, '6'::bpchar])))
);


--
-- Name: formularios; Type: TABLE; Schema: processos; Owner: -
--

CREATE TABLE processos.formularios (
    id_formulario uuid NOT NULL,
    id_protocolo_versao uuid NOT NULL,
    ds_titulo character varying(255) NOT NULL,
    ds_descricao text,
    dt_inclusao timestamp without time zone NOT NULL
);


--
-- Name: processo_anexos; Type: TABLE; Schema: processos; Owner: -
--

CREATE TABLE processos.processo_anexos (
    id_processo_anexo uuid NOT NULL,
    id_mensagem uuid NOT NULL,
    id_arquivo_versao uuid NOT NULL
);


--
-- Name: processo_consultas; Type: TABLE; Schema: processos; Owner: -
--

CREATE TABLE processos.processo_consultas (
    id_processo_consulta uuid NOT NULL,
    id_processo uuid NOT NULL,
    id_processo_etapa uuid NOT NULL,
    id_usuario_solicitante uuid NOT NULL,
    id_usuario_consultor uuid NOT NULL,
    tx_solicitacao text,
    tp_situacao character(1) NOT NULL,
    id_usuario_aprovador uuid,
    dt_solicitacao timestamp with time zone NOT NULL,
    dt_decisao timestamp with time zone,
    id_mensagem_parecer uuid,
    dt_encerramento timestamp with time zone,
    id_usuario_encerrou uuid,
    ds_motivo_encerramento text,
    dt_limite timestamp with time zone,
    CONSTRAINT processo_consultas_dt_limite_check CHECK (((dt_limite IS NULL) OR (dt_limite > dt_solicitacao)))
);


--
-- Name: COLUMN processo_consultas.dt_limite; Type: COMMENT; Schema: processos; Owner: -
--

COMMENT ON COLUMN processos.processo_consultas.dt_limite IS 'Prazo do parecer, opcional, informado por quem pede (a tela sugere 2 dias).';


--
-- Name: processo_convidados; Type: TABLE; Schema: processos; Owner: -
--

CREATE TABLE processos.processo_convidados (
    id_processo_convidado uuid NOT NULL,
    id_processo uuid NOT NULL,
    id_usuario_convidado uuid NOT NULL,
    id_usuario_convidou uuid NOT NULL,
    id_usuario_decidiu uuid,
    id_usuario_encerrou uuid,
    id_processo_consulta uuid,
    tp_situacao character(1) NOT NULL,
    js_visibilidade jsonb NOT NULL,
    dt_convite timestamp with time zone NOT NULL,
    dt_decisao timestamp with time zone,
    dt_encerramento timestamp with time zone,
    ds_observacao text,
    CONSTRAINT processo_convidados_check CHECK (((dt_decisao IS NULL) OR (dt_decisao >= dt_convite))),
    CONSTRAINT processo_convidados_check1 CHECK (((dt_encerramento IS NULL) OR (dt_encerramento >= COALESCE(dt_decisao, dt_convite)))),
    CONSTRAINT processo_convidados_tp_situacao_check CHECK ((tp_situacao = ANY (ARRAY['P'::bpchar, 'A'::bpchar, 'R'::bpchar, 'C'::bpchar, 'V'::bpchar])))
);


--
-- Name: processo_documento; Type: TABLE; Schema: processos; Owner: -
--

CREATE TABLE processos.processo_documento (
    id_processo_documento uuid NOT NULL,
    id_processo uuid NOT NULL,
    id_protocolo_documento_versao uuid NOT NULL,
    id_processo_etapa uuid,
    id_arquivo_versao uuid NOT NULL,
    nr_geracao smallint NOT NULL,
    tp_situacao character(1) NOT NULL,
    dt_geracao timestamp with time zone NOT NULL,
    dt_publicacao timestamp with time zone,
    dt_invalidacao timestamp with time zone,
    CONSTRAINT processo_documento_check CHECK (((dt_publicacao IS NULL) OR (dt_publicacao >= dt_geracao))),
    CONSTRAINT processo_documento_check1 CHECK (((dt_invalidacao IS NULL) OR ((dt_invalidacao >= dt_geracao) AND ((dt_publicacao IS NULL) OR (dt_invalidacao >= dt_publicacao))))),
    CONSTRAINT processo_documento_nr_geracao_check CHECK ((nr_geracao > 0))
);


--
-- Name: processo_etapa_destinatarios; Type: TABLE; Schema: processos; Owner: -
--

CREATE TABLE processos.processo_etapa_destinatarios (
    id_processo_etapa_encaminhamento uuid CONSTRAINT processo_etapa_destinatario_id_processo_etapa_encaminh_not_null NOT NULL,
    id_etapa_destinatario uuid NOT NULL
);


--
-- Name: processo_etapa_encaminhamentos; Type: TABLE; Schema: processos; Owner: -
--

CREATE TABLE processos.processo_etapa_encaminhamentos (
    id_processo_etapa_encaminhamento uuid CONSTRAINT processo_etapa_encaminhamen_id_processo_etapa_encaminh_not_null NOT NULL,
    id_processo uuid NOT NULL,
    id_processo_etapa_origem uuid,
    id_encaminhamento uuid,
    id_protocolo_etapa_destino uuid CONSTRAINT processo_etapa_encaminhamen_id_protocolo_etapa_destino_not_null NOT NULL,
    id_processo_etapa uuid,
    nr_passagem_destino smallint NOT NULL,
    tp_movimento character(1) NOT NULL,
    ds_decisao text,
    dt_inclusao timestamp with time zone NOT NULL,
    CONSTRAINT ck_processo_encaminhamento_passagem CHECK ((nr_passagem_destino > 0))
);


--
-- Name: processo_etapa_responsaveis; Type: TABLE; Schema: processos; Owner: -
--

CREATE TABLE processos.processo_etapa_responsaveis (
    id_etapa_responsavel uuid NOT NULL,
    id_processo_etapa uuid NOT NULL,
    id_usuario_sistema uuid NOT NULL,
    dt_inicio timestamp with time zone NOT NULL,
    dt_fim timestamp with time zone,
    tp_fim character(1),
    ds_observacoes text
);


--
-- Name: processo_etapas; Type: TABLE; Schema: processos; Owner: -
--

CREATE TABLE processos.processo_etapas (
    id_processo_etapa uuid NOT NULL,
    id_processo uuid NOT NULL,
    id_protocolo_etapa uuid NOT NULL,
    nr_passagem smallint NOT NULL,
    tp_situacao character(1) NOT NULL,
    id_usuario_responsavel uuid,
    dt_disponibilizacao timestamp with time zone NOT NULL,
    dt_assumiu timestamp with time zone,
    dt_finalizacao timestamp with time zone,
    dt_limite timestamp with time zone,
    CONSTRAINT ck_processo_etapa_passagem CHECK ((nr_passagem > 0)),
    CONSTRAINT processo_etapas_check CHECK ((dt_assumiu > dt_disponibilizacao)),
    CONSTRAINT processo_etapas_check1 CHECK ((dt_finalizacao > dt_assumiu)),
    CONSTRAINT processo_etapas_dt_limite_check CHECK (((dt_limite IS NULL) OR (dt_limite > dt_disponibilizacao)))
);


--
-- Name: COLUMN processo_etapas.dt_limite; Type: COMMENT; Schema: processos; Owner: -
--

COMMENT ON COLUMN processos.processo_etapas.dt_limite IS 'Prazo desta passagem, calculado pelo banco ao inserir (Processos.definir_limite_etapa) a partir do prazo da etapa do Protocolo.';


--
-- Name: processo_forum; Type: TABLE; Schema: processos; Owner: -
--

CREATE TABLE processos.processo_forum (
    id_mensagem uuid NOT NULL,
    id_processo uuid NOT NULL,
    id_usuario_autor uuid,
    tp_registro character(1) NOT NULL,
    tx_conteudo text,
    js_dados jsonb,
    dt_inclusao timestamp with time zone NOT NULL
);


--
-- Name: processo_transferencia_gestao; Type: TABLE; Schema: processos; Owner: -
--

CREATE TABLE processos.processo_transferencia_gestao (
    id_transferencia_gestao uuid NOT NULL,
    id_processo uuid NOT NULL,
    id_gestor_origem uuid NOT NULL,
    id_gestor_destino uuid,
    id_processo_etapa_encaminhamento uuid,
    tp_origem character(1) NOT NULL,
    tp_situacao character(1) NOT NULL,
    id_usuario_solicitou uuid,
    dt_solicitacao timestamp with time zone NOT NULL,
    dt_resposta timestamp with time zone,
    dt_efetivacao timestamp with time zone,
    ds_observacao text,
    CONSTRAINT processo_transferencia_gestao_check CHECK (((dt_resposta IS NULL) OR (dt_resposta >= dt_solicitacao))),
    CONSTRAINT processo_transferencia_gestao_check1 CHECK (((dt_efetivacao IS NULL) OR ((dt_efetivacao >= dt_solicitacao) AND ((dt_resposta IS NULL) OR (dt_efetivacao >= dt_resposta))))),
    CONSTRAINT processo_transferencia_gestao_tp_origem_check CHECK ((tp_origem = ANY (ARRAY['C'::bpchar, 'F'::bpchar, 'O'::bpchar]))),
    CONSTRAINT processo_transferencia_gestao_tp_situacao_check CHECK ((tp_situacao = ANY (ARRAY['P'::bpchar, 'E'::bpchar, 'R'::bpchar, 'C'::bpchar])))
);


--
-- Name: processo_variaveis_atuais; Type: TABLE; Schema: processos; Owner: -
--

CREATE TABLE processos.processo_variaveis_atuais (
    id_processo uuid NOT NULL,
    id_variavel uuid NOT NULL,
    id_processo_etapa uuid NOT NULL
);


--
-- Name: processo_variavel_valores; Type: TABLE; Schema: processos; Owner: -
--

CREATE TABLE processos.processo_variavel_valores (
    id_processo_etapa uuid NOT NULL,
    id_variavel uuid NOT NULL,
    vl_texto text,
    vl_inteiro bigint,
    vl_decimal numeric(30,6),
    cd_moeda character(3),
    cd_valor_monetario numeric(20,2),
    vl_booleano boolean,
    vl_opcao text,
    vl_data date,
    vl_hora time with time zone,
    vl_data_hora timestamp with time zone,
    dt_ultima_gravacao timestamp with time zone NOT NULL,
    id_usuario_ultima_gravacao uuid,
    cd_opcao text
);


--
-- Name: COLUMN processo_variavel_valores.vl_opcao; Type: COMMENT; Schema: processos; Owner: -
--

COMMENT ON COLUMN processos.processo_variavel_valores.vl_opcao IS 'OBSOLETO: mantido temporariamente por compatibilidade; usar CD_OPCAO. Será removido.';


--
-- Name: COLUMN processo_variavel_valores.cd_opcao; Type: COMMENT; Schema: processos; Owner: -
--

COMMENT ON COLUMN processos.processo_variavel_valores.cd_opcao IS 'Chave da opção escolhida (campo do tipo O). Substitui VL_OPCAO.';


--
-- Name: processos; Type: TABLE; Schema: processos; Owner: -
--

CREATE TABLE processos.processos (
    id_processo uuid NOT NULL,
    id_protocolo_versao uuid NOT NULL,
    id_usuario_iniciou uuid NOT NULL,
    id_usuario_gestor uuid,
    tp_situacao character(1) NOT NULL,
    dt_inicio timestamp with time zone NOT NULL,
    dt_encerramento timestamp with time zone,
    tp_resultado character(1),
    ds_resultado text,
    cd_numero character varying(30) NOT NULL,
    CONSTRAINT ck_processo_encerramento CHECK (((tp_situacao = ANY (ARRAY['F'::bpchar, 'C'::bpchar])) = (dt_encerramento IS NOT NULL))),
    CONSTRAINT ck_processo_motivo CHECK (((tp_situacao <> ALL (ARRAY['F'::bpchar, 'C'::bpchar])) OR (tp_resultado = 'P'::bpchar) OR (btrim(COALESCE(ds_resultado, ''::text)) <> ''::text))),
    CONSTRAINT ck_processo_resultado CHECK ((((tp_situacao = 'E'::bpchar) AND (tp_resultado IS NULL)) OR ((tp_situacao = 'A'::bpchar) AND ((tp_resultado IS NULL) OR (tp_resultado = ANY (ARRAY['P'::bpchar, 'N'::bpchar])))) OR ((tp_situacao = 'F'::bpchar) AND (COALESCE(tp_resultado, '-'::bpchar) = ANY (ARRAY['P'::bpchar, 'N'::bpchar]))) OR ((tp_situacao = 'C'::bpchar) AND (COALESCE(tp_resultado, '-'::bpchar) = 'C'::bpchar)))),
    CONSTRAINT processos_check CHECK ((dt_encerramento > dt_inicio)),
    CONSTRAINT processos_tp_situacao_check CHECK ((tp_situacao = ANY (ARRAY['E'::bpchar, 'A'::bpchar, 'F'::bpchar, 'C'::bpchar])))
);


--
-- Name: COLUMN processos.tp_situacao; Type: COMMENT; Schema: processos; Owner: -
--

COMMENT ON COLUMN processos.processos.tp_situacao IS 'E: em execução; A: aguardando finalização pelo gestor; F: finalizado; C: cancelado.';


--
-- Name: COLUMN processos.tp_resultado; Type: COMMENT; Schema: processos; Owner: -
--

COMMENT ON COLUMN processos.processos.tp_resultado IS 'P positivo; N negativo; C cancelado. Nulo em execução; em A pode vir pré-preenchido pelo resultado padrão da etapa final.';


--
-- Name: COLUMN processos.cd_numero; Type: COMMENT; Schema: processos; Owner: -
--

COMMENT ON COLUMN processos.processos.cd_numero IS 'Número do processo, gerado pelo banco no INSERT (Processos.numerar_processo); imutável e nunca reutilizado.';


--
-- Name: protocolo_documento_html; Type: TABLE; Schema: processos; Owner: -
--

CREATE TABLE processos.protocolo_documento_html (
    id_protocolo_documento_versao uuid NOT NULL,
    dt_inclusao timestamp without time zone NOT NULL
);


--
-- Name: TABLE protocolo_documento_html; Type: COMMENT; Schema: processos; Owner: -
--

COMMENT ON TABLE processos.protocolo_documento_html IS 'Define a versão HTML de um modelo de documento do Protocolo. O conteúdo fica em PROTOCOLO_DOCUMENTO_HTML_PARTES e os arquivos de estilo em PROTOCOLO_DOCUMENTO_HTML_CSS. Uma versão HTML deve ter um registro nesta tabela e nenhum na tabela específica de PDF.';


--
-- Name: protocolo_documento_html_css; Type: TABLE; Schema: processos; Owner: -
--

CREATE TABLE processos.protocolo_documento_html_css (
    id_documento_css uuid NOT NULL,
    id_protocolo_documento_versao uuid CONSTRAINT protocolo_documento_html_cs_id_protocolo_documento_ver_not_null NOT NULL,
    ds_nome_arquivo character varying(200) NOT NULL,
    nr_ordem smallint NOT NULL,
    ds_conteudo text,
    CONSTRAINT protocolo_documento_html_css_ds_nome_arquivo_check CHECK ((btrim((ds_nome_arquivo)::text) <> ''::text)),
    CONSTRAINT protocolo_documento_html_css_nr_ordem_check CHECK ((nr_ordem > 0))
);


--
-- Name: protocolo_documento_html_partes; Type: TABLE; Schema: processos; Owner: -
--

CREATE TABLE processos.protocolo_documento_html_partes (
    id_documento_html_parte uuid CONSTRAINT protocolo_documento_html_parte_id_documento_html_parte_not_null NOT NULL,
    id_protocolo_documento_versao uuid CONSTRAINT protocolo_documento_html_pa_id_protocolo_documento_ver_not_null NOT NULL,
    tp_parte character(1) NOT NULL,
    nr_ordem smallint NOT NULL,
    tx_html text NOT NULL
);


--
-- Name: protocolo_documento_pdf; Type: TABLE; Schema: processos; Owner: -
--

CREATE TABLE processos.protocolo_documento_pdf (
    id_protocolo_documento_versao uuid NOT NULL,
    id_arquivo_modelo_pdf uuid NOT NULL,
    dt_inclusao timestamp without time zone NOT NULL
);


--
-- Name: protocolo_documento_pdf_campos; Type: TABLE; Schema: processos; Owner: -
--

CREATE TABLE processos.protocolo_documento_pdf_campos (
    id_pdf_campo uuid CONSTRAINT protocolo_documento_pdf_campo_id_pdf_campo_not_null NOT NULL,
    id_protocolo_documento_versao uuid CONSTRAINT protocolo_documento_pdf_cam_id_protocolo_documento_ver_not_null NOT NULL,
    id_variavel uuid,
    nr_pagina smallint CONSTRAINT protocolo_documento_pdf_campo_nr_pagina_not_null NOT NULL,
    vl_pos_x numeric(10,2) CONSTRAINT protocolo_documento_pdf_campo_vl_pos_x_not_null NOT NULL,
    vl_pos_y numeric(10,2) CONSTRAINT protocolo_documento_pdf_campo_vl_pos_y_not_null NOT NULL,
    vl_largura numeric(10,2) CONSTRAINT protocolo_documento_pdf_campo_vl_largura_not_null NOT NULL,
    vl_altura numeric(10,2) CONSTRAINT protocolo_documento_pdf_campo_vl_altura_not_null NOT NULL,
    js_apresentacao jsonb CONSTRAINT protocolo_documento_pdf_campo_js_apresentacao_not_null NOT NULL,
    id_atributo integer,
    CONSTRAINT ck_pdf_campo_dimensoes CHECK (((vl_largura > (0)::numeric) AND (vl_altura > (0)::numeric))),
    CONSTRAINT ck_pdf_campo_origem CHECK (((id_variavel IS NULL) <> (id_atributo IS NULL))),
    CONSTRAINT protocolo_documento_pdf_campo_nr_pagina_check CHECK ((nr_pagina > 0))
);


--
-- Name: protocolo_documento_versoes; Type: TABLE; Schema: processos; Owner: -
--

CREATE TABLE processos.protocolo_documento_versoes (
    id_protocolo_documento_versao uuid CONSTRAINT protocolo_documento_versoes_id_protocolo_documento_ver_not_null NOT NULL,
    id_protocolo_documento uuid NOT NULL,
    nr_versao smallint NOT NULL,
    tp_modelo character(1) NOT NULL,
    ds_observacoes text,
    dt_inclusao timestamp without time zone NOT NULL,
    dt_publicacao timestamp without time zone,
    nr_dias_vencimento smallint,
    CONSTRAINT ck_protocolo_documento_versoes_dias_vencimento CHECK (((nr_dias_vencimento IS NULL) OR (nr_dias_vencimento > 0)))
);


--
-- Name: protocolo_documentos; Type: TABLE; Schema: processos; Owner: -
--

CREATE TABLE processos.protocolo_documentos (
    id_protocolo_documento uuid NOT NULL,
    id_protocolo uuid NOT NULL,
    cd_documento character varying(30) NOT NULL,
    ds_titulo character varying(70) NOT NULL,
    ds_observacoes text,
    dt_inclusao timestamp without time zone NOT NULL
);


--
-- Name: protocolo_etapa_destinatarios; Type: TABLE; Schema: processos; Owner: -
--

CREATE TABLE processos.protocolo_etapa_destinatarios (
    id_etapa_destinatario uuid NOT NULL,
    id_protocolo_etapa uuid NOT NULL,
    id_usuario_sistema uuid,
    id_grupo integer,
    cd_tag_grupo character varying(30),
    cd_tag_usuario character varying(30),
    cd_tag_vinculo character varying(30)
);


--
-- Name: protocolo_gestores_elegiveis; Type: TABLE; Schema: processos; Owner: -
--

CREATE TABLE processos.protocolo_gestores_elegiveis (
    id_gestor_elegivel uuid NOT NULL,
    id_protocolo_versao uuid NOT NULL,
    id_usuario_sistema uuid,
    id_grupo integer,
    cd_tag_grupo character varying(30),
    cd_tag_usuario character varying(30),
    cd_tag_vinculo character varying(30)
);


--
-- Name: protocolo_recursos; Type: TABLE; Schema: processos; Owner: -
--

CREATE TABLE processos.protocolo_recursos (
    id_protocolo_recurso uuid CONSTRAINT protocolo_recursos_id_documento_html_recurso_not_null NOT NULL,
    id_protocolo uuid NOT NULL,
    id_arquivo_versao uuid NOT NULL,
    cd_recurso character varying(40) NOT NULL
);


--
-- Name: protocolo_sequencias; Type: TABLE; Schema: processos; Owner: -
--

CREATE TABLE processos.protocolo_sequencias (
    id_protocolo uuid NOT NULL,
    nr_ano smallint NOT NULL,
    nr_ultimo integer NOT NULL,
    CONSTRAINT protocolo_sequencias_nr_ano_check CHECK ((nr_ano >= 0)),
    CONSTRAINT protocolo_sequencias_nr_ultimo_check CHECK ((nr_ultimo > 0))
);


--
-- Name: protocolo_variaveis; Type: TABLE; Schema: processos; Owner: -
--

CREATE TABLE processos.protocolo_variaveis (
    id_variavel uuid NOT NULL,
    id_protocolo uuid NOT NULL,
    cd_variavel character varying(100) NOT NULL,
    tp_dado character(1) NOT NULL,
    ds_descricao text,
    dt_inclusao timestamp without time zone NOT NULL,
    CONSTRAINT ck_protocolo_variavel_dado CHECK ((tp_dado = ANY (ARRAY['S'::bpchar, 'I'::bpchar, 'R'::bpchar, 'M'::bpchar, 'V'::bpchar, 'B'::bpchar, 'O'::bpchar, 'D'::bpchar, 'H'::bpchar, 'T'::bpchar])))
);


--
-- Name: protocolo_variavel_versoes; Type: TABLE; Schema: processos; Owner: -
--

CREATE TABLE processos.protocolo_variavel_versoes (
    id_variavel_versao uuid NOT NULL,
    id_variavel uuid NOT NULL,
    nr_versao integer NOT NULL,
    ds_nome character varying(255) NOT NULL,
    js_definicao jsonb NOT NULL,
    dt_inclusao timestamp without time zone NOT NULL,
    CONSTRAINT protocolo_variavel_versoes_nr_versao_check CHECK ((nr_versao > 0))
);


--
-- Name: protocolo_versao_documentos; Type: TABLE; Schema: processos; Owner: -
--

CREATE TABLE processos.protocolo_versao_documentos (
    id_protocolo_versao uuid NOT NULL,
    id_protocolo_documento uuid NOT NULL,
    id_protocolo_documento_versao uuid CONSTRAINT protocolo_versao_documentos_id_protocolo_documento_ver_not_null NOT NULL
);


--
-- Name: protocolo_versao_variaveis; Type: TABLE; Schema: processos; Owner: -
--

CREATE TABLE processos.protocolo_versao_variaveis (
    id_protocolo_versao uuid NOT NULL,
    id_variavel uuid NOT NULL,
    nr_versao integer NOT NULL
);


--
-- Name: protocolo_versoes; Type: TABLE; Schema: processos; Owner: -
--

CREATE TABLE processos.protocolo_versoes (
    id_protocolo_versao uuid NOT NULL,
    id_protocolo uuid NOT NULL,
    nr_versao smallint NOT NULL,
    tp_situacao character(1) NOT NULL,
    id_usuario_abriu uuid NOT NULL,
    id_usuario_responsavel uuid NOT NULL,
    dt_inclusao timestamp without time zone NOT NULL,
    dt_alteracao timestamp without time zone NOT NULL,
    sn_permite_convidados boolean NOT NULL,
    id_usuario_publicou uuid,
    dt_publicacao timestamp without time zone,
    ds_titulo character varying(255) NOT NULL,
    ds_descricao text,
    tx_script_inicializacao text,
    tx_script_finalizacao text,
    sn_gestor_finaliza boolean NOT NULL,
    CONSTRAINT ck_protocolo_versao_numero CHECK (((nr_versao = '-1'::integer) OR (nr_versao > 0)))
);


--
-- Name: protocolos; Type: TABLE; Schema: processos; Owner: -
--

CREATE TABLE processos.protocolos (
    id_protocolo uuid NOT NULL,
    id_usuario_criador uuid NOT NULL,
    ds_titulo character varying(255) NOT NULL,
    ds_descricao text,
    dt_inclusao timestamp without time zone NOT NULL,
    sn_ativo boolean NOT NULL,
    id_pasta uuid,
    cd_prefixo character varying(6),
    tp_sequencia character(1) DEFAULT 'A'::bpchar NOT NULL,
    CONSTRAINT protocolos_cd_prefixo_check CHECK (((cd_prefixo IS NULL) OR ((cd_prefixo)::text ~ '^[A-Z0-9]{2,6}$'::text))),
    CONSTRAINT protocolos_tp_sequencia_check CHECK ((tp_sequencia = ANY (ARRAY['A'::bpchar, 'C'::bpchar])))
);


--
-- Name: COLUMN protocolos.cd_prefixo; Type: COMMENT; Schema: processos; Owner: -
--

COMMENT ON COLUMN processos.protocolos.cd_prefixo IS 'Prefixo do número dos processos (ex.: AUT). Obrigatório para publicar; único entre todos os protocolos, ativos ou não.';


--
-- Name: COLUMN protocolos.tp_sequencia; Type: COMMENT; Schema: processos; Owner: -
--

COMMENT ON COLUMN processos.protocolos.tp_sequencia IS 'A: anual (AUT-2026-000131); C: contínua (AUT-000131).';


--
-- Name: protocolos_etapas; Type: TABLE; Schema: processos; Owner: -
--

CREATE TABLE processos.protocolos_etapas (
    id_protocolo_etapa uuid NOT NULL,
    id_protocolo_versao uuid NOT NULL,
    id_formulario uuid,
    ds_titulo character varying(255) NOT NULL,
    ds_observacoes text,
    nr_posicao_x integer NOT NULL,
    nr_posicao_y integer NOT NULL,
    tx_script_inicializacao text,
    tx_script_finalizacao text,
    id_encaminhamento uuid,
    js_geracao_documentos jsonb,
    tp_bloco character(1) DEFAULT 'E'::bpchar NOT NULL,
    tp_resultado_padrao character(1),
    nr_prazo smallint,
    tp_unidade_prazo character(1),
    CONSTRAINT ck_concentrador CHECK (((tp_bloco = 'E'::bpchar) OR ((js_geracao_documentos IS NULL) AND (tp_resultado_padrao IS NULL)))),
    CONSTRAINT ck_etapa_formulario CHECK (((tp_bloco = 'E'::bpchar) = (id_formulario IS NOT NULL))),
    CONSTRAINT ck_etapa_prazo CHECK ((((nr_prazo IS NULL) = (tp_unidade_prazo IS NULL)) AND ((tp_bloco = 'E'::bpchar) OR (nr_prazo IS NULL)))),
    CONSTRAINT protocolos_etapas_nr_prazo_check CHECK (((nr_prazo IS NULL) OR (nr_prazo > 0))),
    CONSTRAINT protocolos_etapas_tp_bloco_check CHECK ((tp_bloco = ANY (ARRAY['E'::bpchar, 'J'::bpchar]))),
    CONSTRAINT protocolos_etapas_tp_resultado_padrao_check CHECK (((tp_resultado_padrao IS NULL) OR (tp_resultado_padrao = ANY (ARRAY['P'::bpchar, 'N'::bpchar])))),
    CONSTRAINT protocolos_etapas_tp_unidade_prazo_check CHECK (((tp_unidade_prazo IS NULL) OR (tp_unidade_prazo = ANY (ARRAY['U'::bpchar, 'C'::bpchar, 'H'::bpchar]))))
);


--
-- Name: COLUMN protocolos_etapas.tp_bloco; Type: COMMENT; Schema: processos; Owner: -
--

COMMENT ON COLUMN processos.protocolos_etapas.tp_bloco IS 'E: etapa (formulário e ação humana); J: concentrador (junção de ramos paralelos, sem formulário nem destinatários).';


--
-- Name: COLUMN protocolos_etapas.tp_resultado_padrao; Type: COMMENT; Schema: processos; Owner: -
--

COMMENT ON COLUMN processos.protocolos_etapas.tp_resultado_padrao IS 'Resultado do Processo quando termina nesta etapa final: P positivo, N negativo. Obrigatório em toda etapa final na publicação.';


--
-- Name: COLUMN protocolos_etapas.tp_unidade_prazo; Type: COMMENT; Schema: processos; Owner: -
--

COMMENT ON COLUMN processos.protocolos_etapas.tp_unidade_prazo IS 'U: dias úteis (segunda a sexta, ainda sem feriados), vence no fim do dia; C: dias corridos, vence no fim do dia; H: horas exatas. Fuso: Cadastro.INSTITUICAO.CD_FUSO_HORARIO.';


--
-- Name: recursos_instituicao; Type: TABLE; Schema: processos; Owner: -
--

CREATE TABLE processos.recursos_instituicao (
    id_instituicao smallint DEFAULT 1 NOT NULL,
    id_arquivo_versao uuid NOT NULL,
    cd_recurso character varying(40) NOT NULL
);


--
-- Name: grupos id_grupo; Type: DEFAULT; Schema: cadastro; Owner: -
--

ALTER TABLE ONLY cadastro.grupos ALTER COLUMN id_grupo SET DEFAULT nextval('cadastro.grupos_id_grupo_seq'::regclass);


--
-- Name: paises id_pais; Type: DEFAULT; Schema: cadastro; Owner: -
--

ALTER TABLE ONLY cadastro.paises ALTER COLUMN id_pais SET DEFAULT nextval('cadastro.paises_id_pais_seq'::regclass);


--
-- Name: tipos_identificacao id_tipo_identificacao; Type: DEFAULT; Schema: cadastro; Owner: -
--

ALTER TABLE ONLY cadastro.tipos_identificacao ALTER COLUMN id_tipo_identificacao SET DEFAULT nextval('cadastro.tipos_identificacao_id_tipo_identificacao_seq'::regclass);


--
-- Name: variaveis_instituicao id_atributo; Type: DEFAULT; Schema: cadastro; Owner: -
--

ALTER TABLE ONLY cadastro.variaveis_instituicao ALTER COLUMN id_atributo SET DEFAULT nextval('cadastro.variaveis_instituicao_id_atributo_seq'::regclass);


--
-- Name: chaves_webhook chaves_webhook_pkey; Type: CONSTRAINT; Schema: cadastro; Owner: -
--

ALTER TABLE ONLY cadastro.chaves_webhook
    ADD CONSTRAINT chaves_webhook_pkey PRIMARY KEY (id_webhook);


--
-- Name: confirmacoes_email confirmacoes_email_pkey; Type: CONSTRAINT; Schema: cadastro; Owner: -
--

ALTER TABLE ONLY cadastro.confirmacoes_email
    ADD CONSTRAINT confirmacoes_email_pkey PRIMARY KEY (id_confirmacao_email);


--
-- Name: grupo_tags grupo_tags_pkey; Type: CONSTRAINT; Schema: cadastro; Owner: -
--

ALTER TABLE ONLY cadastro.grupo_tags
    ADD CONSTRAINT grupo_tags_pkey PRIMARY KEY (id_grupo, cd_tag);


--
-- Name: grupos grupos_pkey; Type: CONSTRAINT; Schema: cadastro; Owner: -
--

ALTER TABLE ONLY cadastro.grupos
    ADD CONSTRAINT grupos_pkey PRIMARY KEY (id_grupo);


--
-- Name: historico_logins historico_logins_pkey; Type: CONSTRAINT; Schema: cadastro; Owner: -
--

ALTER TABLE ONLY cadastro.historico_logins
    ADD CONSTRAINT historico_logins_pkey PRIMARY KEY (id_login);


--
-- Name: instituicao instituicao_pkey; Type: CONSTRAINT; Schema: cadastro; Owner: -
--

ALTER TABLE ONLY cadastro.instituicao
    ADD CONSTRAINT instituicao_pkey PRIMARY KEY (id_instituicao);


--
-- Name: integracao_consultas integracao_consultas_pkey; Type: CONSTRAINT; Schema: cadastro; Owner: -
--

ALTER TABLE ONLY cadastro.integracao_consultas
    ADD CONSTRAINT integracao_consultas_pkey PRIMARY KEY (id_requisicao);


--
-- Name: integracao_tentativas integracao_tentativas_pkey; Type: CONSTRAINT; Schema: cadastro; Owner: -
--

ALTER TABLE ONLY cadastro.integracao_tentativas
    ADD CONSTRAINT integracao_tentativas_pkey PRIMARY KEY (id_tentativa);


--
-- Name: origens_login origens_login_cd_origem_key; Type: CONSTRAINT; Schema: cadastro; Owner: -
--

ALTER TABLE ONLY cadastro.origens_login
    ADD CONSTRAINT origens_login_cd_origem_key UNIQUE (cd_origem);


--
-- Name: origens_login origens_login_pkey; Type: CONSTRAINT; Schema: cadastro; Owner: -
--

ALTER TABLE ONLY cadastro.origens_login
    ADD CONSTRAINT origens_login_pkey PRIMARY KEY (id_origem_login);


--
-- Name: paises paises_pkey; Type: CONSTRAINT; Schema: cadastro; Owner: -
--

ALTER TABLE ONLY cadastro.paises
    ADD CONSTRAINT paises_pkey PRIMARY KEY (id_pais);


--
-- Name: papeis papeis_pkey; Type: CONSTRAINT; Schema: cadastro; Owner: -
--

ALTER TABLE ONLY cadastro.papeis
    ADD CONSTRAINT papeis_pkey PRIMARY KEY (id_papel);


--
-- Name: papel_permissoes papel_permissoes_pkey; Type: CONSTRAINT; Schema: cadastro; Owner: -
--

ALTER TABLE ONLY cadastro.papel_permissoes
    ADD CONSTRAINT papel_permissoes_pkey PRIMARY KEY (id_papel_permissao);


--
-- Name: perfil_papeis perfil_papeis_pkey; Type: CONSTRAINT; Schema: cadastro; Owner: -
--

ALTER TABLE ONLY cadastro.perfil_papeis
    ADD CONSTRAINT perfil_papeis_pkey PRIMARY KEY (id_perfil_papel);


--
-- Name: perfil_permissoes perfil_permissoes_pkey; Type: CONSTRAINT; Schema: cadastro; Owner: -
--

ALTER TABLE ONLY cadastro.perfil_permissoes
    ADD CONSTRAINT perfil_permissoes_pkey PRIMARY KEY (id_perfil_permissao);


--
-- Name: perfis perfis_pkey; Type: CONSTRAINT; Schema: cadastro; Owner: -
--

ALTER TABLE ONLY cadastro.perfis
    ADD CONSTRAINT perfis_pkey PRIMARY KEY (id_perfil);


--
-- Name: permissoes permissoes_pkey; Type: CONSTRAINT; Schema: cadastro; Owner: -
--

ALTER TABLE ONLY cadastro.permissoes
    ADD CONSTRAINT permissoes_pkey PRIMARY KEY (id_permissao);


--
-- Name: pessoa_identificacoes pessoa_identificacoes_pkey; Type: CONSTRAINT; Schema: cadastro; Owner: -
--

ALTER TABLE ONLY cadastro.pessoa_identificacoes
    ADD CONSTRAINT pessoa_identificacoes_pkey PRIMARY KEY (id_pessoa, id_tipo_identificacao);


--
-- Name: pessoa_nacionalidades pessoa_nacionalidades_pkey; Type: CONSTRAINT; Schema: cadastro; Owner: -
--

ALTER TABLE ONLY cadastro.pessoa_nacionalidades
    ADD CONSTRAINT pessoa_nacionalidades_pkey PRIMARY KEY (id_pessoa, id_pais);


--
-- Name: pessoas pessoas_pkey; Type: CONSTRAINT; Schema: cadastro; Owner: -
--

ALTER TABLE ONLY cadastro.pessoas
    ADD CONSTRAINT pessoas_pkey PRIMARY KEY (id_pessoa);


--
-- Name: programas programas_pkey; Type: CONSTRAINT; Schema: cadastro; Owner: -
--

ALTER TABLE ONLY cadastro.programas
    ADD CONSTRAINT programas_pkey PRIMARY KEY (id_programa);


--
-- Name: recursos_instituicao recursos_instituicao_pkey; Type: CONSTRAINT; Schema: cadastro; Owner: -
--

ALTER TABLE ONLY cadastro.recursos_instituicao
    ADD CONSTRAINT recursos_instituicao_pkey PRIMARY KEY (id_instituicao, id_arquivo_versao);


--
-- Name: tags tags_pkey; Type: CONSTRAINT; Schema: cadastro; Owner: -
--

ALTER TABLE ONLY cadastro.tags
    ADD CONSTRAINT tags_pkey PRIMARY KEY (cd_tag);


--
-- Name: tipos_identificacao tipos_identificacao_pkey; Type: CONSTRAINT; Schema: cadastro; Owner: -
--

ALTER TABLE ONLY cadastro.tipos_identificacao
    ADD CONSTRAINT tipos_identificacao_pkey PRIMARY KEY (id_tipo_identificacao);


--
-- Name: historico_logins uk_historico_logins_bearer; Type: CONSTRAINT; Schema: cadastro; Owner: -
--

ALTER TABLE ONLY cadastro.historico_logins
    ADD CONSTRAINT uk_historico_logins_bearer UNIQUE (cd_bearer_sha256);


--
-- Name: papeis uk_papeis_codigo; Type: CONSTRAINT; Schema: cadastro; Owner: -
--

ALTER TABLE ONLY cadastro.papeis
    ADD CONSTRAINT uk_papeis_codigo UNIQUE (cd_papel);


--
-- Name: perfis uk_perfis_codigo; Type: CONSTRAINT; Schema: cadastro; Owner: -
--

ALTER TABLE ONLY cadastro.perfis
    ADD CONSTRAINT uk_perfis_codigo UNIQUE (cd_perfil);


--
-- Name: permissoes uk_permissoes_codigo; Type: CONSTRAINT; Schema: cadastro; Owner: -
--

ALTER TABLE ONLY cadastro.permissoes
    ADD CONSTRAINT uk_permissoes_codigo UNIQUE (cd_permissao);


--
-- Name: programas uk_programas_codigo; Type: CONSTRAINT; Schema: cadastro; Owner: -
--

ALTER TABLE ONLY cadastro.programas
    ADD CONSTRAINT uk_programas_codigo UNIQUE (cd_programa);


--
-- Name: usuario_grupos usuario_grupos_pkey; Type: CONSTRAINT; Schema: cadastro; Owner: -
--

ALTER TABLE ONLY cadastro.usuario_grupos
    ADD CONSTRAINT usuario_grupos_pkey PRIMARY KEY (id_usuario_sistema, id_grupo);


--
-- Name: usuario_origens_login usuario_origens_login_pkey; Type: CONSTRAINT; Schema: cadastro; Owner: -
--

ALTER TABLE ONLY cadastro.usuario_origens_login
    ADD CONSTRAINT usuario_origens_login_pkey PRIMARY KEY (id_usuario_origem_login);


--
-- Name: usuario_perfis usuario_perfis_pkey; Type: CONSTRAINT; Schema: cadastro; Owner: -
--

ALTER TABLE ONLY cadastro.usuario_perfis
    ADD CONSTRAINT usuario_perfis_pkey PRIMARY KEY (id_usuario_perfil);


--
-- Name: usuario_tags usuario_tags_pkey; Type: CONSTRAINT; Schema: cadastro; Owner: -
--

ALTER TABLE ONLY cadastro.usuario_tags
    ADD CONSTRAINT usuario_tags_pkey PRIMARY KEY (id_usuario_sistema, cd_tag);


--
-- Name: usuarios_sistema usuarios_sistema_ds_email_key; Type: CONSTRAINT; Schema: cadastro; Owner: -
--

ALTER TABLE ONLY cadastro.usuarios_sistema
    ADD CONSTRAINT usuarios_sistema_ds_email_key UNIQUE (ds_email);


--
-- Name: usuarios_sistema usuarios_sistema_id_pessoa_key; Type: CONSTRAINT; Schema: cadastro; Owner: -
--

ALTER TABLE ONLY cadastro.usuarios_sistema
    ADD CONSTRAINT usuarios_sistema_id_pessoa_key UNIQUE (id_pessoa);


--
-- Name: usuarios_sistema usuarios_sistema_pkey; Type: CONSTRAINT; Schema: cadastro; Owner: -
--

ALTER TABLE ONLY cadastro.usuarios_sistema
    ADD CONSTRAINT usuarios_sistema_pkey PRIMARY KEY (id_usuario_sistema);


--
-- Name: variaveis_instituicao variaveis_instituicao_pkey; Type: CONSTRAINT; Schema: cadastro; Owner: -
--

ALTER TABLE ONLY cadastro.variaveis_instituicao
    ADD CONSTRAINT variaveis_instituicao_pkey PRIMARY KEY (id_atributo);


--
-- Name: vinculo_tags vinculo_tags_pkey; Type: CONSTRAINT; Schema: cadastro; Owner: -
--

ALTER TABLE ONLY cadastro.vinculo_tags
    ADD CONSTRAINT vinculo_tags_pkey PRIMARY KEY (id_usuario_sistema, id_grupo, cd_tag);


--
-- Name: arquivo_permissoes arquivo_permissoes_pkey; Type: CONSTRAINT; Schema: docs; Owner: -
--

ALTER TABLE ONLY docs.arquivo_permissoes
    ADD CONSTRAINT arquivo_permissoes_pkey PRIMARY KEY (id_arquivo_permissao);


--
-- Name: arquivo_tags arquivo_tags_pkey; Type: CONSTRAINT; Schema: docs; Owner: -
--

ALTER TABLE ONLY docs.arquivo_tags
    ADD CONSTRAINT arquivo_tags_pkey PRIMARY KEY (id_arquivo, cd_tag);


--
-- Name: arquivo_versoes arquivo_versoes_pkey; Type: CONSTRAINT; Schema: docs; Owner: -
--

ALTER TABLE ONLY docs.arquivo_versoes
    ADD CONSTRAINT arquivo_versoes_pkey PRIMARY KEY (id_arquivo_versao);


--
-- Name: arquivos_atributos arquivos_atributos_pkey; Type: CONSTRAINT; Schema: docs; Owner: -
--

ALTER TABLE ONLY docs.arquivos_atributos
    ADD CONSTRAINT arquivos_atributos_pkey PRIMARY KEY (id_arquivo, id_atributo);


--
-- Name: arquivos arquivos_pkey; Type: CONSTRAINT; Schema: docs; Owner: -
--

ALTER TABLE ONLY docs.arquivos
    ADD CONSTRAINT arquivos_pkey PRIMARY KEY (id_arquivo);


--
-- Name: atributo_valores atributo_valores_pkey; Type: CONSTRAINT; Schema: docs; Owner: -
--

ALTER TABLE ONLY docs.atributo_valores
    ADD CONSTRAINT atributo_valores_pkey PRIMARY KEY (id_atributo_valor);


--
-- Name: atributos atributos_pkey; Type: CONSTRAINT; Schema: docs; Owner: -
--

ALTER TABLE ONLY docs.atributos
    ADD CONSTRAINT atributos_pkey PRIMARY KEY (id_atributo);


--
-- Name: pasta_gestores pasta_gestores_pkey; Type: CONSTRAINT; Schema: docs; Owner: -
--

ALTER TABLE ONLY docs.pasta_gestores
    ADD CONSTRAINT pasta_gestores_pkey PRIMARY KEY (id_pasta_gestor);


--
-- Name: pasta_permissoes pasta_permissoes_pkey; Type: CONSTRAINT; Schema: docs; Owner: -
--

ALTER TABLE ONLY docs.pasta_permissoes
    ADD CONSTRAINT pasta_permissoes_pkey PRIMARY KEY (id_pasta_permissao);


--
-- Name: pastas pastas_pkey; Type: CONSTRAINT; Schema: docs; Owner: -
--

ALTER TABLE ONLY docs.pastas
    ADD CONSTRAINT pastas_pkey PRIMARY KEY (id_pasta);


--
-- Name: tags_arquivo tags_arquivo_pkey; Type: CONSTRAINT; Schema: docs; Owner: -
--

ALTER TABLE ONLY docs.tags_arquivo
    ADD CONSTRAINT tags_arquivo_pkey PRIMARY KEY (cd_tag);


--
-- Name: eventos notificacoes_eventos_cd_chave_evento_key; Type: CONSTRAINT; Schema: notificacoes; Owner: -
--

ALTER TABLE ONLY notificacoes.eventos
    ADD CONSTRAINT notificacoes_eventos_cd_chave_evento_key UNIQUE (cd_chave_evento);


--
-- Name: eventos notificacoes_eventos_pkey; Type: CONSTRAINT; Schema: notificacoes; Owner: -
--

ALTER TABLE ONLY notificacoes.eventos
    ADD CONSTRAINT notificacoes_eventos_pkey PRIMARY KEY (id_evento);


--
-- Name: notificacoes notificacoes_pkey; Type: CONSTRAINT; Schema: notificacoes; Owner: -
--

ALTER TABLE ONLY notificacoes.notificacoes
    ADD CONSTRAINT notificacoes_pkey PRIMARY KEY (id_notificacao);


--
-- Name: encaminhamentos encaminhamentos_pkey; Type: CONSTRAINT; Schema: processos; Owner: -
--

ALTER TABLE ONLY processos.encaminhamentos
    ADD CONSTRAINT encaminhamentos_pkey PRIMARY KEY (id_encaminhamento);


--
-- Name: formulario_variaveis formulario_variaveis_pkey; Type: CONSTRAINT; Schema: processos; Owner: -
--

ALTER TABLE ONLY processos.formulario_variaveis
    ADD CONSTRAINT formulario_variaveis_pkey PRIMARY KEY (id_formulario, id_variavel);


--
-- Name: formularios formularios_pkey; Type: CONSTRAINT; Schema: processos; Owner: -
--

ALTER TABLE ONLY processos.formularios
    ADD CONSTRAINT formularios_pkey PRIMARY KEY (id_formulario);


--
-- Name: processo_anexos processo_anexos_pkey; Type: CONSTRAINT; Schema: processos; Owner: -
--

ALTER TABLE ONLY processos.processo_anexos
    ADD CONSTRAINT processo_anexos_pkey PRIMARY KEY (id_processo_anexo);


--
-- Name: processo_consultas processo_consultas_pkey; Type: CONSTRAINT; Schema: processos; Owner: -
--

ALTER TABLE ONLY processos.processo_consultas
    ADD CONSTRAINT processo_consultas_pkey PRIMARY KEY (id_processo_consulta);


--
-- Name: processo_convidados processo_convidados_pkey; Type: CONSTRAINT; Schema: processos; Owner: -
--

ALTER TABLE ONLY processos.processo_convidados
    ADD CONSTRAINT processo_convidados_pkey PRIMARY KEY (id_processo_convidado);


--
-- Name: processo_documento processo_documento_id_arquivo_versao_key; Type: CONSTRAINT; Schema: processos; Owner: -
--

ALTER TABLE ONLY processos.processo_documento
    ADD CONSTRAINT processo_documento_id_arquivo_versao_key UNIQUE (id_arquivo_versao);


--
-- Name: processo_documento processo_documento_pkey; Type: CONSTRAINT; Schema: processos; Owner: -
--

ALTER TABLE ONLY processos.processo_documento
    ADD CONSTRAINT processo_documento_pkey PRIMARY KEY (id_processo_documento);


--
-- Name: processo_etapa_destinatarios processo_etapa_destinatarios_pkey; Type: CONSTRAINT; Schema: processos; Owner: -
--

ALTER TABLE ONLY processos.processo_etapa_destinatarios
    ADD CONSTRAINT processo_etapa_destinatarios_pkey PRIMARY KEY (id_processo_etapa_encaminhamento, id_etapa_destinatario);


--
-- Name: processo_etapa_encaminhamentos processo_etapa_encaminhamentos_pkey; Type: CONSTRAINT; Schema: processos; Owner: -
--

ALTER TABLE ONLY processos.processo_etapa_encaminhamentos
    ADD CONSTRAINT processo_etapa_encaminhamentos_pkey PRIMARY KEY (id_processo_etapa_encaminhamento);


--
-- Name: processo_etapa_responsaveis processo_etapa_responsaveis_pkey; Type: CONSTRAINT; Schema: processos; Owner: -
--

ALTER TABLE ONLY processos.processo_etapa_responsaveis
    ADD CONSTRAINT processo_etapa_responsaveis_pkey PRIMARY KEY (id_etapa_responsavel);


--
-- Name: processo_etapas processo_etapas_pkey; Type: CONSTRAINT; Schema: processos; Owner: -
--

ALTER TABLE ONLY processos.processo_etapas
    ADD CONSTRAINT processo_etapas_pkey PRIMARY KEY (id_processo_etapa);


--
-- Name: processo_forum processo_forum_pkey; Type: CONSTRAINT; Schema: processos; Owner: -
--

ALTER TABLE ONLY processos.processo_forum
    ADD CONSTRAINT processo_forum_pkey PRIMARY KEY (id_mensagem);


--
-- Name: processo_transferencia_gestao processo_transferencia_gestao_pkey; Type: CONSTRAINT; Schema: processos; Owner: -
--

ALTER TABLE ONLY processos.processo_transferencia_gestao
    ADD CONSTRAINT processo_transferencia_gestao_pkey PRIMARY KEY (id_transferencia_gestao);


--
-- Name: processo_variaveis_atuais processo_variaveis_atuais_pkey; Type: CONSTRAINT; Schema: processos; Owner: -
--

ALTER TABLE ONLY processos.processo_variaveis_atuais
    ADD CONSTRAINT processo_variaveis_atuais_pkey PRIMARY KEY (id_processo, id_variavel);


--
-- Name: processo_variavel_valores processo_variavel_valores_pkey; Type: CONSTRAINT; Schema: processos; Owner: -
--

ALTER TABLE ONLY processos.processo_variavel_valores
    ADD CONSTRAINT processo_variavel_valores_pkey PRIMARY KEY (id_processo_etapa, id_variavel);


--
-- Name: processos processos_pkey; Type: CONSTRAINT; Schema: processos; Owner: -
--

ALTER TABLE ONLY processos.processos
    ADD CONSTRAINT processos_pkey PRIMARY KEY (id_processo);


--
-- Name: protocolo_documento_html_css protocolo_documento_html_css_pkey; Type: CONSTRAINT; Schema: processos; Owner: -
--

ALTER TABLE ONLY processos.protocolo_documento_html_css
    ADD CONSTRAINT protocolo_documento_html_css_pkey PRIMARY KEY (id_documento_css);


--
-- Name: protocolo_documento_html_partes protocolo_documento_html_partes_pkey; Type: CONSTRAINT; Schema: processos; Owner: -
--

ALTER TABLE ONLY processos.protocolo_documento_html_partes
    ADD CONSTRAINT protocolo_documento_html_partes_pkey PRIMARY KEY (id_documento_html_parte);


--
-- Name: protocolo_documento_html protocolo_documento_html_pkey; Type: CONSTRAINT; Schema: processos; Owner: -
--

ALTER TABLE ONLY processos.protocolo_documento_html
    ADD CONSTRAINT protocolo_documento_html_pkey PRIMARY KEY (id_protocolo_documento_versao);


--
-- Name: protocolo_documento_pdf_campos protocolo_documento_pdf_campo_pkey; Type: CONSTRAINT; Schema: processos; Owner: -
--

ALTER TABLE ONLY processos.protocolo_documento_pdf_campos
    ADD CONSTRAINT protocolo_documento_pdf_campo_pkey PRIMARY KEY (id_pdf_campo);


--
-- Name: protocolo_documento_pdf protocolo_documento_pdf_pkey; Type: CONSTRAINT; Schema: processos; Owner: -
--

ALTER TABLE ONLY processos.protocolo_documento_pdf
    ADD CONSTRAINT protocolo_documento_pdf_pkey PRIMARY KEY (id_protocolo_documento_versao);


--
-- Name: protocolo_documento_versoes protocolo_documento_versoes_pkey; Type: CONSTRAINT; Schema: processos; Owner: -
--

ALTER TABLE ONLY processos.protocolo_documento_versoes
    ADD CONSTRAINT protocolo_documento_versoes_pkey PRIMARY KEY (id_protocolo_documento_versao);


--
-- Name: protocolo_documentos protocolo_documentos_pkey; Type: CONSTRAINT; Schema: processos; Owner: -
--

ALTER TABLE ONLY processos.protocolo_documentos
    ADD CONSTRAINT protocolo_documentos_pkey PRIMARY KEY (id_protocolo_documento);


--
-- Name: protocolo_etapa_destinatarios protocolo_etapa_destinatarios_pkey; Type: CONSTRAINT; Schema: processos; Owner: -
--

ALTER TABLE ONLY processos.protocolo_etapa_destinatarios
    ADD CONSTRAINT protocolo_etapa_destinatarios_pkey PRIMARY KEY (id_etapa_destinatario);


--
-- Name: protocolo_gestores_elegiveis protocolo_gestores_elegiveis_pkey; Type: CONSTRAINT; Schema: processos; Owner: -
--

ALTER TABLE ONLY processos.protocolo_gestores_elegiveis
    ADD CONSTRAINT protocolo_gestores_elegiveis_pkey PRIMARY KEY (id_gestor_elegivel);


--
-- Name: protocolo_recursos protocolo_recursos_pkey; Type: CONSTRAINT; Schema: processos; Owner: -
--

ALTER TABLE ONLY processos.protocolo_recursos
    ADD CONSTRAINT protocolo_recursos_pkey PRIMARY KEY (id_protocolo_recurso);


--
-- Name: protocolo_sequencias protocolo_sequencias_pkey; Type: CONSTRAINT; Schema: processos; Owner: -
--

ALTER TABLE ONLY processos.protocolo_sequencias
    ADD CONSTRAINT protocolo_sequencias_pkey PRIMARY KEY (id_protocolo, nr_ano);


--
-- Name: protocolo_variaveis protocolo_variaveis_pkey; Type: CONSTRAINT; Schema: processos; Owner: -
--

ALTER TABLE ONLY processos.protocolo_variaveis
    ADD CONSTRAINT protocolo_variaveis_pkey PRIMARY KEY (id_variavel);


--
-- Name: protocolo_variavel_versoes protocolo_variavel_versoes_pkey; Type: CONSTRAINT; Schema: processos; Owner: -
--

ALTER TABLE ONLY processos.protocolo_variavel_versoes
    ADD CONSTRAINT protocolo_variavel_versoes_pkey PRIMARY KEY (id_variavel_versao);


--
-- Name: protocolo_versao_documentos protocolo_versao_documentos_pkey; Type: CONSTRAINT; Schema: processos; Owner: -
--

ALTER TABLE ONLY processos.protocolo_versao_documentos
    ADD CONSTRAINT protocolo_versao_documentos_pkey PRIMARY KEY (id_protocolo_versao, id_protocolo_documento);


--
-- Name: protocolo_versao_variaveis protocolo_versao_variaveis_pkey; Type: CONSTRAINT; Schema: processos; Owner: -
--

ALTER TABLE ONLY processos.protocolo_versao_variaveis
    ADD CONSTRAINT protocolo_versao_variaveis_pkey PRIMARY KEY (id_protocolo_versao, id_variavel, nr_versao);


--
-- Name: protocolo_versoes protocolo_versoes_pkey; Type: CONSTRAINT; Schema: processos; Owner: -
--

ALTER TABLE ONLY processos.protocolo_versoes
    ADD CONSTRAINT protocolo_versoes_pkey PRIMARY KEY (id_protocolo_versao);


--
-- Name: protocolos_etapas protocolos_etapas_pkey; Type: CONSTRAINT; Schema: processos; Owner: -
--

ALTER TABLE ONLY processos.protocolos_etapas
    ADD CONSTRAINT protocolos_etapas_pkey PRIMARY KEY (id_protocolo_etapa);


--
-- Name: protocolos protocolos_pkey; Type: CONSTRAINT; Schema: processos; Owner: -
--

ALTER TABLE ONLY processos.protocolos
    ADD CONSTRAINT protocolos_pkey PRIMARY KEY (id_protocolo);


--
-- Name: recursos_instituicao recursos_instituicao_pkey; Type: CONSTRAINT; Schema: processos; Owner: -
--

ALTER TABLE ONLY processos.recursos_instituicao
    ADD CONSTRAINT recursos_instituicao_pkey PRIMARY KEY (id_instituicao, id_arquivo_versao);


--
-- Name: chave_webhook_unica_ativa; Type: INDEX; Schema: cadastro; Owner: -
--

CREATE UNIQUE INDEX chave_webhook_unica_ativa ON cadastro.chaves_webhook USING btree ((1)) WHERE ((dt_ativacao IS NOT NULL) AND (dt_invalidacao IS NULL));


--
-- Name: codigodorecurso; Type: INDEX; Schema: cadastro; Owner: -
--

CREATE UNIQUE INDEX codigodorecurso ON cadastro.recursos_instituicao USING btree (cd_recurso);


--
-- Name: identificacao_unica_por_pais; Type: INDEX; Schema: cadastro; Owner: -
--

CREATE UNIQUE INDEX identificacao_unica_por_pais ON cadastro.pessoa_identificacoes USING btree (id_pais, cd_identificacao);


--
-- Name: integracao_consultas_dt_fim; Type: INDEX; Schema: cadastro; Owner: -
--

CREATE INDEX integracao_consultas_dt_fim ON cadastro.integracao_consultas USING btree (dt_fim);


--
-- Name: integracao_tentativas_requisicao; Type: INDEX; Schema: cadastro; Owner: -
--

CREATE INDEX integracao_tentativas_requisicao ON cadastro.integracao_tentativas USING btree (id_requisicao);


--
-- Name: pessoapais; Type: INDEX; Schema: cadastro; Owner: -
--

CREATE UNIQUE INDEX pessoapais ON cadastro.pessoa_identificacoes USING btree (id_pessoa, id_pais);


--
-- Name: poremail; Type: INDEX; Schema: cadastro; Owner: -
--

CREATE UNIQUE INDEX poremail ON cadastro.usuarios_sistema USING btree (ds_email);


--
-- Name: poridusuarioorigem; Type: INDEX; Schema: cadastro; Owner: -
--

CREATE UNIQUE INDEX poridusuarioorigem ON cadastro.usuario_origens_login USING btree (cd_usuario_na_origem, id_origem_login);


--
-- Name: porpapelpermissao; Type: INDEX; Schema: cadastro; Owner: -
--

CREATE UNIQUE INDEX porpapelpermissao ON cadastro.papel_permissoes USING btree (id_papel, id_permissao);


--
-- Name: porperfilpapel; Type: INDEX; Schema: cadastro; Owner: -
--

CREATE UNIQUE INDEX porperfilpapel ON cadastro.perfil_papeis USING btree (id_perfil, id_papel);


--
-- Name: porperfilpermissao; Type: INDEX; Schema: cadastro; Owner: -
--

CREATE UNIQUE INDEX porperfilpermissao ON cadastro.perfil_permissoes USING btree (id_perfil, id_permissao);


--
-- Name: porusuarioperfil; Type: INDEX; Schema: cadastro; Owner: -
--

CREATE UNIQUE INDEX porusuarioperfil ON cadastro.usuario_perfis USING btree (id_usuario_sistema, id_perfil);


--
-- Name: tentativa_integracao_por_destino; Type: INDEX; Schema: cadastro; Owner: -
--

CREATE INDEX tentativa_integracao_por_destino ON cadastro.integracao_tentativas USING btree (id_requisicao, tp_destino);


--
-- Name: tiponopais; Type: INDEX; Schema: cadastro; Owner: -
--

CREATE UNIQUE INDEX tiponopais ON cadastro.tipos_identificacao USING btree (id_pais, cd_tipo);


--
-- Name: ix_notificacao_caixa_usuario; Type: INDEX; Schema: notificacoes; Owner: -
--

CREATE INDEX ix_notificacao_caixa_usuario ON notificacoes.notificacoes USING btree (id_usuario_destino, tp_situacao, dt_entrega DESC);


--
-- Name: ix_notificacao_evento; Type: INDEX; Schema: notificacoes; Owner: -
--

CREATE INDEX ix_notificacao_evento ON notificacoes.notificacoes USING btree (id_evento);


--
-- Name: ix_notificacao_evento_etapa; Type: INDEX; Schema: notificacoes; Owner: -
--

CREATE INDEX ix_notificacao_evento_etapa ON notificacoes.eventos USING btree (id_processo_etapa) WHERE (id_processo_etapa IS NOT NULL);


--
-- Name: ix_notificacao_evento_processo; Type: INDEX; Schema: notificacoes; Owner: -
--

CREATE INDEX ix_notificacao_evento_processo ON notificacoes.eventos USING btree (id_processo, dt_evento DESC) WHERE (id_processo IS NOT NULL);


--
-- Name: ix_notificacao_evento_protocolo_versao; Type: INDEX; Schema: notificacoes; Owner: -
--

CREATE INDEX ix_notificacao_evento_protocolo_versao ON notificacoes.eventos USING btree (id_protocolo_versao) WHERE (id_protocolo_versao IS NOT NULL);


--
-- Name: ix_notificacao_nao_lida; Type: INDEX; Schema: notificacoes; Owner: -
--

CREATE INDEX ix_notificacao_nao_lida ON notificacoes.notificacoes USING btree (id_usuario_destino, dt_entrega DESC) WHERE ((dt_visualizacao IS NULL) AND (tp_situacao = ANY (ARRAY['P'::bpchar, 'I'::bpchar])));


--
-- Name: uq_notificacao_pendente_usuario_evento; Type: INDEX; Schema: notificacoes; Owner: -
--

CREATE UNIQUE INDEX uq_notificacao_pendente_usuario_evento ON notificacoes.notificacoes USING btree (id_evento, id_usuario_destino) WHERE (tp_situacao = 'P'::bpchar);


--
-- Name: codigodorecurso; Type: INDEX; Schema: processos; Owner: -
--

CREATE UNIQUE INDEX codigodorecurso ON processos.recursos_instituicao USING btree (cd_recurso);


--
-- Name: codigodorecursonoprotocolo; Type: INDEX; Schema: processos; Owner: -
--

CREATE UNIQUE INDEX codigodorecursonoprotocolo ON processos.protocolo_recursos USING btree (id_protocolo, cd_recurso);


--
-- Name: codigorecursoprotocolo; Type: INDEX; Schema: processos; Owner: -
--

CREATE UNIQUE INDEX codigorecursoprotocolo ON processos.protocolo_recursos USING btree (id_protocolo, cd_recurso);


--
-- Name: documentoporcodigo; Type: INDEX; Schema: processos; Owner: -
--

CREATE UNIQUE INDEX documentoporcodigo ON processos.protocolo_documentos USING btree (id_protocolo, cd_documento);


--
-- Name: documentoporversao; Type: INDEX; Schema: processos; Owner: -
--

CREATE UNIQUE INDEX documentoporversao ON processos.protocolo_documento_versoes USING btree (id_protocolo_documento, nr_versao);


--
-- Name: documentoversaopertencedocumento; Type: INDEX; Schema: processos; Owner: -
--

CREATE UNIQUE INDEX documentoversaopertencedocumento ON processos.protocolo_documento_versoes USING btree (id_protocolo_documento_versao, id_protocolo_documento);


--
-- Name: etapadeprocesso; Type: INDEX; Schema: processos; Owner: -
--

CREATE UNIQUE INDEX etapadeprocesso ON processos.processo_etapas USING btree (id_processo_etapa, id_processo);


--
-- Name: nomeversao; Type: INDEX; Schema: processos; Owner: -
--

CREATE UNIQUE INDEX nomeversao ON processos.protocolo_documento_html_css USING btree (id_protocolo_documento_versao, ds_nome_arquivo);


--
-- Name: numerodeprocesso; Type: INDEX; Schema: processos; Owner: -
--

CREATE UNIQUE INDEX numerodeprocesso ON processos.processos USING btree (cd_numero);


--
-- Name: ordemversao; Type: INDEX; Schema: processos; Owner: -
--

CREATE UNIQUE INDEX ordemversao ON processos.protocolo_documento_html_css USING btree (id_protocolo_documento_versao, nr_ordem);


--
-- Name: processodocumentogeracao; Type: INDEX; Schema: processos; Owner: -
--

CREATE UNIQUE INDEX processodocumentogeracao ON processos.processo_documento USING btree (id_processo, id_protocolo_documento_versao, nr_geracao);


--
-- Name: processoetapaporpassagem; Type: INDEX; Schema: processos; Owner: -
--

CREATE UNIQUE INDEX processoetapaporpassagem ON processos.processo_etapas USING btree (id_processo, id_protocolo_etapa, nr_passagem);


--
-- Name: protocoloporvariavel; Type: INDEX; Schema: processos; Owner: -
--

CREATE UNIQUE INDEX protocoloporvariavel ON processos.protocolo_versao_variaveis USING btree (id_protocolo_versao, id_variavel);


--
-- Name: protocoloporversao; Type: INDEX; Schema: processos; Owner: -
--

CREATE UNIQUE INDEX protocoloporversao ON processos.protocolo_versoes USING btree (id_protocolo, nr_versao);


--
-- Name: protocoloprefixo; Type: INDEX; Schema: processos; Owner: -
--

CREATE UNIQUE INDEX protocoloprefixo ON processos.protocolos USING btree (cd_prefixo);


--
-- Name: protocoloversaopordocumento; Type: INDEX; Schema: processos; Owner: -
--

CREATE INDEX protocoloversaopordocumento ON processos.protocolo_versao_documentos USING btree (id_protocolo_documento_versao, id_protocolo_documento);


--
-- Name: responsavelvigenteporetapa; Type: INDEX; Schema: processos; Owner: -
--

CREATE UNIQUE INDEX responsavelvigenteporetapa ON processos.processo_etapa_responsaveis USING btree (id_processo_etapa) WHERE (dt_fim IS NULL);


--
-- Name: uk_html_partes_ordem; Type: INDEX; Schema: processos; Owner: -
--

CREATE UNIQUE INDEX uk_html_partes_ordem ON processos.protocolo_documento_html_partes USING btree (id_protocolo_documento_versao, tp_parte, nr_ordem);


--
-- Name: uk_html_partes_unicas; Type: INDEX; Schema: processos; Owner: -
--

CREATE UNIQUE INDEX uk_html_partes_unicas ON processos.protocolo_documento_html_partes USING btree (id_protocolo_documento_versao, tp_parte) WHERE (tp_parte = ANY (ARRAY['A'::bpchar, 'H'::bpchar, 'F'::bpchar, 'X'::bpchar]));


--
-- Name: variaveisporversao; Type: INDEX; Schema: processos; Owner: -
--

CREATE UNIQUE INDEX variaveisporversao ON processos.protocolo_variavel_versoes USING btree (id_variavel, nr_versao);


--
-- Name: variavelatualetapaprocesso; Type: INDEX; Schema: processos; Owner: -
--

CREATE INDEX variavelatualetapaprocesso ON processos.processo_variaveis_atuais USING btree (id_processo_etapa, id_processo);


--
-- Name: variavelatualvalor; Type: INDEX; Schema: processos; Owner: -
--

CREATE INDEX variavelatualvalor ON processos.processo_variaveis_atuais USING btree (id_processo_etapa, id_variavel);


--
-- Name: variavelporprotocolo; Type: INDEX; Schema: processos; Owner: -
--

CREATE UNIQUE INDEX variavelporprotocolo ON processos.protocolo_variaveis USING btree (id_protocolo, cd_variavel);


--
-- Name: tipos_identificacao trg_impedir_alteracao_pais_tipo_em_uso; Type: TRIGGER; Schema: cadastro; Owner: -
--

CREATE TRIGGER trg_impedir_alteracao_pais_tipo_em_uso BEFORE UPDATE OF id_pais ON cadastro.tipos_identificacao FOR EACH ROW EXECUTE FUNCTION cadastro.impedir_alteracao_pais_tipo_em_uso();


--
-- Name: usuario_perfis trg_preservar_usuario_perfil; Type: TRIGGER; Schema: cadastro; Owner: -
--

CREATE TRIGGER trg_preservar_usuario_perfil BEFORE DELETE OR UPDATE ON cadastro.usuario_perfis FOR EACH ROW EXECUTE FUNCTION cadastro.preservar_usuario_perfil();


--
-- Name: chaves_webhook trg_validar_ciclo_chave_webhook; Type: TRIGGER; Schema: cadastro; Owner: -
--

CREATE TRIGGER trg_validar_ciclo_chave_webhook BEFORE INSERT OR DELETE OR UPDATE ON cadastro.chaves_webhook FOR EACH ROW EXECUTE FUNCTION cadastro.validar_ciclo_chave_webhook();


--
-- Name: pessoa_identificacoes trg_validar_pais_pessoa_identificacao; Type: TRIGGER; Schema: cadastro; Owner: -
--

CREATE TRIGGER trg_validar_pais_pessoa_identificacao BEFORE INSERT OR UPDATE OF id_tipo_identificacao, id_pais ON cadastro.pessoa_identificacoes FOR EACH ROW EXECUTE FUNCTION cadastro.validar_pais_pessoa_identificacao();


--
-- Name: papeis trg_validar_papel; Type: TRIGGER; Schema: cadastro; Owner: -
--

CREATE TRIGGER trg_validar_papel BEFORE DELETE OR UPDATE ON cadastro.papeis FOR EACH ROW EXECUTE FUNCTION cadastro.validar_papel();


--
-- Name: papel_permissoes trg_validar_papel_permissoes; Type: TRIGGER; Schema: cadastro; Owner: -
--

CREATE TRIGGER trg_validar_papel_permissoes BEFORE INSERT OR DELETE OR UPDATE ON cadastro.papel_permissoes FOR EACH ROW EXECUTE FUNCTION cadastro.validar_composicao_permissoes_sistema();


--
-- Name: perfis trg_validar_perfil; Type: TRIGGER; Schema: cadastro; Owner: -
--

CREATE TRIGGER trg_validar_perfil BEFORE DELETE OR UPDATE ON cadastro.perfis FOR EACH ROW EXECUTE FUNCTION cadastro.validar_perfil();


--
-- Name: perfil_papeis trg_validar_perfil_papel; Type: TRIGGER; Schema: cadastro; Owner: -
--

CREATE TRIGGER trg_validar_perfil_papel BEFORE INSERT OR DELETE OR UPDATE ON cadastro.perfil_papeis FOR EACH ROW EXECUTE FUNCTION cadastro.validar_perfil_papel();


--
-- Name: perfil_permissoes trg_validar_perfil_permissoes; Type: TRIGGER; Schema: cadastro; Owner: -
--

CREATE TRIGGER trg_validar_perfil_permissoes BEFORE INSERT OR DELETE OR UPDATE ON cadastro.perfil_permissoes FOR EACH ROW EXECUTE FUNCTION cadastro.validar_composicao_permissoes_sistema();


--
-- Name: arquivos trg_definir_alteracao_metadados_arquivo; Type: TRIGGER; Schema: docs; Owner: -
--

CREATE TRIGGER trg_definir_alteracao_metadados_arquivo BEFORE INSERT OR UPDATE ON docs.arquivos FOR EACH ROW EXECUTE FUNCTION docs.definir_alteracao_metadados_arquivo();


--
-- Name: arquivos trg_proteger_arquivo_pdf; Type: TRIGGER; Schema: docs; Owner: -
--

CREATE TRIGGER trg_proteger_arquivo_pdf BEFORE DELETE OR UPDATE OF id_pasta, cd_content_type, dt_lixeira, dt_exclusao ON docs.arquivos FOR EACH ROW EXECUTE FUNCTION processos.proteger_arquivo_pdf_referenciado();


--
-- Name: pastas trg_proteger_pasta_pdf; Type: TRIGGER; Schema: docs; Owner: -
--

CREATE TRIGGER trg_proteger_pasta_pdf BEFORE DELETE OR UPDATE OF id_pasta_pai, dt_lixeira, dt_exclusao ON docs.pastas FOR EACH ROW EXECUTE FUNCTION processos.proteger_pasta_pdf_referenciado();


--
-- Name: processo_etapas trg_definir_limite_etapa; Type: TRIGGER; Schema: processos; Owner: -
--

CREATE TRIGGER trg_definir_limite_etapa BEFORE INSERT ON processos.processo_etapas FOR EACH ROW EXECUTE FUNCTION processos.definir_limite_etapa();


--
-- Name: protocolo_etapa_destinatarios trg_destinatario_tags; Type: TRIGGER; Schema: processos; Owner: -
--

CREATE TRIGGER trg_destinatario_tags BEFORE INSERT OR UPDATE ON processos.protocolo_etapa_destinatarios FOR EACH ROW EXECUTE FUNCTION processos.validar_regra_participacao();


--
-- Name: protocolo_documento_html_css trg_documento_html_css_publicado; Type: TRIGGER; Schema: processos; Owner: -
--

CREATE TRIGGER trg_documento_html_css_publicado BEFORE INSERT OR DELETE OR UPDATE ON processos.protocolo_documento_html_css FOR EACH ROW EXECUTE FUNCTION processos.bloquear_definicao_publicada('documento');


--
-- Name: protocolo_documento_html_partes trg_documento_html_parte_publicada; Type: TRIGGER; Schema: processos; Owner: -
--

CREATE TRIGGER trg_documento_html_parte_publicada BEFORE INSERT OR DELETE OR UPDATE ON processos.protocolo_documento_html_partes FOR EACH ROW EXECUTE FUNCTION processos.bloquear_definicao_publicada('documento');


--
-- Name: protocolo_documentos trg_documento_identidade_publicada; Type: TRIGGER; Schema: processos; Owner: -
--

CREATE TRIGGER trg_documento_identidade_publicada BEFORE DELETE OR UPDATE ON processos.protocolo_documentos FOR EACH ROW EXECUTE FUNCTION processos.bloquear_identidade_publicada('documento');


--
-- Name: protocolo_documento_pdf_campos trg_documento_pdf_campo_publicado; Type: TRIGGER; Schema: processos; Owner: -
--

CREATE TRIGGER trg_documento_pdf_campo_publicado BEFORE INSERT OR DELETE OR UPDATE ON processos.protocolo_documento_pdf_campos FOR EACH ROW EXECUTE FUNCTION processos.bloquear_definicao_publicada('documento');


--
-- Name: protocolo_documento_pdf trg_documento_pdf_publicado; Type: TRIGGER; Schema: processos; Owner: -
--

CREATE TRIGGER trg_documento_pdf_publicado BEFORE INSERT OR DELETE OR UPDATE ON processos.protocolo_documento_pdf FOR EACH ROW EXECUTE FUNCTION processos.bloquear_definicao_publicada('documento');


--
-- Name: protocolo_documento_versoes trg_documento_versoes_publicadas; Type: TRIGGER; Schema: processos; Owner: -
--

CREATE TRIGGER trg_documento_versoes_publicadas BEFORE DELETE OR UPDATE ON processos.protocolo_documento_versoes FOR EACH ROW EXECUTE FUNCTION processos.bloquear_definicao_publicada('documento');


--
-- Name: encaminhamentos trg_encaminhamentos_publicados; Type: TRIGGER; Schema: processos; Owner: -
--

CREATE TRIGGER trg_encaminhamentos_publicados BEFORE INSERT OR DELETE OR UPDATE ON processos.encaminhamentos FOR EACH ROW EXECUTE FUNCTION processos.bloquear_definicao_publicada('direta');


--
-- Name: protocolo_etapa_destinatarios trg_etapa_destinatarios_publicados; Type: TRIGGER; Schema: processos; Owner: -
--

CREATE TRIGGER trg_etapa_destinatarios_publicados BEFORE INSERT OR DELETE OR UPDATE ON processos.protocolo_etapa_destinatarios FOR EACH ROW EXECUTE FUNCTION processos.bloquear_definicao_publicada('etapa');


--
-- Name: protocolos_etapas trg_etapas_publicadas; Type: TRIGGER; Schema: processos; Owner: -
--

CREATE TRIGGER trg_etapas_publicadas BEFORE INSERT OR DELETE OR UPDATE ON processos.protocolos_etapas FOR EACH ROW EXECUTE FUNCTION processos.bloquear_definicao_publicada('direta');


--
-- Name: formulario_variaveis trg_formulario_variaveis_publicadas; Type: TRIGGER; Schema: processos; Owner: -
--

CREATE TRIGGER trg_formulario_variaveis_publicadas BEFORE INSERT OR DELETE OR UPDATE ON processos.formulario_variaveis FOR EACH ROW EXECUTE FUNCTION processos.bloquear_definicao_publicada('formulario');


--
-- Name: formularios trg_formularios_publicados; Type: TRIGGER; Schema: processos; Owner: -
--

CREATE TRIGGER trg_formularios_publicados BEFORE INSERT OR DELETE OR UPDATE ON processos.formularios FOR EACH ROW EXECUTE FUNCTION processos.bloquear_definicao_publicada('direta');


--
-- Name: protocolo_gestores_elegiveis trg_gestor_elegivel_tags; Type: TRIGGER; Schema: processos; Owner: -
--

CREATE TRIGGER trg_gestor_elegivel_tags BEFORE INSERT OR UPDATE ON processos.protocolo_gestores_elegiveis FOR EACH ROW EXECUTE FUNCTION processos.validar_regra_participacao();


--
-- Name: protocolo_gestores_elegiveis trg_gestores_elegiveis_publicados; Type: TRIGGER; Schema: processos; Owner: -
--

CREATE TRIGGER trg_gestores_elegiveis_publicados BEFORE INSERT OR DELETE OR UPDATE ON processos.protocolo_gestores_elegiveis FOR EACH ROW EXECUTE FUNCTION processos.bloquear_definicao_publicada('direta');


--
-- Name: processos trg_numerar_processo; Type: TRIGGER; Schema: processos; Owner: -
--

CREATE TRIGGER trg_numerar_processo BEFORE INSERT OR UPDATE OF cd_numero ON processos.processos FOR EACH ROW EXECUTE FUNCTION processos.numerar_processo();


--
-- Name: processo_etapas trg_responsavel_vigente_etapa; Type: TRIGGER; Schema: processos; Owner: -
--

CREATE CONSTRAINT TRIGGER trg_responsavel_vigente_etapa AFTER INSERT OR DELETE OR UPDATE ON processos.processo_etapas DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION processos.validar_responsavel_vigente();


--
-- Name: processo_etapa_responsaveis trg_responsavel_vigente_historico; Type: TRIGGER; Schema: processos; Owner: -
--

CREATE CONSTRAINT TRIGGER trg_responsavel_vigente_historico AFTER INSERT OR DELETE OR UPDATE ON processos.processo_etapa_responsaveis DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION processos.validar_responsavel_vigente();


--
-- Name: encaminhamentos trg_validar_encaminhamento; Type: TRIGGER; Schema: processos; Owner: -
--

CREATE TRIGGER trg_validar_encaminhamento BEFORE INSERT OR UPDATE ON processos.encaminhamentos FOR EACH ROW EXECUTE FUNCTION processos.validar_encaminhamento();


--
-- Name: protocolos_etapas trg_validar_etapa_formulario; Type: TRIGGER; Schema: processos; Owner: -
--

CREATE TRIGGER trg_validar_etapa_formulario BEFORE INSERT OR UPDATE ON processos.protocolos_etapas FOR EACH ROW EXECUTE FUNCTION processos.validar_etapa_formulario();


--
-- Name: formulario_variaveis trg_validar_formulario_variavel; Type: TRIGGER; Schema: processos; Owner: -
--

CREATE TRIGGER trg_validar_formulario_variavel BEFORE INSERT OR UPDATE ON processos.formulario_variaveis FOR EACH ROW EXECUTE FUNCTION processos.validar_formulario_variavel();


--
-- Name: processo_etapa_encaminhamentos trg_validar_passagem_encaminhamento; Type: TRIGGER; Schema: processos; Owner: -
--

CREATE TRIGGER trg_validar_passagem_encaminhamento BEFORE INSERT OR UPDATE ON processos.processo_etapa_encaminhamentos FOR EACH ROW EXECUTE FUNCTION processos.validar_passagem_encaminhamento();


--
-- Name: protocolo_documento_pdf_campos trg_validar_pdf_campo; Type: TRIGGER; Schema: processos; Owner: -
--

CREATE TRIGGER trg_validar_pdf_campo BEFORE INSERT OR UPDATE ON processos.protocolo_documento_pdf_campos FOR EACH ROW EXECUTE FUNCTION processos.validar_pdf_campo();


--
-- Name: protocolo_documento_pdf trg_validar_pdf_protocolo; Type: TRIGGER; Schema: processos; Owner: -
--

CREATE TRIGGER trg_validar_pdf_protocolo BEFORE INSERT OR UPDATE ON processos.protocolo_documento_pdf FOR EACH ROW EXECUTE FUNCTION processos.validar_pdf_protocolo();


--
-- Name: processo_documento trg_validar_processo_documento; Type: TRIGGER; Schema: processos; Owner: -
--

CREATE TRIGGER trg_validar_processo_documento BEFORE INSERT OR UPDATE ON processos.processo_documento FOR EACH ROW EXECUTE FUNCTION processos.validar_processo_documento();


--
-- Name: processo_etapas trg_validar_processo_etapa; Type: TRIGGER; Schema: processos; Owner: -
--

CREATE TRIGGER trg_validar_processo_etapa BEFORE INSERT OR UPDATE ON processos.processo_etapas FOR EACH ROW EXECUTE FUNCTION processos.validar_processo_etapa();


--
-- Name: processos trg_validar_processo_protocolo; Type: TRIGGER; Schema: processos; Owner: -
--

CREATE TRIGGER trg_validar_processo_protocolo BEFORE INSERT OR UPDATE OF id_protocolo_versao ON processos.processos FOR EACH ROW EXECUTE FUNCTION processos.validar_processo_protocolo();


--
-- Name: protocolo_versao_documentos trg_validar_versao_documento; Type: TRIGGER; Schema: processos; Owner: -
--

CREATE TRIGGER trg_validar_versao_documento BEFORE INSERT OR UPDATE ON processos.protocolo_versao_documentos FOR EACH ROW EXECUTE FUNCTION processos.validar_versao_documento();


--
-- Name: protocolo_versoes trg_validar_versao_protocolo; Type: TRIGGER; Schema: processos; Owner: -
--

CREATE TRIGGER trg_validar_versao_protocolo BEFORE INSERT OR DELETE OR UPDATE ON processos.protocolo_versoes FOR EACH ROW EXECUTE FUNCTION processos.validar_versao_protocolo();


--
-- Name: protocolo_versao_variaveis trg_validar_versao_variavel; Type: TRIGGER; Schema: processos; Owner: -
--

CREATE TRIGGER trg_validar_versao_variavel BEFORE INSERT OR UPDATE ON processos.protocolo_versao_variaveis FOR EACH ROW EXECUTE FUNCTION processos.validar_versao_variavel();


--
-- Name: protocolo_variaveis trg_variavel_identidade_publicada; Type: TRIGGER; Schema: processos; Owner: -
--

CREATE TRIGGER trg_variavel_identidade_publicada BEFORE DELETE OR UPDATE ON processos.protocolo_variaveis FOR EACH ROW EXECUTE FUNCTION processos.bloquear_identidade_publicada('variavel');


--
-- Name: protocolo_variavel_versoes trg_variavel_versoes_publicadas; Type: TRIGGER; Schema: processos; Owner: -
--

CREATE TRIGGER trg_variavel_versoes_publicadas BEFORE INSERT OR DELETE OR UPDATE ON processos.protocolo_variavel_versoes FOR EACH ROW EXECUTE FUNCTION processos.bloquear_definicao_publicada('variavel');


--
-- Name: protocolo_versao_documentos trg_versao_documentos_publicados; Type: TRIGGER; Schema: processos; Owner: -
--

CREATE TRIGGER trg_versao_documentos_publicados BEFORE INSERT OR DELETE OR UPDATE ON processos.protocolo_versao_documentos FOR EACH ROW EXECUTE FUNCTION processos.bloquear_definicao_publicada('direta');


--
-- Name: protocolo_versao_variaveis trg_versao_variaveis_publicadas; Type: TRIGGER; Schema: processos; Owner: -
--

CREATE TRIGGER trg_versao_variaveis_publicadas BEFORE INSERT OR DELETE OR UPDATE ON processos.protocolo_versao_variaveis FOR EACH ROW EXECUTE FUNCTION processos.bloquear_definicao_publicada('direta');


--
-- Name: confirmacoes_email confirmacoes_email_id_usuario_sistema_fkey; Type: FK CONSTRAINT; Schema: cadastro; Owner: -
--

ALTER TABLE ONLY cadastro.confirmacoes_email
    ADD CONSTRAINT confirmacoes_email_id_usuario_sistema_fkey FOREIGN KEY (id_usuario_sistema) REFERENCES cadastro.usuarios_sistema(id_usuario_sistema) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: chaves_webhook fk_chave_webhook_usuario_inclusao; Type: FK CONSTRAINT; Schema: cadastro; Owner: -
--

ALTER TABLE ONLY cadastro.chaves_webhook
    ADD CONSTRAINT fk_chave_webhook_usuario_inclusao FOREIGN KEY (id_usuario_inclusao) REFERENCES cadastro.usuarios_sistema(id_usuario_sistema) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: chaves_webhook fk_chave_webhook_usuario_invalidacao; Type: FK CONSTRAINT; Schema: cadastro; Owner: -
--

ALTER TABLE ONLY cadastro.chaves_webhook
    ADD CONSTRAINT fk_chave_webhook_usuario_invalidacao FOREIGN KEY (id_usuario_invalidacao) REFERENCES cadastro.usuarios_sistema(id_usuario_sistema) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: instituicao fk_instituicao_pasta_recursos; Type: FK CONSTRAINT; Schema: cadastro; Owner: -
--

ALTER TABLE ONLY cadastro.instituicao
    ADD CONSTRAINT fk_instituicao_pasta_recursos FOREIGN KEY (id_pasta) REFERENCES docs.pastas(id_pasta) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: integracao_consultas fk_integracao_consulta_processo; Type: FK CONSTRAINT; Schema: cadastro; Owner: -
--

ALTER TABLE ONLY cadastro.integracao_consultas
    ADD CONSTRAINT fk_integracao_consulta_processo FOREIGN KEY (id_processo) REFERENCES processos.processos(id_processo) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: integracao_consultas fk_integracao_consulta_protocolo; Type: FK CONSTRAINT; Schema: cadastro; Owner: -
--

ALTER TABLE ONLY cadastro.integracao_consultas
    ADD CONSTRAINT fk_integracao_consulta_protocolo FOREIGN KEY (id_protocolo) REFERENCES processos.protocolos(id_protocolo) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: integracao_consultas fk_integracao_consulta_usuario; Type: FK CONSTRAINT; Schema: cadastro; Owner: -
--

ALTER TABLE ONLY cadastro.integracao_consultas
    ADD CONSTRAINT fk_integracao_consulta_usuario FOREIGN KEY (id_usuario_origem) REFERENCES cadastro.usuarios_sistema(id_usuario_sistema) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: integracao_tentativas fk_integracao_tentativa_chave; Type: FK CONSTRAINT; Schema: cadastro; Owner: -
--

ALTER TABLE ONLY cadastro.integracao_tentativas
    ADD CONSTRAINT fk_integracao_tentativa_chave FOREIGN KEY (id_webhook) REFERENCES cadastro.chaves_webhook(id_webhook) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: integracao_tentativas fk_integracao_tentativa_consulta; Type: FK CONSTRAINT; Schema: cadastro; Owner: -
--

ALTER TABLE ONLY cadastro.integracao_tentativas
    ADD CONSTRAINT fk_integracao_tentativa_consulta FOREIGN KEY (id_requisicao) REFERENCES cadastro.integracao_consultas(id_requisicao) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: recursos_instituicao fk_recurso_instituicao; Type: FK CONSTRAINT; Schema: cadastro; Owner: -
--

ALTER TABLE ONLY cadastro.recursos_instituicao
    ADD CONSTRAINT fk_recurso_instituicao FOREIGN KEY (id_instituicao) REFERENCES cadastro.instituicao(id_instituicao) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: recursos_instituicao fk_recurso_instituicao_arquivo; Type: FK CONSTRAINT; Schema: cadastro; Owner: -
--

ALTER TABLE ONLY cadastro.recursos_instituicao
    ADD CONSTRAINT fk_recurso_instituicao_arquivo FOREIGN KEY (id_arquivo_versao) REFERENCES docs.arquivo_versoes(id_arquivo_versao) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: grupo_tags grupo_tags_cd_tag_fkey; Type: FK CONSTRAINT; Schema: cadastro; Owner: -
--

ALTER TABLE ONLY cadastro.grupo_tags
    ADD CONSTRAINT grupo_tags_cd_tag_fkey FOREIGN KEY (cd_tag) REFERENCES cadastro.tags(cd_tag) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: grupo_tags grupo_tags_id_grupo_fkey; Type: FK CONSTRAINT; Schema: cadastro; Owner: -
--

ALTER TABLE ONLY cadastro.grupo_tags
    ADD CONSTRAINT grupo_tags_id_grupo_fkey FOREIGN KEY (id_grupo) REFERENCES cadastro.grupos(id_grupo) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: historico_logins historico_logins_id_usuario_origem_login_fkey; Type: FK CONSTRAINT; Schema: cadastro; Owner: -
--

ALTER TABLE ONLY cadastro.historico_logins
    ADD CONSTRAINT historico_logins_id_usuario_origem_login_fkey FOREIGN KEY (id_usuario_origem_login) REFERENCES cadastro.usuario_origens_login(id_usuario_origem_login) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: papel_permissoes papel_permissoes_id_papel_fkey; Type: FK CONSTRAINT; Schema: cadastro; Owner: -
--

ALTER TABLE ONLY cadastro.papel_permissoes
    ADD CONSTRAINT papel_permissoes_id_papel_fkey FOREIGN KEY (id_papel) REFERENCES cadastro.papeis(id_papel) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: papel_permissoes papel_permissoes_id_permissao_fkey; Type: FK CONSTRAINT; Schema: cadastro; Owner: -
--

ALTER TABLE ONLY cadastro.papel_permissoes
    ADD CONSTRAINT papel_permissoes_id_permissao_fkey FOREIGN KEY (id_permissao) REFERENCES cadastro.permissoes(id_permissao) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: perfil_papeis perfil_papeis_id_papel_fkey; Type: FK CONSTRAINT; Schema: cadastro; Owner: -
--

ALTER TABLE ONLY cadastro.perfil_papeis
    ADD CONSTRAINT perfil_papeis_id_papel_fkey FOREIGN KEY (id_papel) REFERENCES cadastro.papeis(id_papel) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: perfil_papeis perfil_papeis_id_perfil_fkey; Type: FK CONSTRAINT; Schema: cadastro; Owner: -
--

ALTER TABLE ONLY cadastro.perfil_papeis
    ADD CONSTRAINT perfil_papeis_id_perfil_fkey FOREIGN KEY (id_perfil) REFERENCES cadastro.perfis(id_perfil) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: perfil_permissoes perfil_permissoes_id_perfil_fkey; Type: FK CONSTRAINT; Schema: cadastro; Owner: -
--

ALTER TABLE ONLY cadastro.perfil_permissoes
    ADD CONSTRAINT perfil_permissoes_id_perfil_fkey FOREIGN KEY (id_perfil) REFERENCES cadastro.perfis(id_perfil) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: perfil_permissoes perfil_permissoes_id_permissao_fkey; Type: FK CONSTRAINT; Schema: cadastro; Owner: -
--

ALTER TABLE ONLY cadastro.perfil_permissoes
    ADD CONSTRAINT perfil_permissoes_id_permissao_fkey FOREIGN KEY (id_permissao) REFERENCES cadastro.permissoes(id_permissao) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: permissoes permissoes_id_programa_fkey; Type: FK CONSTRAINT; Schema: cadastro; Owner: -
--

ALTER TABLE ONLY cadastro.permissoes
    ADD CONSTRAINT permissoes_id_programa_fkey FOREIGN KEY (id_programa) REFERENCES cadastro.programas(id_programa) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: pessoa_identificacoes pessoa_identificacoes_id_pais_fkey; Type: FK CONSTRAINT; Schema: cadastro; Owner: -
--

ALTER TABLE ONLY cadastro.pessoa_identificacoes
    ADD CONSTRAINT pessoa_identificacoes_id_pais_fkey FOREIGN KEY (id_pais) REFERENCES cadastro.paises(id_pais) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: pessoa_identificacoes pessoa_identificacoes_id_pessoa_fkey; Type: FK CONSTRAINT; Schema: cadastro; Owner: -
--

ALTER TABLE ONLY cadastro.pessoa_identificacoes
    ADD CONSTRAINT pessoa_identificacoes_id_pessoa_fkey FOREIGN KEY (id_pessoa) REFERENCES cadastro.pessoas(id_pessoa) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: pessoa_identificacoes pessoa_identificacoes_id_tipo_identificacao_fkey; Type: FK CONSTRAINT; Schema: cadastro; Owner: -
--

ALTER TABLE ONLY cadastro.pessoa_identificacoes
    ADD CONSTRAINT pessoa_identificacoes_id_tipo_identificacao_fkey FOREIGN KEY (id_tipo_identificacao) REFERENCES cadastro.tipos_identificacao(id_tipo_identificacao) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: pessoa_nacionalidades pessoa_nacionalidades_id_pais_fkey; Type: FK CONSTRAINT; Schema: cadastro; Owner: -
--

ALTER TABLE ONLY cadastro.pessoa_nacionalidades
    ADD CONSTRAINT pessoa_nacionalidades_id_pais_fkey FOREIGN KEY (id_pais) REFERENCES cadastro.paises(id_pais) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: pessoa_nacionalidades pessoa_nacionalidades_id_pessoa_fkey; Type: FK CONSTRAINT; Schema: cadastro; Owner: -
--

ALTER TABLE ONLY cadastro.pessoa_nacionalidades
    ADD CONSTRAINT pessoa_nacionalidades_id_pessoa_fkey FOREIGN KEY (id_pessoa) REFERENCES cadastro.pessoas(id_pessoa) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: programas programas_id_programa_pai_fkey; Type: FK CONSTRAINT; Schema: cadastro; Owner: -
--

ALTER TABLE ONLY cadastro.programas
    ADD CONSTRAINT programas_id_programa_pai_fkey FOREIGN KEY (id_programa_pai) REFERENCES cadastro.programas(id_programa) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: tipos_identificacao tipos_identificacao_id_pais_fkey; Type: FK CONSTRAINT; Schema: cadastro; Owner: -
--

ALTER TABLE ONLY cadastro.tipos_identificacao
    ADD CONSTRAINT tipos_identificacao_id_pais_fkey FOREIGN KEY (id_pais) REFERENCES cadastro.paises(id_pais) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: usuario_grupos usuario_grupos_id_grupo_fkey; Type: FK CONSTRAINT; Schema: cadastro; Owner: -
--

ALTER TABLE ONLY cadastro.usuario_grupos
    ADD CONSTRAINT usuario_grupos_id_grupo_fkey FOREIGN KEY (id_grupo) REFERENCES cadastro.grupos(id_grupo) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: usuario_grupos usuario_grupos_id_usuario_sistema_fkey; Type: FK CONSTRAINT; Schema: cadastro; Owner: -
--

ALTER TABLE ONLY cadastro.usuario_grupos
    ADD CONSTRAINT usuario_grupos_id_usuario_sistema_fkey FOREIGN KEY (id_usuario_sistema) REFERENCES cadastro.usuarios_sistema(id_usuario_sistema) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: usuario_origens_login usuario_origens_login_id_origem_login_fkey; Type: FK CONSTRAINT; Schema: cadastro; Owner: -
--

ALTER TABLE ONLY cadastro.usuario_origens_login
    ADD CONSTRAINT usuario_origens_login_id_origem_login_fkey FOREIGN KEY (id_origem_login) REFERENCES cadastro.origens_login(id_origem_login) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: usuario_origens_login usuario_origens_login_id_usuario_sistema_fkey; Type: FK CONSTRAINT; Schema: cadastro; Owner: -
--

ALTER TABLE ONLY cadastro.usuario_origens_login
    ADD CONSTRAINT usuario_origens_login_id_usuario_sistema_fkey FOREIGN KEY (id_usuario_sistema) REFERENCES cadastro.usuarios_sistema(id_usuario_sistema) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: usuario_perfis usuario_perfis_id_perfil_fkey; Type: FK CONSTRAINT; Schema: cadastro; Owner: -
--

ALTER TABLE ONLY cadastro.usuario_perfis
    ADD CONSTRAINT usuario_perfis_id_perfil_fkey FOREIGN KEY (id_perfil) REFERENCES cadastro.perfis(id_perfil) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: usuario_perfis usuario_perfis_id_usuario_sistema_fkey; Type: FK CONSTRAINT; Schema: cadastro; Owner: -
--

ALTER TABLE ONLY cadastro.usuario_perfis
    ADD CONSTRAINT usuario_perfis_id_usuario_sistema_fkey FOREIGN KEY (id_usuario_sistema) REFERENCES cadastro.usuarios_sistema(id_usuario_sistema) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: usuario_tags usuario_tags_cd_tag_fkey; Type: FK CONSTRAINT; Schema: cadastro; Owner: -
--

ALTER TABLE ONLY cadastro.usuario_tags
    ADD CONSTRAINT usuario_tags_cd_tag_fkey FOREIGN KEY (cd_tag) REFERENCES cadastro.tags(cd_tag) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: usuario_tags usuario_tags_id_usuario_sistema_fkey; Type: FK CONSTRAINT; Schema: cadastro; Owner: -
--

ALTER TABLE ONLY cadastro.usuario_tags
    ADD CONSTRAINT usuario_tags_id_usuario_sistema_fkey FOREIGN KEY (id_usuario_sistema) REFERENCES cadastro.usuarios_sistema(id_usuario_sistema) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: usuarios_sistema usuarios_sistema_id_pessoa_fkey; Type: FK CONSTRAINT; Schema: cadastro; Owner: -
--

ALTER TABLE ONLY cadastro.usuarios_sistema
    ADD CONSTRAINT usuarios_sistema_id_pessoa_fkey FOREIGN KEY (id_pessoa) REFERENCES cadastro.pessoas(id_pessoa) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: variaveis_instituicao variaveis_instituicao_id_atributo_pai_fkey; Type: FK CONSTRAINT; Schema: cadastro; Owner: -
--

ALTER TABLE ONLY cadastro.variaveis_instituicao
    ADD CONSTRAINT variaveis_instituicao_id_atributo_pai_fkey FOREIGN KEY (id_atributo_pai) REFERENCES cadastro.variaveis_instituicao(id_atributo) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: vinculo_tags vinculo_tags_cd_tag_fkey; Type: FK CONSTRAINT; Schema: cadastro; Owner: -
--

ALTER TABLE ONLY cadastro.vinculo_tags
    ADD CONSTRAINT vinculo_tags_cd_tag_fkey FOREIGN KEY (cd_tag) REFERENCES cadastro.tags(cd_tag) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: vinculo_tags vinculo_tags_id_usuario_sistema_id_grupo_fkey; Type: FK CONSTRAINT; Schema: cadastro; Owner: -
--

ALTER TABLE ONLY cadastro.vinculo_tags
    ADD CONSTRAINT vinculo_tags_id_usuario_sistema_id_grupo_fkey FOREIGN KEY (id_usuario_sistema, id_grupo) REFERENCES cadastro.usuario_grupos(id_usuario_sistema, id_grupo) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: arquivo_permissoes arquivo_permissoes_id_arquivo_fkey; Type: FK CONSTRAINT; Schema: docs; Owner: -
--

ALTER TABLE ONLY docs.arquivo_permissoes
    ADD CONSTRAINT arquivo_permissoes_id_arquivo_fkey FOREIGN KEY (id_arquivo) REFERENCES docs.arquivos(id_arquivo) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: arquivo_permissoes arquivo_permissoes_id_usuario_concedeu_fkey; Type: FK CONSTRAINT; Schema: docs; Owner: -
--

ALTER TABLE ONLY docs.arquivo_permissoes
    ADD CONSTRAINT arquivo_permissoes_id_usuario_concedeu_fkey FOREIGN KEY (id_usuario_concedeu) REFERENCES cadastro.usuarios_sistema(id_usuario_sistema) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: arquivo_permissoes arquivo_permissoes_id_usuario_revogou_fkey; Type: FK CONSTRAINT; Schema: docs; Owner: -
--

ALTER TABLE ONLY docs.arquivo_permissoes
    ADD CONSTRAINT arquivo_permissoes_id_usuario_revogou_fkey FOREIGN KEY (id_usuario_revogou) REFERENCES cadastro.usuarios_sistema(id_usuario_sistema) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: arquivo_permissoes arquivo_permissoes_id_usuario_sistema_fkey; Type: FK CONSTRAINT; Schema: docs; Owner: -
--

ALTER TABLE ONLY docs.arquivo_permissoes
    ADD CONSTRAINT arquivo_permissoes_id_usuario_sistema_fkey FOREIGN KEY (id_usuario_sistema) REFERENCES cadastro.usuarios_sistema(id_usuario_sistema) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: arquivo_tags arquivo_tags_cd_tag_fkey; Type: FK CONSTRAINT; Schema: docs; Owner: -
--

ALTER TABLE ONLY docs.arquivo_tags
    ADD CONSTRAINT arquivo_tags_cd_tag_fkey FOREIGN KEY (cd_tag) REFERENCES docs.tags_arquivo(cd_tag) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: arquivo_tags arquivo_tags_id_arquivo_fkey; Type: FK CONSTRAINT; Schema: docs; Owner: -
--

ALTER TABLE ONLY docs.arquivo_tags
    ADD CONSTRAINT arquivo_tags_id_arquivo_fkey FOREIGN KEY (id_arquivo) REFERENCES docs.arquivos(id_arquivo) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: arquivo_tags arquivo_tags_id_usuario_associou_fkey; Type: FK CONSTRAINT; Schema: docs; Owner: -
--

ALTER TABLE ONLY docs.arquivo_tags
    ADD CONSTRAINT arquivo_tags_id_usuario_associou_fkey FOREIGN KEY (id_usuario_associou) REFERENCES cadastro.usuarios_sistema(id_usuario_sistema) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: arquivo_tags arquivo_tags_id_usuario_removeu_fkey; Type: FK CONSTRAINT; Schema: docs; Owner: -
--

ALTER TABLE ONLY docs.arquivo_tags
    ADD CONSTRAINT arquivo_tags_id_usuario_removeu_fkey FOREIGN KEY (id_usuario_removeu) REFERENCES cadastro.usuarios_sistema(id_usuario_sistema) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: arquivo_versoes arquivo_versoes_id_arquivo_fkey; Type: FK CONSTRAINT; Schema: docs; Owner: -
--

ALTER TABLE ONLY docs.arquivo_versoes
    ADD CONSTRAINT arquivo_versoes_id_arquivo_fkey FOREIGN KEY (id_arquivo) REFERENCES docs.arquivos(id_arquivo) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: arquivo_versoes arquivo_versoes_id_usuario_incluiu_fkey; Type: FK CONSTRAINT; Schema: docs; Owner: -
--

ALTER TABLE ONLY docs.arquivo_versoes
    ADD CONSTRAINT arquivo_versoes_id_usuario_incluiu_fkey FOREIGN KEY (id_usuario_incluiu) REFERENCES cadastro.usuarios_sistema(id_usuario_sistema) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: arquivos_atributos arquivos_atributos_id_arquivo_fkey; Type: FK CONSTRAINT; Schema: docs; Owner: -
--

ALTER TABLE ONLY docs.arquivos_atributos
    ADD CONSTRAINT arquivos_atributos_id_arquivo_fkey FOREIGN KEY (id_arquivo) REFERENCES docs.arquivos(id_arquivo) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: arquivos_atributos arquivos_atributos_id_atributo_fkey; Type: FK CONSTRAINT; Schema: docs; Owner: -
--

ALTER TABLE ONLY docs.arquivos_atributos
    ADD CONSTRAINT arquivos_atributos_id_atributo_fkey FOREIGN KEY (id_atributo) REFERENCES docs.atributos(id_atributo) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: arquivos_atributos arquivos_atributos_id_atributo_valor_fkey; Type: FK CONSTRAINT; Schema: docs; Owner: -
--

ALTER TABLE ONLY docs.arquivos_atributos
    ADD CONSTRAINT arquivos_atributos_id_atributo_valor_fkey FOREIGN KEY (id_atributo_valor) REFERENCES docs.atributo_valores(id_atributo_valor) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: arquivos_atributos arquivos_atributos_id_usuario_alterou_fkey; Type: FK CONSTRAINT; Schema: docs; Owner: -
--

ALTER TABLE ONLY docs.arquivos_atributos
    ADD CONSTRAINT arquivos_atributos_id_usuario_alterou_fkey FOREIGN KEY (id_usuario_alterou) REFERENCES cadastro.usuarios_sistema(id_usuario_sistema) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: arquivos arquivos_id_pasta_fkey; Type: FK CONSTRAINT; Schema: docs; Owner: -
--

ALTER TABLE ONLY docs.arquivos
    ADD CONSTRAINT arquivos_id_pasta_fkey FOREIGN KEY (id_pasta) REFERENCES docs.pastas(id_pasta) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: atributo_valores atributo_valores_id_atributo_fkey; Type: FK CONSTRAINT; Schema: docs; Owner: -
--

ALTER TABLE ONLY docs.atributo_valores
    ADD CONSTRAINT atributo_valores_id_atributo_fkey FOREIGN KEY (id_atributo) REFERENCES docs.atributos(id_atributo) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: atributos atributos_id_usuario_criou_fkey; Type: FK CONSTRAINT; Schema: docs; Owner: -
--

ALTER TABLE ONLY docs.atributos
    ADD CONSTRAINT atributos_id_usuario_criou_fkey FOREIGN KEY (id_usuario_criou) REFERENCES cadastro.usuarios_sistema(id_usuario_sistema) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: pasta_gestores pasta_gestores_id_pasta_fkey; Type: FK CONSTRAINT; Schema: docs; Owner: -
--

ALTER TABLE ONLY docs.pasta_gestores
    ADD CONSTRAINT pasta_gestores_id_pasta_fkey FOREIGN KEY (id_pasta) REFERENCES docs.pastas(id_pasta) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: pasta_gestores pasta_gestores_id_usuario_nomeou_fkey; Type: FK CONSTRAINT; Schema: docs; Owner: -
--

ALTER TABLE ONLY docs.pasta_gestores
    ADD CONSTRAINT pasta_gestores_id_usuario_nomeou_fkey FOREIGN KEY (id_usuario_nomeou) REFERENCES cadastro.usuarios_sistema(id_usuario_sistema) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: pasta_gestores pasta_gestores_id_usuario_revogou_fkey; Type: FK CONSTRAINT; Schema: docs; Owner: -
--

ALTER TABLE ONLY docs.pasta_gestores
    ADD CONSTRAINT pasta_gestores_id_usuario_revogou_fkey FOREIGN KEY (id_usuario_revogou) REFERENCES cadastro.usuarios_sistema(id_usuario_sistema) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: pasta_gestores pasta_gestores_id_usuario_sistema_fkey; Type: FK CONSTRAINT; Schema: docs; Owner: -
--

ALTER TABLE ONLY docs.pasta_gestores
    ADD CONSTRAINT pasta_gestores_id_usuario_sistema_fkey FOREIGN KEY (id_usuario_sistema) REFERENCES cadastro.usuarios_sistema(id_usuario_sistema) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: pasta_permissoes pasta_permissoes_cd_tag_fkey; Type: FK CONSTRAINT; Schema: docs; Owner: -
--

ALTER TABLE ONLY docs.pasta_permissoes
    ADD CONSTRAINT pasta_permissoes_cd_tag_fkey FOREIGN KEY (cd_tag) REFERENCES cadastro.tags(cd_tag) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: pasta_permissoes pasta_permissoes_id_grupo_fkey; Type: FK CONSTRAINT; Schema: docs; Owner: -
--

ALTER TABLE ONLY docs.pasta_permissoes
    ADD CONSTRAINT pasta_permissoes_id_grupo_fkey FOREIGN KEY (id_grupo) REFERENCES cadastro.grupos(id_grupo) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: pasta_permissoes pasta_permissoes_id_pasta_fkey; Type: FK CONSTRAINT; Schema: docs; Owner: -
--

ALTER TABLE ONLY docs.pasta_permissoes
    ADD CONSTRAINT pasta_permissoes_id_pasta_fkey FOREIGN KEY (id_pasta) REFERENCES docs.pastas(id_pasta) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: pasta_permissoes pasta_permissoes_id_usuario_concedeu_fkey; Type: FK CONSTRAINT; Schema: docs; Owner: -
--

ALTER TABLE ONLY docs.pasta_permissoes
    ADD CONSTRAINT pasta_permissoes_id_usuario_concedeu_fkey FOREIGN KEY (id_usuario_concedeu) REFERENCES cadastro.usuarios_sistema(id_usuario_sistema) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: pasta_permissoes pasta_permissoes_id_usuario_revogou_fkey; Type: FK CONSTRAINT; Schema: docs; Owner: -
--

ALTER TABLE ONLY docs.pasta_permissoes
    ADD CONSTRAINT pasta_permissoes_id_usuario_revogou_fkey FOREIGN KEY (id_usuario_revogou) REFERENCES cadastro.usuarios_sistema(id_usuario_sistema) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: pasta_permissoes pasta_permissoes_id_usuario_sistema_fkey; Type: FK CONSTRAINT; Schema: docs; Owner: -
--

ALTER TABLE ONLY docs.pasta_permissoes
    ADD CONSTRAINT pasta_permissoes_id_usuario_sistema_fkey FOREIGN KEY (id_usuario_sistema) REFERENCES cadastro.usuarios_sistema(id_usuario_sistema) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: pastas pastas_id_pasta_pai_fkey; Type: FK CONSTRAINT; Schema: docs; Owner: -
--

ALTER TABLE ONLY docs.pastas
    ADD CONSTRAINT pastas_id_pasta_pai_fkey FOREIGN KEY (id_pasta_pai) REFERENCES docs.pastas(id_pasta) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: pastas pastas_id_usuario_criou_fkey; Type: FK CONSTRAINT; Schema: docs; Owner: -
--

ALTER TABLE ONLY docs.pastas
    ADD CONSTRAINT pastas_id_usuario_criou_fkey FOREIGN KEY (id_usuario_criou) REFERENCES cadastro.usuarios_sistema(id_usuario_sistema) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: notificacoes fk_notificacao_evento; Type: FK CONSTRAINT; Schema: notificacoes; Owner: -
--

ALTER TABLE ONLY notificacoes.notificacoes
    ADD CONSTRAINT fk_notificacao_evento FOREIGN KEY (id_evento) REFERENCES notificacoes.eventos(id_evento) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: eventos fk_notificacao_evento_etapa_processo; Type: FK CONSTRAINT; Schema: notificacoes; Owner: -
--

ALTER TABLE ONLY notificacoes.eventos
    ADD CONSTRAINT fk_notificacao_evento_etapa_processo FOREIGN KEY (id_processo_etapa, id_processo) REFERENCES processos.processo_etapas(id_processo_etapa, id_processo) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: eventos fk_notificacao_evento_processo; Type: FK CONSTRAINT; Schema: notificacoes; Owner: -
--

ALTER TABLE ONLY notificacoes.eventos
    ADD CONSTRAINT fk_notificacao_evento_processo FOREIGN KEY (id_processo) REFERENCES processos.processos(id_processo) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: eventos fk_notificacao_evento_protocolo_versao; Type: FK CONSTRAINT; Schema: notificacoes; Owner: -
--

ALTER TABLE ONLY notificacoes.eventos
    ADD CONSTRAINT fk_notificacao_evento_protocolo_versao FOREIGN KEY (id_protocolo_versao) REFERENCES processos.protocolo_versoes(id_protocolo_versao) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: eventos fk_notificacao_evento_usuario_ator; Type: FK CONSTRAINT; Schema: notificacoes; Owner: -
--

ALTER TABLE ONLY notificacoes.eventos
    ADD CONSTRAINT fk_notificacao_evento_usuario_ator FOREIGN KEY (id_usuario_ator) REFERENCES cadastro.usuarios_sistema(id_usuario_sistema) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: notificacoes fk_notificacao_usuario_atendeu; Type: FK CONSTRAINT; Schema: notificacoes; Owner: -
--

ALTER TABLE ONLY notificacoes.notificacoes
    ADD CONSTRAINT fk_notificacao_usuario_atendeu FOREIGN KEY (id_usuario_atendeu) REFERENCES cadastro.usuarios_sistema(id_usuario_sistema) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: notificacoes fk_notificacao_usuario_destino; Type: FK CONSTRAINT; Schema: notificacoes; Owner: -
--

ALTER TABLE ONLY notificacoes.notificacoes
    ADD CONSTRAINT fk_notificacao_usuario_destino FOREIGN KEY (id_usuario_destino) REFERENCES cadastro.usuarios_sistema(id_usuario_sistema) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: encaminhamentos encaminhamentos_id_protocolo_versao_fkey; Type: FK CONSTRAINT; Schema: processos; Owner: -
--

ALTER TABLE ONLY processos.encaminhamentos
    ADD CONSTRAINT encaminhamentos_id_protocolo_versao_fkey FOREIGN KEY (id_protocolo_versao) REFERENCES processos.protocolo_versoes(id_protocolo_versao) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: encaminhamentos encaminhamentos_id_proxima_etapa_fkey; Type: FK CONSTRAINT; Schema: processos; Owner: -
--

ALTER TABLE ONLY processos.encaminhamentos
    ADD CONSTRAINT encaminhamentos_id_proxima_etapa_fkey FOREIGN KEY (id_proxima_etapa) REFERENCES processos.protocolos_etapas(id_protocolo_etapa) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: encaminhamentos encaminhamentos_id_proximo_encaminhamento_fkey; Type: FK CONSTRAINT; Schema: processos; Owner: -
--

ALTER TABLE ONLY processos.encaminhamentos
    ADD CONSTRAINT encaminhamentos_id_proximo_encaminhamento_fkey FOREIGN KEY (id_proximo_encaminhamento) REFERENCES processos.encaminhamentos(id_encaminhamento) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: protocolo_documento_html_css fk_html_css_documento; Type: FK CONSTRAINT; Schema: processos; Owner: -
--

ALTER TABLE ONLY processos.protocolo_documento_html_css
    ADD CONSTRAINT fk_html_css_documento FOREIGN KEY (id_protocolo_documento_versao) REFERENCES processos.protocolo_documento_html(id_protocolo_documento_versao) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: processo_consultas fk_pc_etapa_processo; Type: FK CONSTRAINT; Schema: processos; Owner: -
--

ALTER TABLE ONLY processos.processo_consultas
    ADD CONSTRAINT fk_pc_etapa_processo FOREIGN KEY (id_processo_etapa, id_processo) REFERENCES processos.processo_etapas(id_processo_etapa, id_processo) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: processo_documento fk_pd_etapa_processo; Type: FK CONSTRAINT; Schema: processos; Owner: -
--

ALTER TABLE ONLY processos.processo_documento
    ADD CONSTRAINT fk_pd_etapa_processo FOREIGN KEY (id_processo_etapa, id_processo) REFERENCES processos.processo_etapas(id_processo_etapa, id_processo) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: protocolo_documento_pdf_campos fk_pdf_campo_variavel_instituicao; Type: FK CONSTRAINT; Schema: processos; Owner: -
--

ALTER TABLE ONLY processos.protocolo_documento_pdf_campos
    ADD CONSTRAINT fk_pdf_campo_variavel_instituicao FOREIGN KEY (id_atributo) REFERENCES cadastro.variaveis_instituicao(id_atributo) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: processo_etapa_encaminhamentos fk_pe_caminho_destino_processo; Type: FK CONSTRAINT; Schema: processos; Owner: -
--

ALTER TABLE ONLY processos.processo_etapa_encaminhamentos
    ADD CONSTRAINT fk_pe_caminho_destino_processo FOREIGN KEY (id_processo_etapa, id_processo) REFERENCES processos.processo_etapas(id_processo_etapa, id_processo) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: processo_etapa_encaminhamentos fk_pe_caminho_origem_processo; Type: FK CONSTRAINT; Schema: processos; Owner: -
--

ALTER TABLE ONLY processos.processo_etapa_encaminhamentos
    ADD CONSTRAINT fk_pe_caminho_origem_processo FOREIGN KEY (id_processo_etapa_origem, id_processo) REFERENCES processos.processo_etapas(id_processo_etapa, id_processo) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: protocolo_recursos fk_recurso_protocolo; Type: FK CONSTRAINT; Schema: processos; Owner: -
--

ALTER TABLE ONLY processos.protocolo_recursos
    ADD CONSTRAINT fk_recurso_protocolo FOREIGN KEY (id_protocolo) REFERENCES processos.protocolos(id_protocolo) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: protocolo_recursos fk_recurso_protocolo_arquivo; Type: FK CONSTRAINT; Schema: processos; Owner: -
--

ALTER TABLE ONLY processos.protocolo_recursos
    ADD CONSTRAINT fk_recurso_protocolo_arquivo FOREIGN KEY (id_arquivo_versao) REFERENCES docs.arquivo_versoes(id_arquivo_versao) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: processo_variaveis_atuais fk_variavel_atual_etapa_processo; Type: FK CONSTRAINT; Schema: processos; Owner: -
--

ALTER TABLE ONLY processos.processo_variaveis_atuais
    ADD CONSTRAINT fk_variavel_atual_etapa_processo FOREIGN KEY (id_processo_etapa, id_processo) REFERENCES processos.processo_etapas(id_processo_etapa, id_processo) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: processo_variaveis_atuais fk_variavel_atual_valor; Type: FK CONSTRAINT; Schema: processos; Owner: -
--

ALTER TABLE ONLY processos.processo_variaveis_atuais
    ADD CONSTRAINT fk_variavel_atual_valor FOREIGN KEY (id_processo_etapa, id_variavel) REFERENCES processos.processo_variavel_valores(id_processo_etapa, id_variavel) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: protocolo_versao_documentos fk_versao_documento_correspondente; Type: FK CONSTRAINT; Schema: processos; Owner: -
--

ALTER TABLE ONLY processos.protocolo_versao_documentos
    ADD CONSTRAINT fk_versao_documento_correspondente FOREIGN KEY (id_protocolo_documento_versao, id_protocolo_documento) REFERENCES processos.protocolo_documento_versoes(id_protocolo_documento_versao, id_protocolo_documento) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: formulario_variaveis formulario_variaveis_id_formulario_fkey; Type: FK CONSTRAINT; Schema: processos; Owner: -
--

ALTER TABLE ONLY processos.formulario_variaveis
    ADD CONSTRAINT formulario_variaveis_id_formulario_fkey FOREIGN KEY (id_formulario) REFERENCES processos.formularios(id_formulario) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: formulario_variaveis formulario_variaveis_id_variavel_fkey; Type: FK CONSTRAINT; Schema: processos; Owner: -
--

ALTER TABLE ONLY processos.formulario_variaveis
    ADD CONSTRAINT formulario_variaveis_id_variavel_fkey FOREIGN KEY (id_variavel) REFERENCES processos.protocolo_variaveis(id_variavel) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: formularios formularios_id_protocolo_versao_fkey; Type: FK CONSTRAINT; Schema: processos; Owner: -
--

ALTER TABLE ONLY processos.formularios
    ADD CONSTRAINT formularios_id_protocolo_versao_fkey FOREIGN KEY (id_protocolo_versao) REFERENCES processos.protocolo_versoes(id_protocolo_versao) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: processo_anexos processo_anexos_id_arquivo_versao_fkey; Type: FK CONSTRAINT; Schema: processos; Owner: -
--

ALTER TABLE ONLY processos.processo_anexos
    ADD CONSTRAINT processo_anexos_id_arquivo_versao_fkey FOREIGN KEY (id_arquivo_versao) REFERENCES docs.arquivo_versoes(id_arquivo_versao) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: processo_anexos processo_anexos_id_mensagem_fkey; Type: FK CONSTRAINT; Schema: processos; Owner: -
--

ALTER TABLE ONLY processos.processo_anexos
    ADD CONSTRAINT processo_anexos_id_mensagem_fkey FOREIGN KEY (id_mensagem) REFERENCES processos.processo_forum(id_mensagem) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: processo_consultas processo_consultas_id_mensagem_parecer_fkey; Type: FK CONSTRAINT; Schema: processos; Owner: -
--

ALTER TABLE ONLY processos.processo_consultas
    ADD CONSTRAINT processo_consultas_id_mensagem_parecer_fkey FOREIGN KEY (id_mensagem_parecer) REFERENCES processos.processo_forum(id_mensagem) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: processo_consultas processo_consultas_id_processo_etapa_fkey; Type: FK CONSTRAINT; Schema: processos; Owner: -
--

ALTER TABLE ONLY processos.processo_consultas
    ADD CONSTRAINT processo_consultas_id_processo_etapa_fkey FOREIGN KEY (id_processo_etapa) REFERENCES processos.processo_etapas(id_processo_etapa) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: processo_consultas processo_consultas_id_processo_fkey; Type: FK CONSTRAINT; Schema: processos; Owner: -
--

ALTER TABLE ONLY processos.processo_consultas
    ADD CONSTRAINT processo_consultas_id_processo_fkey FOREIGN KEY (id_processo) REFERENCES processos.processos(id_processo) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: processo_consultas processo_consultas_id_usuario_aprovador_fkey; Type: FK CONSTRAINT; Schema: processos; Owner: -
--

ALTER TABLE ONLY processos.processo_consultas
    ADD CONSTRAINT processo_consultas_id_usuario_aprovador_fkey FOREIGN KEY (id_usuario_aprovador) REFERENCES cadastro.usuarios_sistema(id_usuario_sistema) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: processo_consultas processo_consultas_id_usuario_consultor_fkey; Type: FK CONSTRAINT; Schema: processos; Owner: -
--

ALTER TABLE ONLY processos.processo_consultas
    ADD CONSTRAINT processo_consultas_id_usuario_consultor_fkey FOREIGN KEY (id_usuario_consultor) REFERENCES cadastro.usuarios_sistema(id_usuario_sistema) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: processo_consultas processo_consultas_id_usuario_encerrou_fkey; Type: FK CONSTRAINT; Schema: processos; Owner: -
--

ALTER TABLE ONLY processos.processo_consultas
    ADD CONSTRAINT processo_consultas_id_usuario_encerrou_fkey FOREIGN KEY (id_usuario_encerrou) REFERENCES cadastro.usuarios_sistema(id_usuario_sistema) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: processo_consultas processo_consultas_id_usuario_solicitante_fkey; Type: FK CONSTRAINT; Schema: processos; Owner: -
--

ALTER TABLE ONLY processos.processo_consultas
    ADD CONSTRAINT processo_consultas_id_usuario_solicitante_fkey FOREIGN KEY (id_usuario_solicitante) REFERENCES cadastro.usuarios_sistema(id_usuario_sistema) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: processo_convidados processo_convidados_id_processo_consulta_fkey; Type: FK CONSTRAINT; Schema: processos; Owner: -
--

ALTER TABLE ONLY processos.processo_convidados
    ADD CONSTRAINT processo_convidados_id_processo_consulta_fkey FOREIGN KEY (id_processo_consulta) REFERENCES processos.processo_consultas(id_processo_consulta) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: processo_convidados processo_convidados_id_processo_fkey; Type: FK CONSTRAINT; Schema: processos; Owner: -
--

ALTER TABLE ONLY processos.processo_convidados
    ADD CONSTRAINT processo_convidados_id_processo_fkey FOREIGN KEY (id_processo) REFERENCES processos.processos(id_processo) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: processo_convidados processo_convidados_id_usuario_convidado_fkey; Type: FK CONSTRAINT; Schema: processos; Owner: -
--

ALTER TABLE ONLY processos.processo_convidados
    ADD CONSTRAINT processo_convidados_id_usuario_convidado_fkey FOREIGN KEY (id_usuario_convidado) REFERENCES cadastro.usuarios_sistema(id_usuario_sistema) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: processo_convidados processo_convidados_id_usuario_convidou_fkey; Type: FK CONSTRAINT; Schema: processos; Owner: -
--

ALTER TABLE ONLY processos.processo_convidados
    ADD CONSTRAINT processo_convidados_id_usuario_convidou_fkey FOREIGN KEY (id_usuario_convidou) REFERENCES cadastro.usuarios_sistema(id_usuario_sistema) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: processo_convidados processo_convidados_id_usuario_decidiu_fkey; Type: FK CONSTRAINT; Schema: processos; Owner: -
--

ALTER TABLE ONLY processos.processo_convidados
    ADD CONSTRAINT processo_convidados_id_usuario_decidiu_fkey FOREIGN KEY (id_usuario_decidiu) REFERENCES cadastro.usuarios_sistema(id_usuario_sistema) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: processo_convidados processo_convidados_id_usuario_encerrou_fkey; Type: FK CONSTRAINT; Schema: processos; Owner: -
--

ALTER TABLE ONLY processos.processo_convidados
    ADD CONSTRAINT processo_convidados_id_usuario_encerrou_fkey FOREIGN KEY (id_usuario_encerrou) REFERENCES cadastro.usuarios_sistema(id_usuario_sistema) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: processo_documento processo_documento_id_arquivo_versao_fkey; Type: FK CONSTRAINT; Schema: processos; Owner: -
--

ALTER TABLE ONLY processos.processo_documento
    ADD CONSTRAINT processo_documento_id_arquivo_versao_fkey FOREIGN KEY (id_arquivo_versao) REFERENCES docs.arquivo_versoes(id_arquivo_versao) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: processo_documento processo_documento_id_processo_etapa_fkey; Type: FK CONSTRAINT; Schema: processos; Owner: -
--

ALTER TABLE ONLY processos.processo_documento
    ADD CONSTRAINT processo_documento_id_processo_etapa_fkey FOREIGN KEY (id_processo_etapa) REFERENCES processos.processo_etapas(id_processo_etapa) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: processo_documento processo_documento_id_processo_fkey; Type: FK CONSTRAINT; Schema: processos; Owner: -
--

ALTER TABLE ONLY processos.processo_documento
    ADD CONSTRAINT processo_documento_id_processo_fkey FOREIGN KEY (id_processo) REFERENCES processos.processos(id_processo) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: processo_documento processo_documento_id_protocolo_documento_versao_fkey; Type: FK CONSTRAINT; Schema: processos; Owner: -
--

ALTER TABLE ONLY processos.processo_documento
    ADD CONSTRAINT processo_documento_id_protocolo_documento_versao_fkey FOREIGN KEY (id_protocolo_documento_versao) REFERENCES processos.protocolo_documento_versoes(id_protocolo_documento_versao) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: processo_etapa_destinatarios processo_etapa_destinatarios_id_etapa_destinatario_fkey; Type: FK CONSTRAINT; Schema: processos; Owner: -
--

ALTER TABLE ONLY processos.processo_etapa_destinatarios
    ADD CONSTRAINT processo_etapa_destinatarios_id_etapa_destinatario_fkey FOREIGN KEY (id_etapa_destinatario) REFERENCES processos.protocolo_etapa_destinatarios(id_etapa_destinatario) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: processo_etapa_destinatarios processo_etapa_destinatarios_id_processo_etapa_encaminhame_fkey; Type: FK CONSTRAINT; Schema: processos; Owner: -
--

ALTER TABLE ONLY processos.processo_etapa_destinatarios
    ADD CONSTRAINT processo_etapa_destinatarios_id_processo_etapa_encaminhame_fkey FOREIGN KEY (id_processo_etapa_encaminhamento) REFERENCES processos.processo_etapa_encaminhamentos(id_processo_etapa_encaminhamento) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: processo_etapa_encaminhamentos processo_etapa_encaminhamentos_id_encaminhamento_fkey; Type: FK CONSTRAINT; Schema: processos; Owner: -
--

ALTER TABLE ONLY processos.processo_etapa_encaminhamentos
    ADD CONSTRAINT processo_etapa_encaminhamentos_id_encaminhamento_fkey FOREIGN KEY (id_encaminhamento) REFERENCES processos.encaminhamentos(id_encaminhamento) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: processo_etapa_encaminhamentos processo_etapa_encaminhamentos_id_processo_etapa_fkey; Type: FK CONSTRAINT; Schema: processos; Owner: -
--

ALTER TABLE ONLY processos.processo_etapa_encaminhamentos
    ADD CONSTRAINT processo_etapa_encaminhamentos_id_processo_etapa_fkey FOREIGN KEY (id_processo_etapa) REFERENCES processos.processo_etapas(id_processo_etapa) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: processo_etapa_encaminhamentos processo_etapa_encaminhamentos_id_processo_etapa_origem_fkey; Type: FK CONSTRAINT; Schema: processos; Owner: -
--

ALTER TABLE ONLY processos.processo_etapa_encaminhamentos
    ADD CONSTRAINT processo_etapa_encaminhamentos_id_processo_etapa_origem_fkey FOREIGN KEY (id_processo_etapa_origem) REFERENCES processos.processo_etapas(id_processo_etapa) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: processo_etapa_encaminhamentos processo_etapa_encaminhamentos_id_processo_fkey; Type: FK CONSTRAINT; Schema: processos; Owner: -
--

ALTER TABLE ONLY processos.processo_etapa_encaminhamentos
    ADD CONSTRAINT processo_etapa_encaminhamentos_id_processo_fkey FOREIGN KEY (id_processo) REFERENCES processos.processos(id_processo) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: processo_etapa_encaminhamentos processo_etapa_encaminhamentos_id_protocolo_etapa_destino_fkey; Type: FK CONSTRAINT; Schema: processos; Owner: -
--

ALTER TABLE ONLY processos.processo_etapa_encaminhamentos
    ADD CONSTRAINT processo_etapa_encaminhamentos_id_protocolo_etapa_destino_fkey FOREIGN KEY (id_protocolo_etapa_destino) REFERENCES processos.protocolos_etapas(id_protocolo_etapa) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: processo_etapa_responsaveis processo_etapa_responsaveis_id_processo_etapa_fkey; Type: FK CONSTRAINT; Schema: processos; Owner: -
--

ALTER TABLE ONLY processos.processo_etapa_responsaveis
    ADD CONSTRAINT processo_etapa_responsaveis_id_processo_etapa_fkey FOREIGN KEY (id_processo_etapa) REFERENCES processos.processo_etapas(id_processo_etapa) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: processo_etapa_responsaveis processo_etapa_responsaveis_id_usuario_sistema_fkey; Type: FK CONSTRAINT; Schema: processos; Owner: -
--

ALTER TABLE ONLY processos.processo_etapa_responsaveis
    ADD CONSTRAINT processo_etapa_responsaveis_id_usuario_sistema_fkey FOREIGN KEY (id_usuario_sistema) REFERENCES cadastro.usuarios_sistema(id_usuario_sistema) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: processo_etapas processo_etapas_id_processo_fkey; Type: FK CONSTRAINT; Schema: processos; Owner: -
--

ALTER TABLE ONLY processos.processo_etapas
    ADD CONSTRAINT processo_etapas_id_processo_fkey FOREIGN KEY (id_processo) REFERENCES processos.processos(id_processo) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: processo_etapas processo_etapas_id_protocolo_etapa_fkey; Type: FK CONSTRAINT; Schema: processos; Owner: -
--

ALTER TABLE ONLY processos.processo_etapas
    ADD CONSTRAINT processo_etapas_id_protocolo_etapa_fkey FOREIGN KEY (id_protocolo_etapa) REFERENCES processos.protocolos_etapas(id_protocolo_etapa) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: processo_etapas processo_etapas_id_usuario_responsavel_fkey; Type: FK CONSTRAINT; Schema: processos; Owner: -
--

ALTER TABLE ONLY processos.processo_etapas
    ADD CONSTRAINT processo_etapas_id_usuario_responsavel_fkey FOREIGN KEY (id_usuario_responsavel) REFERENCES cadastro.usuarios_sistema(id_usuario_sistema) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: processo_forum processo_forum_id_processo_fkey; Type: FK CONSTRAINT; Schema: processos; Owner: -
--

ALTER TABLE ONLY processos.processo_forum
    ADD CONSTRAINT processo_forum_id_processo_fkey FOREIGN KEY (id_processo) REFERENCES processos.processos(id_processo) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: processo_forum processo_forum_id_usuario_autor_fkey; Type: FK CONSTRAINT; Schema: processos; Owner: -
--

ALTER TABLE ONLY processos.processo_forum
    ADD CONSTRAINT processo_forum_id_usuario_autor_fkey FOREIGN KEY (id_usuario_autor) REFERENCES cadastro.usuarios_sistema(id_usuario_sistema) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: processo_transferencia_gestao processo_transferencia_gestao_id_gestor_destino_fkey; Type: FK CONSTRAINT; Schema: processos; Owner: -
--

ALTER TABLE ONLY processos.processo_transferencia_gestao
    ADD CONSTRAINT processo_transferencia_gestao_id_gestor_destino_fkey FOREIGN KEY (id_gestor_destino) REFERENCES cadastro.usuarios_sistema(id_usuario_sistema) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: processo_transferencia_gestao processo_transferencia_gestao_id_gestor_origem_fkey; Type: FK CONSTRAINT; Schema: processos; Owner: -
--

ALTER TABLE ONLY processos.processo_transferencia_gestao
    ADD CONSTRAINT processo_transferencia_gestao_id_gestor_origem_fkey FOREIGN KEY (id_gestor_origem) REFERENCES cadastro.usuarios_sistema(id_usuario_sistema) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: processo_transferencia_gestao processo_transferencia_gestao_id_processo_etapa_encaminham_fkey; Type: FK CONSTRAINT; Schema: processos; Owner: -
--

ALTER TABLE ONLY processos.processo_transferencia_gestao
    ADD CONSTRAINT processo_transferencia_gestao_id_processo_etapa_encaminham_fkey FOREIGN KEY (id_processo_etapa_encaminhamento) REFERENCES processos.processo_etapa_encaminhamentos(id_processo_etapa_encaminhamento) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: processo_transferencia_gestao processo_transferencia_gestao_id_processo_fkey; Type: FK CONSTRAINT; Schema: processos; Owner: -
--

ALTER TABLE ONLY processos.processo_transferencia_gestao
    ADD CONSTRAINT processo_transferencia_gestao_id_processo_fkey FOREIGN KEY (id_processo) REFERENCES processos.processos(id_processo) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: processo_transferencia_gestao processo_transferencia_gestao_id_usuario_solicitou_fkey; Type: FK CONSTRAINT; Schema: processos; Owner: -
--

ALTER TABLE ONLY processos.processo_transferencia_gestao
    ADD CONSTRAINT processo_transferencia_gestao_id_usuario_solicitou_fkey FOREIGN KEY (id_usuario_solicitou) REFERENCES cadastro.usuarios_sistema(id_usuario_sistema) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: processo_variaveis_atuais processo_variaveis_atuais_id_processo_etapa_fkey; Type: FK CONSTRAINT; Schema: processos; Owner: -
--

ALTER TABLE ONLY processos.processo_variaveis_atuais
    ADD CONSTRAINT processo_variaveis_atuais_id_processo_etapa_fkey FOREIGN KEY (id_processo_etapa) REFERENCES processos.processo_etapas(id_processo_etapa) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: processo_variaveis_atuais processo_variaveis_atuais_id_processo_fkey; Type: FK CONSTRAINT; Schema: processos; Owner: -
--

ALTER TABLE ONLY processos.processo_variaveis_atuais
    ADD CONSTRAINT processo_variaveis_atuais_id_processo_fkey FOREIGN KEY (id_processo) REFERENCES processos.processos(id_processo) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: processo_variaveis_atuais processo_variaveis_atuais_id_variavel_fkey; Type: FK CONSTRAINT; Schema: processos; Owner: -
--

ALTER TABLE ONLY processos.processo_variaveis_atuais
    ADD CONSTRAINT processo_variaveis_atuais_id_variavel_fkey FOREIGN KEY (id_variavel) REFERENCES processos.protocolo_variaveis(id_variavel) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: processo_variavel_valores processo_variavel_valores_id_processo_etapa_fkey; Type: FK CONSTRAINT; Schema: processos; Owner: -
--

ALTER TABLE ONLY processos.processo_variavel_valores
    ADD CONSTRAINT processo_variavel_valores_id_processo_etapa_fkey FOREIGN KEY (id_processo_etapa) REFERENCES processos.processo_etapas(id_processo_etapa) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: processo_variavel_valores processo_variavel_valores_id_usuario_ultima_gravacao_fkey; Type: FK CONSTRAINT; Schema: processos; Owner: -
--

ALTER TABLE ONLY processos.processo_variavel_valores
    ADD CONSTRAINT processo_variavel_valores_id_usuario_ultima_gravacao_fkey FOREIGN KEY (id_usuario_ultima_gravacao) REFERENCES cadastro.usuarios_sistema(id_usuario_sistema) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: processo_variavel_valores processo_variavel_valores_id_variavel_fkey; Type: FK CONSTRAINT; Schema: processos; Owner: -
--

ALTER TABLE ONLY processos.processo_variavel_valores
    ADD CONSTRAINT processo_variavel_valores_id_variavel_fkey FOREIGN KEY (id_variavel) REFERENCES processos.protocolo_variaveis(id_variavel) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: processos processos_id_protocolo_versao_fkey; Type: FK CONSTRAINT; Schema: processos; Owner: -
--

ALTER TABLE ONLY processos.processos
    ADD CONSTRAINT processos_id_protocolo_versao_fkey FOREIGN KEY (id_protocolo_versao) REFERENCES processos.protocolo_versoes(id_protocolo_versao) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: processos processos_id_usuario_gestor_fkey; Type: FK CONSTRAINT; Schema: processos; Owner: -
--

ALTER TABLE ONLY processos.processos
    ADD CONSTRAINT processos_id_usuario_gestor_fkey FOREIGN KEY (id_usuario_gestor) REFERENCES cadastro.usuarios_sistema(id_usuario_sistema) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: processos processos_id_usuario_iniciou_fkey; Type: FK CONSTRAINT; Schema: processos; Owner: -
--

ALTER TABLE ONLY processos.processos
    ADD CONSTRAINT processos_id_usuario_iniciou_fkey FOREIGN KEY (id_usuario_iniciou) REFERENCES cadastro.usuarios_sistema(id_usuario_sistema) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: protocolo_documento_html_partes protocolo_documento_html_part_id_protocolo_documento_versa_fkey; Type: FK CONSTRAINT; Schema: processos; Owner: -
--

ALTER TABLE ONLY processos.protocolo_documento_html_partes
    ADD CONSTRAINT protocolo_documento_html_part_id_protocolo_documento_versa_fkey FOREIGN KEY (id_protocolo_documento_versao) REFERENCES processos.protocolo_documento_html(id_protocolo_documento_versao) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: protocolo_documento_pdf_campos protocolo_documento_pdf_campo_id_protocolo_documento_versa_fkey; Type: FK CONSTRAINT; Schema: processos; Owner: -
--

ALTER TABLE ONLY processos.protocolo_documento_pdf_campos
    ADD CONSTRAINT protocolo_documento_pdf_campo_id_protocolo_documento_versa_fkey FOREIGN KEY (id_protocolo_documento_versao) REFERENCES processos.protocolo_documento_pdf(id_protocolo_documento_versao) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: protocolo_documento_pdf_campos protocolo_documento_pdf_campo_id_variavel_fkey; Type: FK CONSTRAINT; Schema: processos; Owner: -
--

ALTER TABLE ONLY processos.protocolo_documento_pdf_campos
    ADD CONSTRAINT protocolo_documento_pdf_campo_id_variavel_fkey FOREIGN KEY (id_variavel) REFERENCES processos.protocolo_variaveis(id_variavel) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: protocolo_documento_pdf_campos protocolo_documento_pdf_campos_id_atributo_fkey; Type: FK CONSTRAINT; Schema: processos; Owner: -
--

ALTER TABLE ONLY processos.protocolo_documento_pdf_campos
    ADD CONSTRAINT protocolo_documento_pdf_campos_id_atributo_fkey FOREIGN KEY (id_atributo) REFERENCES cadastro.variaveis_instituicao(id_atributo) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: protocolo_documento_pdf protocolo_documento_pdf_id_arquivo_modelo_pdf_fkey; Type: FK CONSTRAINT; Schema: processos; Owner: -
--

ALTER TABLE ONLY processos.protocolo_documento_pdf
    ADD CONSTRAINT protocolo_documento_pdf_id_arquivo_modelo_pdf_fkey FOREIGN KEY (id_arquivo_modelo_pdf) REFERENCES docs.arquivo_versoes(id_arquivo_versao) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: protocolo_documento_pdf protocolo_documento_pdf_id_protocolo_documento_versao_fkey; Type: FK CONSTRAINT; Schema: processos; Owner: -
--

ALTER TABLE ONLY processos.protocolo_documento_pdf
    ADD CONSTRAINT protocolo_documento_pdf_id_protocolo_documento_versao_fkey FOREIGN KEY (id_protocolo_documento_versao) REFERENCES processos.protocolo_documento_versoes(id_protocolo_documento_versao) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: protocolo_documento_versoes protocolo_documento_versoes_id_protocolo_documento_fkey; Type: FK CONSTRAINT; Schema: processos; Owner: -
--

ALTER TABLE ONLY processos.protocolo_documento_versoes
    ADD CONSTRAINT protocolo_documento_versoes_id_protocolo_documento_fkey FOREIGN KEY (id_protocolo_documento) REFERENCES processos.protocolo_documentos(id_protocolo_documento) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: protocolo_documentos protocolo_documentos_id_protocolo_fkey; Type: FK CONSTRAINT; Schema: processos; Owner: -
--

ALTER TABLE ONLY processos.protocolo_documentos
    ADD CONSTRAINT protocolo_documentos_id_protocolo_fkey FOREIGN KEY (id_protocolo) REFERENCES processos.protocolos(id_protocolo) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: protocolo_etapa_destinatarios protocolo_etapa_destinatarios_cd_tag_grupo_fkey; Type: FK CONSTRAINT; Schema: processos; Owner: -
--

ALTER TABLE ONLY processos.protocolo_etapa_destinatarios
    ADD CONSTRAINT protocolo_etapa_destinatarios_cd_tag_grupo_fkey FOREIGN KEY (cd_tag_grupo) REFERENCES cadastro.tags(cd_tag) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: protocolo_etapa_destinatarios protocolo_etapa_destinatarios_cd_tag_usuario_fkey; Type: FK CONSTRAINT; Schema: processos; Owner: -
--

ALTER TABLE ONLY processos.protocolo_etapa_destinatarios
    ADD CONSTRAINT protocolo_etapa_destinatarios_cd_tag_usuario_fkey FOREIGN KEY (cd_tag_usuario) REFERENCES cadastro.tags(cd_tag) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: protocolo_etapa_destinatarios protocolo_etapa_destinatarios_cd_tag_vinculo_fkey; Type: FK CONSTRAINT; Schema: processos; Owner: -
--

ALTER TABLE ONLY processos.protocolo_etapa_destinatarios
    ADD CONSTRAINT protocolo_etapa_destinatarios_cd_tag_vinculo_fkey FOREIGN KEY (cd_tag_vinculo) REFERENCES cadastro.tags(cd_tag) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: protocolo_etapa_destinatarios protocolo_etapa_destinatarios_id_grupo_fkey; Type: FK CONSTRAINT; Schema: processos; Owner: -
--

ALTER TABLE ONLY processos.protocolo_etapa_destinatarios
    ADD CONSTRAINT protocolo_etapa_destinatarios_id_grupo_fkey FOREIGN KEY (id_grupo) REFERENCES cadastro.grupos(id_grupo) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: protocolo_etapa_destinatarios protocolo_etapa_destinatarios_id_protocolo_etapa_fkey; Type: FK CONSTRAINT; Schema: processos; Owner: -
--

ALTER TABLE ONLY processos.protocolo_etapa_destinatarios
    ADD CONSTRAINT protocolo_etapa_destinatarios_id_protocolo_etapa_fkey FOREIGN KEY (id_protocolo_etapa) REFERENCES processos.protocolos_etapas(id_protocolo_etapa) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: protocolo_etapa_destinatarios protocolo_etapa_destinatarios_id_usuario_sistema_fkey; Type: FK CONSTRAINT; Schema: processos; Owner: -
--

ALTER TABLE ONLY processos.protocolo_etapa_destinatarios
    ADD CONSTRAINT protocolo_etapa_destinatarios_id_usuario_sistema_fkey FOREIGN KEY (id_usuario_sistema) REFERENCES cadastro.usuarios_sistema(id_usuario_sistema) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: protocolo_gestores_elegiveis protocolo_gestores_elegiveis_cd_tag_grupo_fkey; Type: FK CONSTRAINT; Schema: processos; Owner: -
--

ALTER TABLE ONLY processos.protocolo_gestores_elegiveis
    ADD CONSTRAINT protocolo_gestores_elegiveis_cd_tag_grupo_fkey FOREIGN KEY (cd_tag_grupo) REFERENCES cadastro.tags(cd_tag) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: protocolo_gestores_elegiveis protocolo_gestores_elegiveis_cd_tag_usuario_fkey; Type: FK CONSTRAINT; Schema: processos; Owner: -
--

ALTER TABLE ONLY processos.protocolo_gestores_elegiveis
    ADD CONSTRAINT protocolo_gestores_elegiveis_cd_tag_usuario_fkey FOREIGN KEY (cd_tag_usuario) REFERENCES cadastro.tags(cd_tag) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: protocolo_gestores_elegiveis protocolo_gestores_elegiveis_cd_tag_vinculo_fkey; Type: FK CONSTRAINT; Schema: processos; Owner: -
--

ALTER TABLE ONLY processos.protocolo_gestores_elegiveis
    ADD CONSTRAINT protocolo_gestores_elegiveis_cd_tag_vinculo_fkey FOREIGN KEY (cd_tag_vinculo) REFERENCES cadastro.tags(cd_tag) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: protocolo_gestores_elegiveis protocolo_gestores_elegiveis_id_grupo_fkey; Type: FK CONSTRAINT; Schema: processos; Owner: -
--

ALTER TABLE ONLY processos.protocolo_gestores_elegiveis
    ADD CONSTRAINT protocolo_gestores_elegiveis_id_grupo_fkey FOREIGN KEY (id_grupo) REFERENCES cadastro.grupos(id_grupo) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: protocolo_gestores_elegiveis protocolo_gestores_elegiveis_id_protocolo_versao_fkey; Type: FK CONSTRAINT; Schema: processos; Owner: -
--

ALTER TABLE ONLY processos.protocolo_gestores_elegiveis
    ADD CONSTRAINT protocolo_gestores_elegiveis_id_protocolo_versao_fkey FOREIGN KEY (id_protocolo_versao) REFERENCES processos.protocolo_versoes(id_protocolo_versao) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: protocolo_gestores_elegiveis protocolo_gestores_elegiveis_id_usuario_sistema_fkey; Type: FK CONSTRAINT; Schema: processos; Owner: -
--

ALTER TABLE ONLY processos.protocolo_gestores_elegiveis
    ADD CONSTRAINT protocolo_gestores_elegiveis_id_usuario_sistema_fkey FOREIGN KEY (id_usuario_sistema) REFERENCES cadastro.usuarios_sistema(id_usuario_sistema) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: protocolo_sequencias protocolo_sequencias_id_protocolo_fkey; Type: FK CONSTRAINT; Schema: processos; Owner: -
--

ALTER TABLE ONLY processos.protocolo_sequencias
    ADD CONSTRAINT protocolo_sequencias_id_protocolo_fkey FOREIGN KEY (id_protocolo) REFERENCES processos.protocolos(id_protocolo) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: protocolo_variaveis protocolo_variaveis_id_protocolo_fkey; Type: FK CONSTRAINT; Schema: processos; Owner: -
--

ALTER TABLE ONLY processos.protocolo_variaveis
    ADD CONSTRAINT protocolo_variaveis_id_protocolo_fkey FOREIGN KEY (id_protocolo) REFERENCES processos.protocolos(id_protocolo) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: protocolo_variavel_versoes protocolo_variavel_versoes_id_variavel_fkey; Type: FK CONSTRAINT; Schema: processos; Owner: -
--

ALTER TABLE ONLY processos.protocolo_variavel_versoes
    ADD CONSTRAINT protocolo_variavel_versoes_id_variavel_fkey FOREIGN KEY (id_variavel) REFERENCES processos.protocolo_variaveis(id_variavel) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: protocolo_versao_documentos protocolo_versao_documentos_id_protocolo_documento_fkey; Type: FK CONSTRAINT; Schema: processos; Owner: -
--

ALTER TABLE ONLY processos.protocolo_versao_documentos
    ADD CONSTRAINT protocolo_versao_documentos_id_protocolo_documento_fkey FOREIGN KEY (id_protocolo_documento) REFERENCES processos.protocolo_documentos(id_protocolo_documento) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: protocolo_versao_documentos protocolo_versao_documentos_id_protocolo_documento_versao_fkey; Type: FK CONSTRAINT; Schema: processos; Owner: -
--

ALTER TABLE ONLY processos.protocolo_versao_documentos
    ADD CONSTRAINT protocolo_versao_documentos_id_protocolo_documento_versao_fkey FOREIGN KEY (id_protocolo_documento_versao) REFERENCES processos.protocolo_documento_versoes(id_protocolo_documento_versao) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: protocolo_versao_documentos protocolo_versao_documentos_id_protocolo_versao_fkey; Type: FK CONSTRAINT; Schema: processos; Owner: -
--

ALTER TABLE ONLY processos.protocolo_versao_documentos
    ADD CONSTRAINT protocolo_versao_documentos_id_protocolo_versao_fkey FOREIGN KEY (id_protocolo_versao) REFERENCES processos.protocolo_versoes(id_protocolo_versao) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: protocolo_versao_variaveis protocolo_versao_variaveis_id_protocolo_versao_fkey; Type: FK CONSTRAINT; Schema: processos; Owner: -
--

ALTER TABLE ONLY processos.protocolo_versao_variaveis
    ADD CONSTRAINT protocolo_versao_variaveis_id_protocolo_versao_fkey FOREIGN KEY (id_protocolo_versao) REFERENCES processos.protocolo_versoes(id_protocolo_versao) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: protocolo_versao_variaveis protocolo_versao_variaveis_id_variavel_nr_versao_fkey; Type: FK CONSTRAINT; Schema: processos; Owner: -
--

ALTER TABLE ONLY processos.protocolo_versao_variaveis
    ADD CONSTRAINT protocolo_versao_variaveis_id_variavel_nr_versao_fkey FOREIGN KEY (id_variavel, nr_versao) REFERENCES processos.protocolo_variavel_versoes(id_variavel, nr_versao) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: protocolo_versoes protocolo_versoes_id_protocolo_fkey; Type: FK CONSTRAINT; Schema: processos; Owner: -
--

ALTER TABLE ONLY processos.protocolo_versoes
    ADD CONSTRAINT protocolo_versoes_id_protocolo_fkey FOREIGN KEY (id_protocolo) REFERENCES processos.protocolos(id_protocolo) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: protocolo_versoes protocolo_versoes_id_usuario_abriu_fkey; Type: FK CONSTRAINT; Schema: processos; Owner: -
--

ALTER TABLE ONLY processos.protocolo_versoes
    ADD CONSTRAINT protocolo_versoes_id_usuario_abriu_fkey FOREIGN KEY (id_usuario_abriu) REFERENCES cadastro.usuarios_sistema(id_usuario_sistema) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: protocolo_versoes protocolo_versoes_id_usuario_publicou_fkey; Type: FK CONSTRAINT; Schema: processos; Owner: -
--

ALTER TABLE ONLY processos.protocolo_versoes
    ADD CONSTRAINT protocolo_versoes_id_usuario_publicou_fkey FOREIGN KEY (id_usuario_publicou) REFERENCES cadastro.usuarios_sistema(id_usuario_sistema) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: protocolo_versoes protocolo_versoes_id_usuario_responsavel_fkey; Type: FK CONSTRAINT; Schema: processos; Owner: -
--

ALTER TABLE ONLY processos.protocolo_versoes
    ADD CONSTRAINT protocolo_versoes_id_usuario_responsavel_fkey FOREIGN KEY (id_usuario_responsavel) REFERENCES cadastro.usuarios_sistema(id_usuario_sistema) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: protocolos_etapas protocolos_etapas_id_encaminhamento_fkey; Type: FK CONSTRAINT; Schema: processos; Owner: -
--

ALTER TABLE ONLY processos.protocolos_etapas
    ADD CONSTRAINT protocolos_etapas_id_encaminhamento_fkey FOREIGN KEY (id_encaminhamento) REFERENCES processos.encaminhamentos(id_encaminhamento) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: protocolos_etapas protocolos_etapas_id_formulario_fkey; Type: FK CONSTRAINT; Schema: processos; Owner: -
--

ALTER TABLE ONLY processos.protocolos_etapas
    ADD CONSTRAINT protocolos_etapas_id_formulario_fkey FOREIGN KEY (id_formulario) REFERENCES processos.formularios(id_formulario) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: protocolos_etapas protocolos_etapas_id_protocolo_versao_fkey; Type: FK CONSTRAINT; Schema: processos; Owner: -
--

ALTER TABLE ONLY processos.protocolos_etapas
    ADD CONSTRAINT protocolos_etapas_id_protocolo_versao_fkey FOREIGN KEY (id_protocolo_versao) REFERENCES processos.protocolo_versoes(id_protocolo_versao) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: protocolos protocolos_id_pasta_fkey; Type: FK CONSTRAINT; Schema: processos; Owner: -
--

ALTER TABLE ONLY processos.protocolos
    ADD CONSTRAINT protocolos_id_pasta_fkey FOREIGN KEY (id_pasta) REFERENCES docs.pastas(id_pasta) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: protocolos protocolos_id_usuario_criador_fkey; Type: FK CONSTRAINT; Schema: processos; Owner: -
--

ALTER TABLE ONLY processos.protocolos
    ADD CONSTRAINT protocolos_id_usuario_criador_fkey FOREIGN KEY (id_usuario_criador) REFERENCES cadastro.usuarios_sistema(id_usuario_sistema) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- PostgreSQL database dump complete
--

\unrestrict LdmareDwz739WugGv6X4d12du4xyl11AE6pftN00KfNytv9afs7PeGEqHLOzGQp

