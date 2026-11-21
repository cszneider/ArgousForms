-- Acrescenta o papel padrão à instalação existente, preservando UUIDs e vínculos.
-- Executar como proprietário do esquema Cadastro, após validar-papeis-perfis.sql.
-- A trigger de composição do perfil padrão é suspensa somente nesta transação.
BEGIN;

DO $ajuste$
DECLARE
    v_id_perfil uuid;
    v_id_papel uuid;
    v_estado_trigger char(1);
BEGIN
    SELECT ID_PERFIL INTO v_id_perfil
      FROM Cadastro.PERFIS
     WHERE CD_PERFIL = 'ADMINISTRADOR' AND SN_ATIVO AND DT_EXCLUSAO IS NULL;
    IF v_id_perfil IS NULL THEN
        RAISE EXCEPTION 'Perfil ADMINISTRADOR ativo não encontrado.';
    END IF;

    INSERT INTO Cadastro.PAPEIS
        (ID_PAPEL, CD_PAPEL, DS_NOME, DS_DESCRICAO, SN_SISTEMA, SN_ATIVO, DT_INCLUSAO)
    SELECT gen_random_uuid(), 'GESTAO_DOCUMENTOS', 'Gestão de documentos',
           'Gerencia as pastas para as quais foi nomeado gestor', true, true, now()
     WHERE NOT EXISTS (SELECT 1 FROM Cadastro.PAPEIS WHERE CD_PAPEL = 'GESTAO_DOCUMENTOS');

    SELECT ID_PAPEL INTO v_id_papel
      FROM Cadastro.PAPEIS
     WHERE CD_PAPEL = 'GESTAO_DOCUMENTOS' AND SN_ATIVO AND DT_EXCLUSAO IS NULL;
    IF v_id_papel IS NULL THEN
        RAISE EXCEPTION 'Papel GESTAO_DOCUMENTOS ativo não encontrado.';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM Cadastro.PERFIL_PAPEIS
         WHERE ID_PERFIL = v_id_perfil AND ID_PAPEL = v_id_papel AND DT_EXCLUSAO IS NULL
    ) THEN
        SELECT tgenabled INTO v_estado_trigger
          FROM pg_trigger
         WHERE tgrelid = 'Cadastro.PERFIL_PAPEIS'::regclass
           AND tgname = 'trg_validar_perfil_papel';

        IF v_estado_trigger IS NOT NULL AND v_estado_trigger <> 'D' THEN
            ALTER TABLE Cadastro.PERFIL_PAPEIS DISABLE TRIGGER trg_validar_perfil_papel;
        END IF;

        INSERT INTO Cadastro.PERFIL_PAPEIS
            (ID_PERFIL_PAPEL, ID_PERFIL, ID_PAPEL, DT_INCLUSAO)
        VALUES (gen_random_uuid(), v_id_perfil, v_id_papel, now());

        IF v_estado_trigger = 'O' THEN
            ALTER TABLE Cadastro.PERFIL_PAPEIS ENABLE TRIGGER trg_validar_perfil_papel;
        ELSIF v_estado_trigger = 'R' THEN
            ALTER TABLE Cadastro.PERFIL_PAPEIS ENABLE REPLICA TRIGGER trg_validar_perfil_papel;
        ELSIF v_estado_trigger = 'A' THEN
            ALTER TABLE Cadastro.PERFIL_PAPEIS ENABLE ALWAYS TRIGGER trg_validar_perfil_papel;
        END IF;
    END IF;
END;
$ajuste$;

COMMIT;
