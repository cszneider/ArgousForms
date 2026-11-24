-- M-06 · Tags de sistema (modelo-de-dados.md). Idempotente: pode ser reexecutada.
-- Executar com o proprietário do esquema Cadastro, depois de regras/validar-alteracao-tags.sql.
-- Se já existir uma tag com o mesmo código, ela passa a ser de sistema; o nome exibido escolhido pela empresa é mantido.
BEGIN;

INSERT INTO Cadastro.TAGS (CD_TAG, DS_TAG, SN_GRUPO, SN_USUARIO, SN_VINCULO, SN_ATIVA, DT_INCLUSAO, DT_ALTERACAO, SN_SISTEMA, DS_NOME_EXIBICAO)
VALUES
    ('departamento', 'Marca os grupos que são setores da estrutura da empresa.', true,  false, false, true, now(), now(), true, 'Departamento'),
    ('lotacao',      'Setor oficial da pessoa; só em departamento e no máximo uma por pessoa. Define o grupo de origem dos processos.', false, false, true, true, now(), now(), true, 'Lotação'),
    ('gestor',       'Gestor do grupo.', false, false, true, true, now(), now(), true, 'Gestor'),
    ('substituto',   'Substituto designado no grupo; acionado quando o prazo de uma etapa vence.', false, false, true, true, now(), now(), true, 'Substituto'),
    ('supervisor',   'Nível intermediário entre o gestor e a equipe.', false, false, true, true, now(), now(), true, 'Supervisor')
ON CONFLICT (CD_TAG) DO UPDATE SET
    DS_TAG = EXCLUDED.DS_TAG,
    SN_GRUPO = EXCLUDED.SN_GRUPO,
    SN_USUARIO = EXCLUDED.SN_USUARIO,
    SN_VINCULO = EXCLUDED.SN_VINCULO,
    SN_ATIVA = true,
    SN_SISTEMA = true,
    DS_NOME_EXIBICAO = COALESCE(Cadastro.TAGS.DS_NOME_EXIBICAO, EXCLUDED.DS_NOME_EXIBICAO),
    DT_ALTERACAO = CASE WHEN Cadastro.TAGS.SN_SISTEMA THEN Cadastro.TAGS.DT_ALTERACAO ELSE now() END;

COMMIT;
