-- Aplicar manualmente na instalação atual antes de testar a publicação.
-- O perfil permanece administrável para que a instituição escolha seus publicadores.
BEGIN;

INSERT INTO Cadastro.PAPEIS (ID_PAPEL, CD_PAPEL, DS_NOME, DS_DESCRICAO, SN_SISTEMA, SN_ATIVO, DT_INCLUSAO)
VALUES (gen_random_uuid(), 'GESTOR_DE_PROTOCOLOS', 'Gestor de Protocolos', 'Revisa e publica versões de Protocolos', true, true, now())
ON CONFLICT (CD_PAPEL) DO NOTHING;

INSERT INTO Cadastro.PERFIS (ID_PERFIL, CD_PERFIL, DS_NOME, DS_DESCRICAO, SN_SISTEMA, SN_ATIVO, DT_INCLUSAO)
VALUES (gen_random_uuid(), 'GESTOR_DE_PROTOCOLOS', 'Gestor de Protocolos', 'Permite revisar e publicar Protocolos', false, true, now())
ON CONFLICT (CD_PERFIL) DO NOTHING;

INSERT INTO Cadastro.PERFIL_PAPEIS (ID_PERFIL_PAPEL, ID_PERFIL, ID_PAPEL, DT_INCLUSAO)
SELECT gen_random_uuid(), perfil.ID_PERFIL, papel.ID_PAPEL, now()
FROM Cadastro.PERFIS perfil JOIN Cadastro.PAPEIS papel ON papel.CD_PAPEL = 'GESTOR_DE_PROTOCOLOS'
WHERE perfil.CD_PERFIL = 'GESTOR_DE_PROTOCOLOS' AND perfil.SN_SISTEMA = false
AND NOT EXISTS (SELECT 1 FROM Cadastro.PERFIL_PAPEIS vinculo WHERE vinculo.ID_PERFIL = perfil.ID_PERFIL AND vinculo.ID_PAPEL = papel.ID_PAPEL);

COMMIT;
