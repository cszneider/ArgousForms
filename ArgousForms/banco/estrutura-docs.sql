/*
Created		01/07/2026
Modified		15/10/2026
Project		
Model		
Company		
Author		
Version		
Database		PostgreSQL 7 
*/

BEGIN;
CREATE SCHEMA IF NOT EXISTS Docs;

DROP TABLE IF EXISTS Docs.ARQUIVO_TAGS;
DROP TABLE IF EXISTS Docs.TAGS_ARQUIVO;
DROP TABLE IF EXISTS Docs.ARQUIVOS_ATRIBUTOS;
DROP TABLE IF EXISTS Docs.ATRIBUTO_VALORES;
DROP TABLE IF EXISTS Docs.ATRIBUTOS;
DROP TABLE IF EXISTS Docs.ARQUIVO_PERMISSOES;
DROP TABLE IF EXISTS Docs.ARQUIVO_VERSOES;
DROP TABLE IF EXISTS Docs.ARQUIVOS;
DROP TABLE IF EXISTS Docs.PASTA_PERMISSOES;
DROP TABLE IF EXISTS Docs.PASTA_GESTORES;
DROP TABLE IF EXISTS Docs.PASTAS;

Create table  Docs.PASTAS
(
	ID_PASTA UUID NOT NULL,
	ID_PASTA_PAI UUID NULL ,
	DS_NOME Varchar(255) NOT NULL,
	DS_DESCRICAO Text NULL ,
	ID_USUARIO_CRIOU UUID NOT NULL,
	DT_INCLUSAO Timestamp with time zone NOT NULL,
	DT_ALTERACAO Timestamp with time zone NOT NULL Check (DT_ALTERACAO >= DT_INCLUSAO ),
	DT_LIXEIRA Timestamp with time zone NULL ,
	DT_EXCLUSAO Timestamp NULL ,
 primary key (ID_PASTA)
);

-- Somente uma pasta pode representar a RAIZ da instalação.
CREATE UNIQUE INDEX uq_pastas_raiz ON Docs.PASTAS ((true)) WHERE ID_PASTA_PAI IS NULL;

Create table  Docs.PASTA_GESTORES
(
	ID_PASTA_GESTOR UUID NOT NULL,
	ID_PASTA UUID NOT NULL,
	ID_USUARIO_SISTEMA UUID NOT NULL,
	DT_INICIO Timestamp with time zone NOT NULL,
	DT_EXCLUSAO Timestamp with time zone NULL ,
	ID_USUARIO_NOMEOU UUID NOT NULL,
	ID_USUARIO_REVOGOU UUID NULL ,
 primary key (ID_PASTA_GESTOR)
);

Create table  Docs.PASTA_PERMISSOES
(
	ID_PASTA_PERMISSAO UUID NOT NULL,
	ID_PASTA UUID NOT NULL,
	TP_ACAO Char(1) NOT NULL,
	TP_DESTINATARIO Char(1) NOT NULL,
	ID_USUARIO_SISTEMA UUID NULL ,
	ID_GRUPO Integer NULL ,
	CD_TAG Varchar(30) NULL ,
	DT_INICIO Timestamp with time zone NOT NULL,
	DT_FIM Timestamp with time zone NULL ,
	ID_USUARIO_CONCEDEU UUID NOT NULL,
	ID_USUARIO_REVOGOU UUID NULL ,
 primary key (ID_PASTA_PERMISSAO)
);

Create table  Docs.ARQUIVOS
(
	ID_ARQUIVO UUID NOT NULL,
	ID_PASTA UUID NOT NULL,
	DS_NOME_ARQUIVO Varchar(255) NOT NULL,
	DS_TITULO Varchar(255) NOT NULL,
	DS_DESCRICAO Text NULL ,
	TP_CLASSIFICACAO Char(1) NOT NULL,
	DT_VENCIMENTO Timestamp with time zone NULL ,
	DT_INCLUSAO Timestamp with time zone NOT NULL,
	DT_LIXEIRA Timestamp with time zone NULL ,
	DT_EXCLUSAO Timestamp with time zone NULL ,
	CD_CONTENT_TYPE Varchar(255) NULL ,
 primary key (ID_ARQUIVO)
);

Create table  Docs.ARQUIVO_VERSOES
(
	ID_ARQUIVO_VERSAO UUID NOT NULL,
	ID_ARQUIVO UUID NOT NULL,
	ID_USUARIO_INCLUIU UUID NOT NULL,
	NR_VERSAO Integer NOT NULL,
	NR_TAMANHO_BYTES BigInt NOT NULL,
	CD_HASH_SHA256 Char(64) NOT NULL,
	TP_ORIGEM Char(1) NOT NULL,
	DT_INCLUSAO Timestamp with time zone NOT NULL,
 primary key (ID_ARQUIVO_VERSAO)
);

CREATE UNIQUE INDEX uq_arquivos_nome_ativo
    ON Docs.ARQUIVOS (ID_PASTA, DS_NOME_ARQUIVO)
    WHERE DT_LIXEIRA IS NULL AND DT_EXCLUSAO IS NULL;
CREATE UNIQUE INDEX uq_arquivo_versoes_numero
    ON Docs.ARQUIVO_VERSOES (ID_ARQUIVO, NR_VERSAO);

Create table  Docs.ARQUIVO_PERMISSOES
(
	ID_ARQUIVO_PERMISSAO UUID NOT NULL,
	ID_ARQUIVO UUID NOT NULL,
	TP_DESTINATARIO Char(1) NOT NULL Check (TP_DESTINATARIO in ( 'U', 'G', 'T' ) ),
	ID_USUARIO_SISTEMA UUID NULL ,
	ID_GRUPO Integer NULL ,
	CD_TAG Varchar(30) NULL ,
	DT_INICIO Timestamp with time zone NOT NULL,
	DT_FIM Timestamp with time zone NULL ,
	ID_USUARIO_CONCEDEU UUID NOT NULL,
	ID_USUARIO_REVOGOU UUID NULL ,
 primary key (ID_ARQUIVO_PERMISSAO)
);

Create table  Docs.ATRIBUTOS
(
	ID_ATRIBUTO UUID NOT NULL,
	DS_NOME Varchar(100) NOT NULL,
	DS_DESCRICAO Text NULL ,
	SN_ATIVO Boolean NOT NULL,
	DT_INCLUSAO Timestamp NOT NULL,
	DT_ULTIMA_ALTERACAO Timestamp NOT NULL,
	ID_USUARIO_CRIOU UUID NOT NULL,
 primary key (ID_ATRIBUTO)
);

Create table  Docs.ATRIBUTO_VALORES
(
	ID_ATRIBUTO_VALOR UUID NOT NULL,
	ID_ATRIBUTO UUID NOT NULL,
	DS_VALOR Varchar(255) NOT NULL,
	NR_ORDEM Smallint NOT NULL,
	SN_ATIVO Boolean NOT NULL,
 primary key (ID_ATRIBUTO_VALOR)
);

Create table  Docs.ARQUIVOS_ATRIBUTOS
(
	ID_ARQUIVO UUID NOT NULL,
	ID_ATRIBUTO UUID NOT NULL,
	ID_ATRIBUTO_VALOR UUID NOT NULL,
	DT_ALTERACAO Timestamp NOT NULL,
	ID_USUARIO_ALTEROU UUID NOT NULL,
 primary key (ID_ARQUIVO,ID_ATRIBUTO)
);

Create table  Docs.TAGS_ARQUIVO
(
	CD_TAG Varchar(60) NOT NULL,
	DS_DESCRICAO Varchar(255) NULL ,
	DT_INCLUSAO Timestamp with time zone NOT NULL,
 primary key (CD_TAG)
);

Create table  Docs.ARQUIVO_TAGS
(
	ID_ARQUIVO UUID NOT NULL,
	CD_TAG Varchar(60) NOT NULL,
	DT_ASSOCIACAO Timestamp with time zone NOT NULL,
	ID_USUARIO_ASSOCIOU UUID NOT NULL,
	DT_REMOCAO Timestamp with time zone NULL ,
	ID_USUARIO_REMOVEU UUID NULL ,
 primary key (ID_ARQUIVO,CD_TAG)
);

Alter table Docs.PASTAS add  foreign key (ID_USUARIO_CRIOU) references Cadastro.USUARIOS_SISTEMA (ID_USUARIO_SISTEMA)  on update restrict  on delete restrict ;
Alter table Docs.PASTA_GESTORES add  foreign key (ID_USUARIO_NOMEOU) references Cadastro.USUARIOS_SISTEMA (ID_USUARIO_SISTEMA)  on update restrict  on delete restrict ;
Alter table Docs.PASTA_GESTORES add  foreign key (ID_USUARIO_SISTEMA) references Cadastro.USUARIOS_SISTEMA (ID_USUARIO_SISTEMA)  on update restrict  on delete restrict ;
Alter table Docs.PASTA_GESTORES add  foreign key (ID_USUARIO_REVOGOU) references Cadastro.USUARIOS_SISTEMA (ID_USUARIO_SISTEMA)  on update restrict  on delete restrict ;
Alter table Docs.PASTA_PERMISSOES add  foreign key (ID_USUARIO_SISTEMA) references Cadastro.USUARIOS_SISTEMA (ID_USUARIO_SISTEMA)  on update restrict  on delete restrict ;
Alter table Docs.PASTA_PERMISSOES add  foreign key (ID_USUARIO_CONCEDEU) references Cadastro.USUARIOS_SISTEMA (ID_USUARIO_SISTEMA)  on update restrict  on delete restrict ;
Alter table Docs.PASTA_PERMISSOES add  foreign key (ID_USUARIO_REVOGOU) references Cadastro.USUARIOS_SISTEMA (ID_USUARIO_SISTEMA)  on update restrict  on delete restrict ;
Alter table Docs.ARQUIVO_VERSOES add  foreign key (ID_USUARIO_INCLUIU) references Cadastro.USUARIOS_SISTEMA (ID_USUARIO_SISTEMA)  on update restrict  on delete restrict ;
Alter table Docs.ARQUIVO_PERMISSOES add  foreign key (ID_USUARIO_SISTEMA) references Cadastro.USUARIOS_SISTEMA (ID_USUARIO_SISTEMA)  on update restrict  on delete restrict ;
Alter table Docs.ARQUIVO_PERMISSOES add  foreign key (ID_USUARIO_CONCEDEU) references Cadastro.USUARIOS_SISTEMA (ID_USUARIO_SISTEMA)  on update restrict  on delete restrict ;
Alter table Docs.ARQUIVO_PERMISSOES add  foreign key (ID_USUARIO_REVOGOU) references Cadastro.USUARIOS_SISTEMA (ID_USUARIO_SISTEMA)  on update restrict  on delete restrict ;
Alter table Docs.ATRIBUTOS add  foreign key (ID_USUARIO_CRIOU) references Cadastro.USUARIOS_SISTEMA (ID_USUARIO_SISTEMA)  on update restrict  on delete restrict ;
Alter table Docs.ARQUIVOS_ATRIBUTOS add  foreign key (ID_USUARIO_ALTEROU) references Cadastro.USUARIOS_SISTEMA (ID_USUARIO_SISTEMA)  on update restrict  on delete restrict ;
Alter table Docs.ARQUIVO_TAGS add  foreign key (ID_USUARIO_ASSOCIOU) references Cadastro.USUARIOS_SISTEMA (ID_USUARIO_SISTEMA)  on update restrict  on delete restrict ;
Alter table Docs.ARQUIVO_TAGS add  foreign key (ID_USUARIO_REMOVEU) references Cadastro.USUARIOS_SISTEMA (ID_USUARIO_SISTEMA)  on update restrict  on delete restrict ;

Alter table Docs.PASTA_PERMISSOES add  foreign key (ID_GRUPO) references Cadastro.GRUPOS (ID_GRUPO)  on update restrict  on delete restrict ;

Alter table Docs.PASTA_PERMISSOES add  foreign key (CD_TAG) references Cadastro.TAGS (CD_TAG)  on update restrict  on delete restrict ;
Alter table Docs.PASTAS add  foreign key (ID_PASTA_PAI) references Docs.PASTAS (ID_PASTA)  on update restrict  on delete restrict ;
Alter table Docs.PASTA_GESTORES add  foreign key (ID_PASTA) references Docs.PASTAS (ID_PASTA)  on update restrict  on delete restrict ;
Alter table Docs.PASTA_PERMISSOES add  foreign key (ID_PASTA) references Docs.PASTAS (ID_PASTA)  on update restrict  on delete restrict ;
Alter table Docs.ARQUIVOS add  foreign key (ID_PASTA) references Docs.PASTAS (ID_PASTA)  on update restrict  on delete restrict ;
Alter table Docs.ARQUIVO_VERSOES add  foreign key (ID_ARQUIVO) references Docs.ARQUIVOS (ID_ARQUIVO)  on update restrict  on delete restrict ;
Alter table Docs.ARQUIVO_PERMISSOES add  foreign key (ID_ARQUIVO) references Docs.ARQUIVOS (ID_ARQUIVO)  on update restrict  on delete restrict ;
Alter table Docs.ARQUIVOS_ATRIBUTOS add  foreign key (ID_ARQUIVO) references Docs.ARQUIVOS (ID_ARQUIVO)  on update restrict  on delete restrict ;
Alter table Docs.ARQUIVO_TAGS add  foreign key (ID_ARQUIVO) references Docs.ARQUIVOS (ID_ARQUIVO)  on update restrict  on delete restrict ;
Alter table Docs.ATRIBUTO_VALORES add  foreign key (ID_ATRIBUTO) references Docs.ATRIBUTOS (ID_ATRIBUTO)  on update restrict  on delete restrict ;
Alter table Docs.ARQUIVOS_ATRIBUTOS add  foreign key (ID_ATRIBUTO) references Docs.ATRIBUTOS (ID_ATRIBUTO)  on update restrict  on delete restrict ;
Alter table Docs.ARQUIVOS_ATRIBUTOS add  foreign key (ID_ATRIBUTO_VALOR) references Docs.ATRIBUTO_VALORES (ID_ATRIBUTO_VALOR)  on update restrict  on delete restrict ;
Alter table Docs.ARQUIVO_TAGS add  foreign key (CD_TAG) references Docs.TAGS_ARQUIVO (CD_TAG)  on update restrict  on delete restrict ;

-- Executar a estrutura com um proprietário distinto do usuário da aplicação.
REVOKE CREATE ON SCHEMA Docs FROM PUBLIC;
REVOKE CREATE ON SCHEMA Docs FROM carlos;
REVOKE TRIGGER ON ALL TABLES IN SCHEMA Docs FROM carlos;
GRANT USAGE ON SCHEMA Docs TO carlos;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA Docs TO carlos;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA Docs TO carlos;

-- Aplica-se apenas aos objetos criados futuramente pelo papel que executa este DDL.
ALTER DEFAULT PRIVILEGES IN SCHEMA Docs
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO carlos;
ALTER DEFAULT PRIVILEGES IN SCHEMA Docs
    GRANT USAGE, SELECT ON SEQUENCES TO carlos;

COMMIT;
