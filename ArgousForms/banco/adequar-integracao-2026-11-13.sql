-- Adequação do export CASE de 13/11/2026 à base já existente.
-- Executar uma vez, com o proprietário dos schemas, depois de conferir a modelagem.
-- Os campos de sessão mudam de INTEGER para SMALLINT: a operação aborta se houver valor > 32767.
BEGIN;

ALTER TABLE Cadastro.INSTITUICAO ADD COLUMN IF NOT EXISTS NR_DIAS_RETENCAO_LOG_INTEGRACAO Smallint NOT NULL DEFAULT 90;
ALTER TABLE Cadastro.INSTITUICAO ALTER COLUMN NR_DIAS_RETENCAO_LOG_INTEGRACAO SET DEFAULT 90;
ALTER TABLE Cadastro.INSTITUICAO ADD CONSTRAINT ck_instituicao_retencao_integracao CHECK (NR_DIAS_RETENCAO_LOG_INTEGRACAO > 0);
ALTER TABLE Cadastro.INSTITUICAO ALTER COLUMN NR_DIAS_SESSAO_MOVEL TYPE Smallint;
ALTER TABLE Cadastro.INSTITUICAO ALTER COLUMN NR_DIAS_SESSAO_ABSOLUTA TYPE Smallint;

-- Chaves de integração: o segredo cifrado e seu nonce nunca são expostos em consultas.
Create table if not exists Cadastro.CHAVES_WEBHOOK
(
	ID_WEBHOOK UUID NOT NULL,
	DS_TITULO Varchar(50) NOT NULL Check (BTRIM(DS_TITULO) <> ''),
	VL_CHAVE_CIFRADA Bytea NOT NULL,
	VL_NONCE Bytea NOT NULL,
	ID_USUARIO_INCLUSAO UUID NOT NULL,
	DT_INCLUSAO Timestamp with time zone NOT NULL,
	DT_ATIVACAO Timestamp with time zone NULL,
	DT_VENCIMENTO Timestamp with time zone NULL Check (DT_VENCIMENTO IS NULL OR DT_VENCIMENTO > DT_INCLUSAO),
	ID_USUARIO_INVALIDACAO UUID NULL,
	DT_INVALIDACAO Timestamp with time zone NULL,
	primary key (ID_WEBHOOK),
	CONSTRAINT ck_chave_webhook_invalidacao CHECK ((DT_INVALIDACAO IS NULL AND ID_USUARIO_INVALIDACAO IS NULL) OR (DT_INVALIDACAO IS NOT NULL AND ID_USUARIO_INVALIDACAO IS NOT NULL AND DT_INVALIDACAO >= DT_INCLUSAO)),
	CONSTRAINT ck_chave_webhook_ativacao CHECK (DT_ATIVACAO IS NULL OR (DT_ATIVACAO >= DT_INCLUSAO AND (DT_VENCIMENTO IS NULL OR DT_ATIVACAO < DT_VENCIMENTO)))
);

Create table if not exists Cadastro.INTEGRACAO_CONSULTAS
(
	ID_REQUISICAO UUID NOT NULL,
	DT_INICIO Timestamp with time zone NOT NULL,
	DT_FIM Timestamp with time zone NULL,
	ID_USUARIO_ORIGEM UUID NULL,
	ID_PROTOCOLO UUID NULL,
	ID_PROCESSO UUID NULL,
	TP_ORIGEM Char(1) NOT NULL Check (TP_ORIGEM IN ('U', 'S')),
	CD_ACAO Varchar(30) NOT NULL Check (BTRIM(CD_ACAO) <> ''),
	CD_CONSULTA Varchar(100) NOT NULL Check (BTRIM(CD_CONSULTA) <> ''),
	TP_RESULTADO Char(1) NOT NULL Check (TP_RESULTADO IN ('P', 'S', 'N', 'C', 'E')),
	ID_CACHE Varchar(64) NULL,
	CD_ERRO Varchar(60) NULL,
	DS_ERRO Text NULL,
	primary key (ID_REQUISICAO),
	CONSTRAINT ck_integracao_consulta_usuario CHECK (TP_ORIGEM <> 'U' OR ID_USUARIO_ORIGEM IS NOT NULL),
	CONSTRAINT ck_integracao_consulta_periodo CHECK (DT_FIM IS NULL OR DT_FIM >= DT_INICIO),
	CONSTRAINT ck_integracao_consulta_pendente CHECK ((TP_RESULTADO = 'P') = (DT_FIM IS NULL))
);

Create table if not exists Cadastro.INTEGRACAO_TENTATIVAS
(
	ID_TENTATIVA UUID NOT NULL,
	ID_REQUISICAO UUID NOT NULL,
	ID_WEBHOOK UUID NOT NULL,
	TP_DESTINO Char(1) NOT NULL Check (TP_DESTINO IN ('P', 'A')),
	DT_INICIO Timestamp with time zone NOT NULL,
	DT_FIM Timestamp with time zone NULL,
	NR_STATUS_HTTP Smallint NULL Check (NR_STATUS_HTTP IS NULL OR NR_STATUS_HTTP BETWEEN 100 AND 599),
	TP_RESULTADO Char(1) NOT NULL Check (TP_RESULTADO IN ('P', 'S', 'N', 'H', 'T', 'R', 'V')),
	CD_ERRO Varchar(60) NULL,
	DS_ERRO Text NULL,
	primary key (ID_TENTATIVA),
	CONSTRAINT ck_integracao_tentativa_periodo CHECK (DT_FIM IS NULL OR DT_FIM >= DT_INICIO),
	CONSTRAINT ck_integracao_tentativa_pendente CHECK ((TP_RESULTADO = 'P') = (DT_FIM IS NULL))
);

Create unique index if not exists chave_webhook_unica_ativa on Cadastro.CHAVES_WEBHOOK ((1)) where DT_ATIVACAO IS NOT NULL AND DT_INVALIDACAO IS NULL;
Create index if not exists tentativa_integracao_por_destino on Cadastro.INTEGRACAO_TENTATIVAS (ID_REQUISICAO, TP_DESTINO);
Create index if not exists integracao_consultas_dt_fim on Cadastro.INTEGRACAO_CONSULTAS (DT_FIM);
Create index if not exists integracao_tentativas_requisicao on Cadastro.INTEGRACAO_TENTATIVAS (ID_REQUISICAO);

-- Corrige o CHECK exportado pelo CASE, que impede a invalidação de qualquer chave.
ALTER TABLE Cadastro.CHAVES_WEBHOOK DROP CONSTRAINT IF EXISTS chaves_webhook_dt_invalidacao_check;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'Cadastro.CHAVES_WEBHOOK'::regclass AND conname = 'ck_chave_webhook_invalidacao') THEN
        ALTER TABLE Cadastro.CHAVES_WEBHOOK ADD CONSTRAINT ck_chave_webhook_invalidacao CHECK ((DT_INVALIDACAO IS NULL AND ID_USUARIO_INVALIDACAO IS NULL) OR (DT_INVALIDACAO IS NOT NULL AND ID_USUARIO_INVALIDACAO IS NOT NULL AND DT_INVALIDACAO >= DT_INCLUSAO));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'Cadastro.CHAVES_WEBHOOK'::regclass AND conname = 'ck_chave_webhook_ativacao') THEN
        ALTER TABLE Cadastro.CHAVES_WEBHOOK ADD CONSTRAINT ck_chave_webhook_ativacao CHECK (DT_ATIVACAO IS NULL OR (DT_ATIVACAO >= DT_INCLUSAO AND (DT_VENCIMENTO IS NULL OR DT_ATIVACAO < DT_VENCIMENTO)));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'Cadastro.INTEGRACAO_CONSULTAS'::regclass AND conname = 'ck_integracao_consulta_origem') THEN
        ALTER TABLE Cadastro.INTEGRACAO_CONSULTAS ADD CONSTRAINT ck_integracao_consulta_origem CHECK (TP_ORIGEM IN ('U', 'S'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'Cadastro.INTEGRACAO_CONSULTAS'::regclass AND conname = 'ck_integracao_consulta_resultado') THEN
        ALTER TABLE Cadastro.INTEGRACAO_CONSULTAS ADD CONSTRAINT ck_integracao_consulta_resultado CHECK (TP_RESULTADO IN ('P', 'S', 'N', 'C', 'E'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'Cadastro.INTEGRACAO_CONSULTAS'::regclass AND conname = 'ck_integracao_consulta_usuario') THEN
        ALTER TABLE Cadastro.INTEGRACAO_CONSULTAS ADD CONSTRAINT ck_integracao_consulta_usuario CHECK (TP_ORIGEM <> 'U' OR ID_USUARIO_ORIGEM IS NOT NULL);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'Cadastro.INTEGRACAO_CONSULTAS'::regclass AND conname = 'ck_integracao_consulta_periodo') THEN
        ALTER TABLE Cadastro.INTEGRACAO_CONSULTAS ADD CONSTRAINT ck_integracao_consulta_periodo CHECK (DT_FIM IS NULL OR DT_FIM >= DT_INICIO);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'Cadastro.INTEGRACAO_CONSULTAS'::regclass AND conname = 'ck_integracao_consulta_pendente') THEN
        ALTER TABLE Cadastro.INTEGRACAO_CONSULTAS ADD CONSTRAINT ck_integracao_consulta_pendente CHECK ((TP_RESULTADO = 'P') = (DT_FIM IS NULL));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'Cadastro.INTEGRACAO_TENTATIVAS'::regclass AND conname = 'ck_integracao_tentativa_destino') THEN
        ALTER TABLE Cadastro.INTEGRACAO_TENTATIVAS ADD CONSTRAINT ck_integracao_tentativa_destino CHECK (TP_DESTINO IN ('P', 'A'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'Cadastro.INTEGRACAO_TENTATIVAS'::regclass AND conname = 'ck_integracao_tentativa_resultado') THEN
        ALTER TABLE Cadastro.INTEGRACAO_TENTATIVAS ADD CONSTRAINT ck_integracao_tentativa_resultado CHECK (TP_RESULTADO IN ('P', 'S', 'N', 'H', 'T', 'R', 'V'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'Cadastro.INTEGRACAO_TENTATIVAS'::regclass AND conname = 'ck_integracao_tentativa_status_http') THEN
        ALTER TABLE Cadastro.INTEGRACAO_TENTATIVAS ADD CONSTRAINT ck_integracao_tentativa_status_http CHECK (NR_STATUS_HTTP IS NULL OR NR_STATUS_HTTP BETWEEN 100 AND 599);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'Cadastro.INTEGRACAO_TENTATIVAS'::regclass AND conname = 'ck_integracao_tentativa_periodo') THEN
        ALTER TABLE Cadastro.INTEGRACAO_TENTATIVAS ADD CONSTRAINT ck_integracao_tentativa_periodo CHECK (DT_FIM IS NULL OR DT_FIM >= DT_INICIO);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'Cadastro.INTEGRACAO_TENTATIVAS'::regclass AND conname = 'ck_integracao_tentativa_pendente') THEN
        ALTER TABLE Cadastro.INTEGRACAO_TENTATIVAS ADD CONSTRAINT ck_integracao_tentativa_pendente CHECK ((TP_RESULTADO = 'P') = (DT_FIM IS NULL));
    END IF;
END $$;

-- O CASE pode já ter criado as duas FKs de tentativas sem nome explícito.
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'Cadastro.CHAVES_WEBHOOK'::regclass AND confrelid = 'Cadastro.USUARIOS_SISTEMA'::regclass AND contype = 'f' AND pg_get_constraintdef(oid) LIKE 'FOREIGN KEY (id_usuario_inclusao)%') THEN
        Alter table Cadastro.CHAVES_WEBHOOK add constraint fk_chave_webhook_usuario_inclusao foreign key (ID_USUARIO_INCLUSAO) references Cadastro.USUARIOS_SISTEMA (ID_USUARIO_SISTEMA) on update restrict on delete restrict;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'Cadastro.CHAVES_WEBHOOK'::regclass AND confrelid = 'Cadastro.USUARIOS_SISTEMA'::regclass AND contype = 'f' AND pg_get_constraintdef(oid) LIKE 'FOREIGN KEY (id_usuario_invalidacao)%') THEN
        Alter table Cadastro.CHAVES_WEBHOOK add constraint fk_chave_webhook_usuario_invalidacao foreign key (ID_USUARIO_INVALIDACAO) references Cadastro.USUARIOS_SISTEMA (ID_USUARIO_SISTEMA) on update restrict on delete restrict;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'Cadastro.INTEGRACAO_CONSULTAS'::regclass AND confrelid = 'Cadastro.USUARIOS_SISTEMA'::regclass AND contype = 'f' AND pg_get_constraintdef(oid) LIKE 'FOREIGN KEY (id_usuario_origem)%') THEN
        Alter table Cadastro.INTEGRACAO_CONSULTAS add constraint fk_integracao_consulta_usuario foreign key (ID_USUARIO_ORIGEM) references Cadastro.USUARIOS_SISTEMA (ID_USUARIO_SISTEMA) on update restrict on delete restrict;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'Cadastro.INTEGRACAO_TENTATIVAS'::regclass AND confrelid = 'Cadastro.INTEGRACAO_CONSULTAS'::regclass AND contype = 'f' AND pg_get_constraintdef(oid) LIKE 'FOREIGN KEY (id_requisicao)%') THEN
        Alter table Cadastro.INTEGRACAO_TENTATIVAS add constraint fk_integracao_tentativa_consulta foreign key (ID_REQUISICAO) references Cadastro.INTEGRACAO_CONSULTAS (ID_REQUISICAO) on update restrict on delete restrict;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'Cadastro.INTEGRACAO_TENTATIVAS'::regclass AND confrelid = 'Cadastro.CHAVES_WEBHOOK'::regclass AND contype = 'f' AND pg_get_constraintdef(oid) LIKE 'FOREIGN KEY (id_webhook)%') THEN
        Alter table Cadastro.INTEGRACAO_TENTATIVAS add constraint fk_integracao_tentativa_chave foreign key (ID_WEBHOOK) references Cadastro.CHAVES_WEBHOOK (ID_WEBHOOK) on update restrict on delete restrict;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'Cadastro.INTEGRACAO_CONSULTAS'::regclass AND confrelid = 'Processos.PROTOCOLOS'::regclass AND contype = 'f' AND pg_get_constraintdef(oid) LIKE 'FOREIGN KEY (id_protocolo)%') THEN
        ALTER TABLE Cadastro.INTEGRACAO_CONSULTAS ADD CONSTRAINT fk_integracao_consulta_protocolo FOREIGN KEY (ID_PROTOCOLO) REFERENCES Processos.PROTOCOLOS (ID_PROTOCOLO) ON UPDATE RESTRICT ON DELETE RESTRICT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'Cadastro.INTEGRACAO_CONSULTAS'::regclass AND confrelid = 'Processos.PROCESSOS'::regclass AND contype = 'f' AND pg_get_constraintdef(oid) LIKE 'FOREIGN KEY (id_processo)%') THEN
        ALTER TABLE Cadastro.INTEGRACAO_CONSULTAS ADD CONSTRAINT fk_integracao_consulta_processo FOREIGN KEY (ID_PROCESSO) REFERENCES Processos.PROCESSOS (ID_PROCESSO) ON UPDATE RESTRICT ON DELETE RESTRICT;
    END IF;
END $$;

Create or replace function Cadastro.validar_ciclo_chave_webhook() returns trigger language plpgsql as $$
begin
    if TG_OP = 'DELETE' then
        raise exception 'Chaves de webhook devem ser invalidadas, não excluídas.';
    end if;

    if TG_OP = 'UPDATE' then
        if NEW.ID_WEBHOOK IS DISTINCT FROM OLD.ID_WEBHOOK
            or NEW.VL_CHAVE_CIFRADA IS DISTINCT FROM OLD.VL_CHAVE_CIFRADA
            or NEW.VL_NONCE IS DISTINCT FROM OLD.VL_NONCE
            or NEW.ID_USUARIO_INCLUSAO IS DISTINCT FROM OLD.ID_USUARIO_INCLUSAO
            or NEW.DT_INCLUSAO IS DISTINCT FROM OLD.DT_INCLUSAO
            or NEW.DT_ATIVACAO IS DISTINCT FROM OLD.DT_ATIVACAO and OLD.DT_ATIVACAO IS NOT NULL
            or NEW.DT_INVALIDACAO IS DISTINCT FROM OLD.DT_INVALIDACAO and OLD.DT_INVALIDACAO IS NOT NULL then
            raise exception 'Identidade, segredo e eventos já registrados da chave são imutáveis.';
        end if;
        if OLD.DT_INVALIDACAO IS NOT NULL and NEW.ID_USUARIO_INVALIDACAO IS DISTINCT FROM OLD.ID_USUARIO_INVALIDACAO then
            raise exception 'A invalidação da chave é definitiva.';
        end if;
    end if;

    if NEW.DT_INVALIDACAO IS NOT NULL and NEW.DT_ATIVACAO IS NOT NULL and NEW.DT_INVALIDACAO < NEW.DT_ATIVACAO then
        raise exception 'A invalidação não pode anteceder a ativação.';
    end if;
    return NEW;
end;
$$;
Drop trigger if exists trg_validar_ciclo_chave_webhook on Cadastro.CHAVES_WEBHOOK;
Create trigger trg_validar_ciclo_chave_webhook before insert or update or delete on Cadastro.CHAVES_WEBHOOK for each row execute function Cadastro.validar_ciclo_chave_webhook();

-- A rotina não é agendada pelo banco; o serviço de manutenção deve chamá-la periodicamente.
Create or replace function Cadastro.limpar_historico_integracao() returns integer language plpgsql as $$
declare
    eliminadas integer;
begin
    delete from Cadastro.INTEGRACAO_TENTATIVAS t using Cadastro.INTEGRACAO_CONSULTAS c, Cadastro.INSTITUICAO i
     where t.ID_REQUISICAO = c.ID_REQUISICAO
       and c.DT_FIM < CURRENT_TIMESTAMP - make_interval(days => i.NR_DIAS_RETENCAO_LOG_INTEGRACAO);
    delete from Cadastro.INTEGRACAO_CONSULTAS c using Cadastro.INSTITUICAO i
     where c.DT_FIM < CURRENT_TIMESTAMP - make_interval(days => i.NR_DIAS_RETENCAO_LOG_INTEGRACAO);
    get diagnostics eliminadas = ROW_COUNT;
    return eliminadas;
end;
$$;


-- A aplicação consulta os novos objetos pelo usuário carlos, conforme o DDL de instalação.
GRANT SELECT, INSERT, UPDATE, DELETE ON Cadastro.CHAVES_WEBHOOK, Cadastro.INTEGRACAO_CONSULTAS, Cadastro.INTEGRACAO_TENTATIVAS TO carlos;
COMMIT;
