-- Executar uma única vez em cada instalação, após a criação das tabelas.
-- Não atribui permissões: PAPEL_PERMISSOES será definido em etapa posterior.
BEGIN;

DO $carga$
DECLARE
    v_perfil_participante uuid;
    v_perfil_modelador uuid;
    v_perfil_gestor uuid;
    v_papel_iniciador uuid;
    v_papel_executor uuid;
    v_papel_modelador uuid;
    v_papel_analista uuid;
BEGIN
    IF EXISTS (
        SELECT 1 FROM Cadastro.PAPEIS
        WHERE CD_PAPEL IN ('INICIADOR_PROCESSOS', 'EXECUTOR_ETAPAS', 'MODELADOR', 'ANALISTA_INDICADORES')
    ) OR EXISTS (
        SELECT 1 FROM Cadastro.PERFIS
        WHERE CD_PERFIL IN ('PARTICIPANTE', 'MODELADOR', 'GESTOR')
    ) THEN
        RAISE EXCEPTION 'A carga de papéis e perfis operacionais já foi iniciada nesta instalação.';
    END IF;

    INSERT INTO Cadastro.PAPEIS
        (ID_PAPEL, CD_PAPEL, DS_NOME, DS_DESCRICAO, SN_SISTEMA, SN_ATIVO, DT_INCLUSAO)
    VALUES
        (gen_random_uuid(), 'INICIADOR_PROCESSOS', 'Iniciador de processos',
         'Inicia os processos permitidos pelas regras de cada modelo de documento', true, true, now())
    RETURNING ID_PAPEL INTO v_papel_iniciador;

    INSERT INTO Cadastro.PAPEIS
        (ID_PAPEL, CD_PAPEL, DS_NOME, DS_DESCRICAO, SN_SISTEMA, SN_ATIVO, DT_INCLUSAO)
    VALUES
        (gen_random_uuid(), 'EXECUTOR_ETAPAS', 'Executor de etapas',
         'Preenche as etapas pelas quais o usuário é responsável', true, true, now())
    RETURNING ID_PAPEL INTO v_papel_executor;

    INSERT INTO Cadastro.PAPEIS
        (ID_PAPEL, CD_PAPEL, DS_NOME, DS_DESCRICAO, SN_SISTEMA, SN_ATIVO, DT_INCLUSAO)
    VALUES
        (gen_random_uuid(), 'MODELADOR', 'Modelador',
         'Cria e altera modelos de documentos e fluxos', true, true, now())
    RETURNING ID_PAPEL INTO v_papel_modelador;

    INSERT INTO Cadastro.PAPEIS
        (ID_PAPEL, CD_PAPEL, DS_NOME, DS_DESCRICAO, SN_SISTEMA, SN_ATIVO, DT_INCLUSAO)
    VALUES
        (gen_random_uuid(), 'ANALISTA_INDICADORES', 'Analista de indicadores',
         'Consulta dashboards e estatísticas autorizados', true, true, now())
    RETURNING ID_PAPEL INTO v_papel_analista;

    INSERT INTO Cadastro.PERFIS
        (ID_PERFIL, CD_PERFIL, DS_NOME, DS_DESCRICAO, SN_SISTEMA, SN_ATIVO, DT_INCLUSAO)
    VALUES
        (gen_random_uuid(), 'PARTICIPANTE', 'Participante',
         'Perfil padrão de quem inicia processos e executa etapas atribuídas', true, true, now())
    RETURNING ID_PERFIL INTO v_perfil_participante;

    INSERT INTO Cadastro.PERFIS
        (ID_PERFIL, CD_PERFIL, DS_NOME, DS_DESCRICAO, SN_SISTEMA, SN_ATIVO, DT_INCLUSAO)
    VALUES
        (gen_random_uuid(), 'MODELADOR', 'Modelador',
         'Perfil complementar para criação e alteração de modelos', true, true, now())
    RETURNING ID_PERFIL INTO v_perfil_modelador;

    INSERT INTO Cadastro.PERFIS
        (ID_PERFIL, CD_PERFIL, DS_NOME, DS_DESCRICAO, SN_SISTEMA, SN_ATIVO, DT_INCLUSAO)
    VALUES
        (gen_random_uuid(), 'GESTOR', 'Gestor',
         'Perfil complementar para consulta de indicadores autorizados', true, true, now())
    RETURNING ID_PERFIL INTO v_perfil_gestor;

    INSERT INTO Cadastro.PERFIL_PAPEIS
        (ID_PERFIL_PAPEL, ID_PERFIL, ID_PAPEL, DT_INCLUSAO)
    VALUES
        (gen_random_uuid(), v_perfil_participante, v_papel_iniciador, now()),
        (gen_random_uuid(), v_perfil_participante, v_papel_executor, now()),
        (gen_random_uuid(), v_perfil_modelador, v_papel_modelador, now()),
        (gen_random_uuid(), v_perfil_gestor, v_papel_analista, now());
END
$carga$;

COMMIT;
