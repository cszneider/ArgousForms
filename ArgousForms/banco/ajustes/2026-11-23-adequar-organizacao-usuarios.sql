-- Ajuste da base atual: organização (M-06) e pessoas × usuários (M-16). 23/11/2026.
-- Roda em qualquer cliente (psql, DBeaver): não usa comandos do psql. Executar como script, com o proprietário dos esquemas.
-- Idempotente: pode ser reexecutado. Não apaga dados, exceto as colunas DS_NOME e DT_NASCIMENTO de USUARIOS_SISTEMA,
-- depois de copiar para PESSOAS o que só existia no usuário.
--
-- Depois deste ajuste, executar, nesta ordem:
--   regras/validar-alteracao-tags.sql   (protege as tags de sistema)
--   regras/validar-organizacao.sql      (hierarquia e lotação; novo)
--   cargas/carga-tags-sistema.sql       (cria ou promove as cinco tags de sistema)
BEGIN;

-- 1. PESSOAS: nascimento como data, inclusão/exclusão com fuso, foto.
DO $$
DECLARE diferentes Integer;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'cadastro'
              AND table_name = 'usuarios_sistema' AND column_name = 'ds_nome') THEN
    -- O nome e o nascimento da pessoa prevalecem; o do usuário só preenche o que falta.
    UPDATE Cadastro.PESSOAS p SET DT_NASCIMENTO = u.DT_NASCIMENTO
      FROM Cadastro.USUARIOS_SISTEMA u
     WHERE u.ID_PESSOA = p.ID_PESSOA AND p.DT_NASCIMENTO IS NULL AND u.DT_NASCIMENTO IS NOT NULL;
    SELECT count(*) INTO diferentes FROM Cadastro.USUARIOS_SISTEMA u JOIN Cadastro.PESSOAS p ON p.ID_PESSOA = u.ID_PESSOA
     WHERE u.DS_NOME IS DISTINCT FROM p.DS_NOME_PESSOA;
    IF diferentes > 0 THEN
      RAISE NOTICE '% usuário(s) com nome diferente da pessoa: vale o nome da pessoa.', diferentes;
    END IF;
  END IF;
END $$;

DO $$
BEGIN
  IF (SELECT data_type FROM information_schema.columns WHERE table_schema = 'cadastro'
       AND table_name = 'pessoas' AND column_name = 'dt_nascimento') <> 'date' THEN
    -- +12h: datas gravadas com deslocamento de fuso (ex.: 21h do dia anterior) voltam ao dia certo.
    ALTER TABLE Cadastro.PESSOAS ALTER COLUMN DT_NASCIMENTO TYPE Date USING (DT_NASCIMENTO + interval '12 hours')::date;
  END IF;
END $$;
ALTER TABLE Cadastro.PESSOAS ALTER COLUMN DT_INCLUSAO TYPE Timestamp with time zone;
ALTER TABLE Cadastro.PESSOAS ALTER COLUMN DT_EXCLUSAO TYPE Timestamp with time zone;
ALTER TABLE Cadastro.PESSOAS ADD COLUMN IF NOT EXISTS ID_FOTO UUID NULL;

-- 2. USUARIOS_SISTEMA: só dados de acesso.
ALTER TABLE Cadastro.USUARIOS_SISTEMA DROP COLUMN IF EXISTS DS_NOME;
ALTER TABLE Cadastro.USUARIOS_SISTEMA DROP COLUMN IF EXISTS DT_NASCIMENTO;
ALTER TABLE Cadastro.USUARIOS_SISTEMA ADD COLUMN IF NOT EXISTS DS_CELULAR Varchar(30) NULL;
ALTER TABLE Cadastro.USUARIOS_SISTEMA ADD COLUMN IF NOT EXISTS SN_EMAIL_INSTITUCIONAL Boolean NOT NULL DEFAULT true;
ALTER TABLE Cadastro.USUARIOS_SISTEMA ADD COLUMN IF NOT EXISTS SN_CELULAR_INSTITUCIONAL Boolean NOT NULL DEFAULT false;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uk_usuarios_celular') THEN
    ALTER TABLE Cadastro.USUARIOS_SISTEMA ADD CONSTRAINT uk_usuarios_celular UNIQUE (DS_CELULAR);
  END IF;
END $$;
DROP INDEX IF EXISTS Cadastro.porEmail;   -- duplicava o UNIQUE da coluna

-- 3. CONFIRMACOES_EMAIL: e-mail ou celular.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'cadastro'
              AND table_name = 'confirmacoes_email' AND column_name = 'ds_email') THEN
    ALTER TABLE Cadastro.CONFIRMACOES_EMAIL RENAME COLUMN DS_EMAIL TO DS_DESTINO;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'cadastro'
              AND table_name = 'confirmacoes_email' AND column_name = 'tp_canal') THEN
    ALTER TABLE Cadastro.CONFIRMACOES_EMAIL ADD COLUMN TP_CANAL Char(1) NOT NULL DEFAULT 'E'
      CONSTRAINT ck_confirmacoes_canal CHECK (TP_CANAL IN ('E', 'C'));
  END IF;
END $$;

-- 4. GRUPOS: superior.
ALTER TABLE Cadastro.GRUPOS ADD COLUMN IF NOT EXISTS ID_GRUPO_SUPERIOR Integer NULL;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_grupo_superior') THEN
    ALTER TABLE Cadastro.GRUPOS ADD CONSTRAINT ck_grupo_superior CHECK (ID_GRUPO_SUPERIOR IS NULL OR ID_GRUPO_SUPERIOR <> ID_GRUPO);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'grupos_id_grupo_superior_fkey') THEN
    ALTER TABLE Cadastro.GRUPOS ADD CONSTRAINT grupos_id_grupo_superior_fkey FOREIGN KEY (ID_GRUPO_SUPERIOR)
      REFERENCES Cadastro.GRUPOS (ID_GRUPO) ON UPDATE RESTRICT ON DELETE RESTRICT;
  END IF;
END $$;

-- 5. TAGS: sistema, nome exibido, aviso de dado sensível.
ALTER TABLE Cadastro.TAGS ADD COLUMN IF NOT EXISTS SN_SISTEMA Boolean NOT NULL DEFAULT false;
ALTER TABLE Cadastro.TAGS ADD COLUMN IF NOT EXISTS DS_NOME_EXIBICAO Varchar(60) NULL;
ALTER TABLE Cadastro.TAGS ADD COLUMN IF NOT EXISTS SN_RESTRITA Boolean NOT NULL DEFAULT false;

-- 6. Lotação única por usuário. Se já houver duas lotações ativas para alguém, o ajuste para aqui.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM Cadastro.VINCULO_TAGS WHERE CD_TAG = 'lotacao' AND SN_ATIVO
              GROUP BY ID_USUARIO_SISTEMA HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'Há usuários com mais de uma lotação ativa. Corrija antes de aplicar este ajuste.';
  END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS LotacaoUnicaPorUsuario ON Cadastro.VINCULO_TAGS (ID_USUARIO_SISTEMA)
  WHERE CD_TAG = 'lotacao' AND SN_ATIVO;

-- 7. PROCESSOS: grupo de origem. Processos já existentes ficam com origem nula (não há como saber a lotação da época).
ALTER TABLE Processos.PROCESSOS ADD COLUMN IF NOT EXISTS ID_GRUPO_ORIGEM Integer NULL;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'processos_id_grupo_origem_fkey') THEN
    ALTER TABLE Processos.PROCESSOS ADD CONSTRAINT processos_id_grupo_origem_fkey FOREIGN KEY (ID_GRUPO_ORIGEM)
      REFERENCES Cadastro.GRUPOS (ID_GRUPO) ON UPDATE RESTRICT ON DELETE RESTRICT;
  END IF;
END $$;

-- Mesma função e gatilho de regras/validar-processos.sql (aquele script não pode ser reexecutado inteiro).
-- M-06: grupo de origem = lotação de quem iniciou, gravada no INSERT e imutável.
-- O valor enviado pela aplicação é ignorado; numa alteração, o valor anterior é mantido.
CREATE OR REPLACE FUNCTION Processos.definir_grupo_origem() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    NEW.ID_GRUPO_ORIGEM := OLD.ID_GRUPO_ORIGEM;
    RETURN NEW;
  END IF;
  SELECT vt.ID_GRUPO INTO NEW.ID_GRUPO_ORIGEM
    FROM Cadastro.VINCULO_TAGS vt
   WHERE vt.ID_USUARIO_SISTEMA = NEW.ID_USUARIO_INICIOU AND vt.CD_TAG = 'lotacao' AND vt.SN_ATIVO;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_definir_grupo_origem ON Processos.PROCESSOS;
CREATE TRIGGER trg_definir_grupo_origem BEFORE INSERT OR UPDATE OF ID_GRUPO_ORIGEM ON Processos.PROCESSOS
FOR EACH ROW EXECUTE FUNCTION Processos.definir_grupo_origem();

COMMENT ON COLUMN Cadastro.USUARIOS_SISTEMA.DS_EMAIL IS 'E-mail de login (obrigatório e único).';
COMMENT ON COLUMN Cadastro.USUARIOS_SISTEMA.DS_CELULAR IS 'Celular para convite e códigos; único quando preenchido.';
COMMENT ON COLUMN Cadastro.USUARIOS_SISTEMA.SN_EMAIL_INSTITUCIONAL IS 'Verdadeiro: só a empresa altera o e-mail. Falso: o usuário altera, com confirmação por código.';
COMMENT ON COLUMN Cadastro.USUARIOS_SISTEMA.SN_CELULAR_INSTITUCIONAL IS 'Verdadeiro: só a empresa altera o celular. Falso: o usuário altera, com confirmação por código.';
COMMENT ON COLUMN Cadastro.CONFIRMACOES_EMAIL.DS_DESTINO IS 'E-mail (TP_CANAL E) ou celular (TP_CANAL C) que recebe o código.';
COMMENT ON COLUMN Cadastro.PESSOAS.ID_FOTO IS 'Foto: _id da imagem no armazenamento de arquivos (GridFS), fora da árvore de Documentos. Sem FK; a aplicação cuida da integridade.';
COMMENT ON COLUMN Cadastro.GRUPOS.ID_GRUPO_SUPERIOR IS 'M-06: só em grupo departamento, e o superior também é departamento; sem ciclos (regras/validar-organizacao.sql).';
COMMENT ON COLUMN Cadastro.TAGS.SN_SISTEMA IS 'Tag usada pelo sistema (cargas/carga-tags-sistema.sql): não se exclui nem desativa; só DS_NOME_EXIBICAO muda.';
COMMENT ON COLUMN Cadastro.TAGS.DS_NOME_EXIBICAO IS 'Nome mostrado nas telas, no vocabulário da empresa (ex.: Coordenador para gestor).';
COMMENT ON COLUMN Cadastro.TAGS.SN_RESTRITA IS 'Aviso de dado sensível (LGPD) nas telas que aplicam ou mostram a tag; sem controle de visibilidade na v1.';
COMMENT ON COLUMN Processos.PROCESSOS.ID_GRUPO_ORIGEM IS 'M-06: lotação de quem iniciou, gravada pelo banco no INSERT (Processos.definir_grupo_origem); imutável. Nula se a pessoa não tinha lotação.';

COMMIT;
