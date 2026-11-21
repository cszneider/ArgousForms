-- Carga manual única para o ambiente de desenvolvimento já inicializado.
-- Executar após adequar-estrutura-documentos e ajuste-gestao-documentos.
-- Substituir o UUID abaixo se o responsável pela instalação for outro usuário.
-- A instalação automática futura fará as mesmas gravações na transação inicial.
BEGIN;

DO $carga$
DECLARE
    v_id_instalador uuid := '745fdcb8-0303-4f1b-932b-9d5b24dfa108';
    v_id_raiz uuid;
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM Cadastro.USUARIOS_SISTEMA
         WHERE ID_USUARIO_SISTEMA = v_id_instalador AND DT_EXCLUSAO IS NULL
    ) THEN
        RAISE EXCEPTION 'Usuário responsável pela instalação não encontrado ou excluído.';
    END IF;

    IF NOT EXISTS (
        SELECT 1
          FROM Cadastro.USUARIO_PERFIS up
          JOIN Cadastro.PERFIS pf ON pf.ID_PERFIL = up.ID_PERFIL
          JOIN Cadastro.PERFIL_PAPEIS pp ON pp.ID_PERFIL = pf.ID_PERFIL
          JOIN Cadastro.PAPEIS p ON p.ID_PAPEL = pp.ID_PAPEL
         WHERE up.ID_USUARIO_SISTEMA = v_id_instalador
           AND up.DT_REVOGACAO IS NULL
           AND (up.DT_INICIO_VIGENCIA IS NULL OR up.DT_INICIO_VIGENCIA <= now())
           AND (up.DT_FIM_VIGENCIA IS NULL OR up.DT_FIM_VIGENCIA > now())
           AND pf.SN_ATIVO AND pf.DT_EXCLUSAO IS NULL
           AND pp.DT_EXCLUSAO IS NULL
           AND p.CD_PAPEL = 'GESTAO_DOCUMENTOS' AND p.SN_ATIVO AND p.DT_EXCLUSAO IS NULL
    ) THEN
        RAISE EXCEPTION 'O usuário precisa do papel GESTAO_DOCUMENTOS antes de ser gestor da RAIZ.';
    END IF;

    IF EXISTS (SELECT 1 FROM Docs.PASTAS WHERE ID_PASTA_PAI IS NULL) THEN
        RAISE EXCEPTION 'A pasta RAIZ já existe; esta carga é única.';
    END IF;

    INSERT INTO Docs.PASTAS
        (ID_PASTA, ID_PASTA_PAI, DS_NOME, DS_DESCRICAO,
         ID_USUARIO_CRIOU, DT_INCLUSAO, DT_ALTERACAO)
    VALUES
        (gen_random_uuid(), NULL, 'RAIZ', 'Pasta principal da gestão de documentos',
         v_id_instalador, now(), now())
    RETURNING ID_PASTA INTO v_id_raiz;

    INSERT INTO Docs.PASTA_GESTORES
        (ID_PASTA_GESTOR, ID_PASTA, ID_USUARIO_SISTEMA, DT_INICIO, ID_USUARIO_NOMEOU)
    VALUES
        (gen_random_uuid(), v_id_raiz, v_id_instalador, now(), v_id_instalador);

    RAISE NOTICE 'Pasta RAIZ criada: %; primeiro gestor: %', v_id_raiz, v_id_instalador;
END;
$carga$;

COMMIT;
