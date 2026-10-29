-- Carga complementar para instalação que já criou ADMINISTRADOR,
-- ADMINISTRADOR_USUARIOS, GESTOR_ACESSOS e INSTALADOR.
-- Não executar junto com banco/carga-manual-teste.sql.
-- Não atribui permissões concretas: PAPEL_PERMISSOES será definido depois.
BEGIN;

DO $carga$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM Cadastro.PERFIS WHERE CD_PERFIL = 'ADMINISTRADOR') THEN
        RAISE EXCEPTION 'Crie primeiro o perfil ADMINISTRADOR.';
    END IF;

    IF EXISTS (
        SELECT 1 FROM Cadastro.PAPEIS
         WHERE CD_PAPEL IN ('AUTOGESTAO', 'CONSULTA_DOCUMENTOS', 'EDITOR_DE_DOCUMENTOS',
                            'GESTOR_GRUPOS_TAGS', 'GESTAO_DOCUMENTOS', 'MODELADOR', 'ANALISTA_INDICADORES')
    ) OR EXISTS (
        SELECT 1 FROM Cadastro.PERFIS
         WHERE CD_PERFIL IN ('ESSENCIAL', 'PARTICIPANTE', 'MODELADOR', 'GESTOR')
    ) THEN
        RAISE EXCEPTION 'A carga de papéis e perfis operacionais já foi iniciada nesta instalação.';
    END IF;
END;
$carga$;

INSERT INTO Cadastro.PAPEIS
    (ID_PAPEL, CD_PAPEL, DS_NOME, DS_DESCRICAO, SN_SISTEMA, SN_ATIVO, DT_INCLUSAO)
VALUES
    (gen_random_uuid(), 'AUTOGESTAO', 'Autogestão', 'Consulta suas pendências e mantém os próprios dados', true, true, now()),
    (gen_random_uuid(), 'CONSULTA_DOCUMENTOS', 'Consulta de documentos', 'Acessa documentos conforme as permissões de cada documento', true, true, now()),
    (gen_random_uuid(), 'EDITOR_DE_DOCUMENTOS', 'Editor de documentos', 'Inicia documentos elegíveis e edita etapas atribuídas', true, true, now()),
    (gen_random_uuid(), 'GESTOR_GRUPOS_TAGS', 'Gestor de grupos e tags', 'Administra grupos, vínculos e tags', true, true, now()),
    (gen_random_uuid(), 'GESTAO_DOCUMENTOS', 'Gestão de documentos', 'Gerencia as pastas para as quais foi nomeado gestor', true, true, now()),
    (gen_random_uuid(), 'MODELADOR', 'Modelador', 'Cria e altera modelos de documentos e fluxos', true, true, now()),
    (gen_random_uuid(), 'ANALISTA_INDICADORES', 'Analista de indicadores', 'Consulta indicadores autorizados', true, true, now());

INSERT INTO Cadastro.PERFIS
    (ID_PERFIL, CD_PERFIL, DS_NOME, DS_DESCRICAO, SN_SISTEMA, SN_ATIVO, DT_INCLUSAO)
VALUES
    (gen_random_uuid(), 'ESSENCIAL', 'Essencial', 'Acesso pessoal comum a todos os usuários', true, true, now()),
    (gen_random_uuid(), 'PARTICIPANTE', 'Participante', 'Inicia documentos elegíveis e edita etapas atribuídas', true, true, now()),
    (gen_random_uuid(), 'MODELADOR', 'Modelador', 'Cria e altera modelos', true, true, now()),
    (gen_random_uuid(), 'GESTOR', 'Gestor', 'Consulta indicadores autorizados', true, true, now());

INSERT INTO Cadastro.PERFIL_PAPEIS
    (ID_PERFIL_PAPEL, ID_PERFIL, ID_PAPEL, DT_INCLUSAO)
SELECT gen_random_uuid(), perfil.ID_PERFIL, papel.ID_PAPEL, now()
  FROM (VALUES
      ('ADMINISTRADOR', 'GESTOR_GRUPOS_TAGS'),
      ('ADMINISTRADOR', 'GESTAO_DOCUMENTOS'),
      ('ESSENCIAL', 'AUTOGESTAO'),
      ('ESSENCIAL', 'CONSULTA_DOCUMENTOS'),
      ('PARTICIPANTE', 'EDITOR_DE_DOCUMENTOS'),
      ('MODELADOR', 'MODELADOR'),
      ('GESTOR', 'ANALISTA_INDICADORES')
  ) AS vinculo(CD_PERFIL, CD_PAPEL)
  JOIN Cadastro.PERFIS perfil ON perfil.CD_PERFIL = vinculo.CD_PERFIL
  JOIN Cadastro.PAPEIS papel ON papel.CD_PAPEL = vinculo.CD_PAPEL;

COMMIT;
