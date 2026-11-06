-- Executar como proprietário do esquema Cadastro na instalação existente.
-- Se a trigger de proteção já existir, sua suspensão fica restrita à transação.
BEGIN;

INSERT INTO Cadastro.PAPEIS (ID_PAPEL, CD_PAPEL, DS_NOME, DS_DESCRICAO, SN_SISTEMA, SN_ATIVO, DT_INCLUSAO)
SELECT gen_random_uuid(), 'ADMINISTRADOR_INSTITUICAO', 'Administrador da instituição', 'Mantém os dados e recursos compartilhados da instituição', true, true, now()
WHERE NOT EXISTS (SELECT 1 FROM Cadastro.PAPEIS WHERE CD_PAPEL = 'ADMINISTRADOR_INSTITUICAO');

DO $ajuste$
DECLARE
    v_estado_trigger char(1);
BEGIN
    SELECT tgenabled INTO v_estado_trigger
      FROM pg_trigger
     WHERE tgrelid = 'Cadastro.PERFIL_PAPEIS'::regclass
       AND tgname = 'trg_validar_perfil_papel';

    IF v_estado_trigger IS NOT NULL AND v_estado_trigger <> 'D' THEN
        ALTER TABLE Cadastro.PERFIL_PAPEIS DISABLE TRIGGER trg_validar_perfil_papel;
    END IF;

    INSERT INTO Cadastro.PERFIL_PAPEIS (ID_PERFIL_PAPEL, ID_PERFIL, ID_PAPEL, DT_INCLUSAO)
    SELECT gen_random_uuid(), perfil.ID_PERFIL, papel.ID_PAPEL, now()
    FROM Cadastro.PERFIS perfil JOIN Cadastro.PAPEIS papel ON papel.CD_PAPEL = 'ADMINISTRADOR_INSTITUICAO'
    WHERE perfil.CD_PERFIL = 'ADMINISTRADOR' AND perfil.DT_EXCLUSAO IS NULL AND papel.DT_EXCLUSAO IS NULL
    AND NOT EXISTS (SELECT 1 FROM Cadastro.PERFIL_PAPEIS vinculo WHERE vinculo.ID_PERFIL = perfil.ID_PERFIL AND vinculo.ID_PAPEL = papel.ID_PAPEL AND vinculo.DT_EXCLUSAO IS NULL);

    IF v_estado_trigger = 'O' THEN
        ALTER TABLE Cadastro.PERFIL_PAPEIS ENABLE TRIGGER trg_validar_perfil_papel;
    ELSIF v_estado_trigger = 'R' THEN
        ALTER TABLE Cadastro.PERFIL_PAPEIS ENABLE REPLICA TRIGGER trg_validar_perfil_papel;
    ELSIF v_estado_trigger = 'A' THEN
        ALTER TABLE Cadastro.PERFIL_PAPEIS ENABLE ALWAYS TRIGGER trg_validar_perfil_papel;
    END IF;
END;
$ajuste$;

COMMIT;
