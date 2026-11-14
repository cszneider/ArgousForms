-- Aplicação manual na instalação existente. Não atribui o perfil a usuários.
BEGIN;
INSERT INTO Cadastro.PAPEIS (ID_PAPEL, CD_PAPEL, DS_NOME, DS_DESCRICAO, SN_SISTEMA, SN_ATIVO, DT_INCLUSAO)
VALUES (gen_random_uuid(), 'DESENVOLVEDOR', 'Desenvolvedor', 'Testa e consulta a documentação das integrações', true, true, now())
ON CONFLICT (CD_PAPEL) DO NOTHING;
INSERT INTO Cadastro.PERFIS (ID_PERFIL, CD_PERFIL, DS_NOME, DS_DESCRICAO, SN_SISTEMA, SN_ATIVO, DT_INCLUSAO)
VALUES (gen_random_uuid(), 'DESENVOLVEDOR', 'Desenvolvedor', 'Permite testar integrações e consultar sua documentação', false, true, now())
ON CONFLICT (CD_PERFIL) DO NOTHING;
DO $ajuste$
BEGIN
    IF EXISTS (SELECT 1 FROM Cadastro.PERFIS WHERE CD_PERFIL = 'DESENVOLVEDOR' AND SN_SISTEMA) THEN
        RAISE EXCEPTION 'O perfil DESENVOLVEDOR já existe como perfil do sistema; verifique se a execução anterior foi confirmada parcialmente.';
    END IF;
END;
$ajuste$;
INSERT INTO Cadastro.PERFIL_PAPEIS (ID_PERFIL_PAPEL, ID_PERFIL, ID_PAPEL, DT_INCLUSAO)
SELECT gen_random_uuid(), perfil.ID_PERFIL, papel.ID_PAPEL, now() FROM Cadastro.PERFIS perfil
JOIN Cadastro.PAPEIS papel ON papel.CD_PAPEL = 'DESENVOLVEDOR'
WHERE perfil.CD_PERFIL = 'DESENVOLVEDOR' AND perfil.SN_SISTEMA = false AND NOT EXISTS
(SELECT 1 FROM Cadastro.PERFIL_PAPEIS vinculo WHERE vinculo.ID_PERFIL = perfil.ID_PERFIL AND vinculo.ID_PAPEL = papel.ID_PAPEL);
COMMIT;
