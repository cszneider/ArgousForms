-- Aplicar manualmente no banco de desenvolvimento que já recebeu a carga anterior.
-- Preserva os UUIDs existentes e o histórico: os papéis substituídos são inativados.
-- Não executar a carga inicial novamente.
BEGIN;

DO $ajuste$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM Cadastro.PERFIS WHERE CD_PERFIL = 'ADMINISTRADOR')
       OR NOT EXISTS (SELECT 1 FROM Cadastro.PERFIS WHERE CD_PERFIL = 'PARTICIPANTE') THEN
        RAISE EXCEPTION 'Perfis ADMINISTRADOR e PARTICIPANTE são necessários para este ajuste.';
    END IF;
END;
$ajuste$;

INSERT INTO Cadastro.PAPEIS
    (ID_PAPEL, CD_PAPEL, DS_NOME, DS_DESCRICAO, SN_SISTEMA, SN_ATIVO, DT_INCLUSAO)
VALUES
    (gen_random_uuid(), 'AUTOGESTAO', 'Autogestão', 'Consulta suas pendências e mantém os próprios dados', true, true, now()),
    (gen_random_uuid(), 'CONSULTA_DOCUMENTOS', 'Consulta de documentos', 'Acessa documentos conforme as permissões de cada documento', true, true, now()),
    (gen_random_uuid(), 'EDITOR_DE_DOCUMENTOS', 'Editor de documentos', 'Inicia documentos elegíveis e edita etapas atribuídas', true, true, now()),
    (gen_random_uuid(), 'GESTOR_GRUPOS_TAGS', 'Gestor de grupos e tags', 'Administra grupos, vínculos e tags', true, true, now())
ON CONFLICT (CD_PAPEL) DO NOTHING;

INSERT INTO Cadastro.PERFIS
    (ID_PERFIL, CD_PERFIL, DS_NOME, DS_DESCRICAO, SN_SISTEMA, SN_ATIVO, DT_INCLUSAO)
VALUES
    (gen_random_uuid(), 'ESSENCIAL', 'Essencial', 'Acesso pessoal comum a todos os usuários', true, true, now())
ON CONFLICT (CD_PERFIL) DO NOTHING;

UPDATE Cadastro.PERFIS
   SET DS_DESCRICAO = 'Inicia documentos elegíveis e edita etapas atribuídas',
       DT_ALTERACAO = now()
 WHERE CD_PERFIL = 'PARTICIPANTE';

INSERT INTO Cadastro.PERFIL_PAPEIS
    (ID_PERFIL_PAPEL, ID_PERFIL, ID_PAPEL, DT_INCLUSAO)
SELECT gen_random_uuid(), perfil.ID_PERFIL, papel.ID_PAPEL, now()
  FROM (VALUES
      ('ADMINISTRADOR', 'GESTOR_GRUPOS_TAGS'),
      ('ESSENCIAL', 'AUTOGESTAO'),
      ('ESSENCIAL', 'CONSULTA_DOCUMENTOS'),
      ('PARTICIPANTE', 'EDITOR_DE_DOCUMENTOS')
  ) AS vinculo(CD_PERFIL, CD_PAPEL)
  JOIN Cadastro.PERFIS perfil ON perfil.CD_PERFIL = vinculo.CD_PERFIL
  JOIN Cadastro.PAPEIS papel ON papel.CD_PAPEL = vinculo.CD_PAPEL
 WHERE NOT EXISTS (
     SELECT 1 FROM Cadastro.PERFIL_PAPEIS atual
      WHERE atual.ID_PERFIL = perfil.ID_PERFIL AND atual.ID_PAPEL = papel.ID_PAPEL
 );

INSERT INTO Cadastro.USUARIO_PERFIS
    (ID_USUARIO_PERFIL, ID_USUARIO_SISTEMA, ID_PERFIL, DT_INCLUSAO, DT_INICIO_VIGENCIA)
SELECT gen_random_uuid(), usuario.ID_USUARIO_SISTEMA, essencial.ID_PERFIL, now(), now()
  FROM Cadastro.USUARIOS_SISTEMA usuario
 CROSS JOIN Cadastro.PERFIS essencial
 WHERE essencial.CD_PERFIL = 'ESSENCIAL'
   AND NOT EXISTS (
       SELECT 1 FROM Cadastro.USUARIO_PERFIS atual
        WHERE atual.ID_USUARIO_SISTEMA = usuario.ID_USUARIO_SISTEMA
          AND atual.ID_PERFIL = essencial.ID_PERFIL
   );

UPDATE Cadastro.PERFIL_PAPEIS vinculo
   SET DT_EXCLUSAO = COALESCE(vinculo.DT_EXCLUSAO, now())
  FROM Cadastro.PAPEIS papel
 WHERE vinculo.ID_PAPEL = papel.ID_PAPEL
   AND papel.CD_PAPEL IN ('INICIADOR_PROCESSOS', 'EXECUTOR_ETAPAS');

UPDATE Cadastro.PAPEIS
   SET SN_ATIVO = false,
       DT_EXCLUSAO = COALESCE(DT_EXCLUSAO, now()),
       DT_ALTERACAO = now()
 WHERE CD_PAPEL IN ('INICIADOR_PROCESSOS', 'EXECUTOR_ETAPAS');

COMMIT;
