/*
Created		01/07/2026
Modified		13/10/2026
Project		
Model		
Company		
Author		
Version		
Database		PostgreSQL 7 
*/

BEGIN;
CREATE SCHEMA IF NOT EXISTS Cadastro;
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
DROP TABLE IF EXISTS Cadastro.VINCULO_TAGS;
DROP TABLE IF EXISTS Cadastro.USUARIO_TAGS;
DROP TABLE IF EXISTS Cadastro.GRUPO_TAGS;
DROP TABLE IF EXISTS Cadastro.TAGS;
DROP TABLE IF EXISTS Cadastro.USUARIO_GRUPOS;
DROP TABLE IF EXISTS Cadastro.GRUPOS;
DROP TABLE IF EXISTS Cadastro.PESSOA_IDENTIFICACOES;
DROP TABLE IF EXISTS Cadastro.TIPOS_IDENTIFICACAO;
DROP TABLE IF EXISTS Cadastro.PESSOA_NACIONALIDADES;
DROP TABLE IF EXISTS Cadastro.PAISES;
DROP TABLE IF EXISTS Cadastro.USUARIO_PERFIS;
DROP TABLE IF EXISTS Cadastro.HISTORICO_LOGINS;
DROP TABLE IF EXISTS Cadastro.USUARIO_ORIGENS_LOGIN;
DROP TABLE IF EXISTS Cadastro.CONFIRMACOES_EMAIL;
DROP TABLE IF EXISTS Cadastro.USUARIOS_SISTEMA;
DROP TABLE IF EXISTS Cadastro.PESSOAS;
DROP TABLE IF EXISTS Cadastro.INSTITUICAO;
DROP TABLE IF EXISTS Cadastro.ORIGENS_LOGIN;
DROP TABLE IF EXISTS Cadastro.PERFIL_PERMISSOES;
DROP TABLE IF EXISTS Cadastro.PERFIL_PAPEIS;
DROP TABLE IF EXISTS Cadastro.PERFIS;
DROP TABLE IF EXISTS Cadastro.PAPEL_PERMISSOES;
DROP TABLE IF EXISTS Cadastro.PAPEIS;
DROP TABLE IF EXISTS Cadastro.PERMISSOES;
DROP TABLE IF EXISTS Cadastro.PROGRAMAS;

Create table  Cadastro.USUARIOS_SISTEMA
(
	ID_USUARIO_SISTEMA UUID NOT NULL,
	ID_PESSOA UUID NOT NULL UNIQUE ,
	DS_NOME Varchar(200) NOT NULL,
	DS_EMAIL Varchar(120) NOT NULL UNIQUE ,
	CD_HASH_SENHA Varchar(255) NULL ,
	DT_NASCIMENTO Timestamp NULL ,
	DT_INCLUSAO Timestamp NOT NULL,
	DT_EXCLUSAO Timestamp NULL ,
 primary key (ID_USUARIO_SISTEMA)
);

Create table  Cadastro.HISTORICO_LOGINS
(
	ID_LOGIN UUID NOT NULL,
	ID_USUARIO_ORIGEM_LOGIN UUID NOT NULL,
	CD_BEARER_SHA256 Varchar(64) NOT NULL Constraint uk_historico_logins_bearer UNIQUE ,
	DT_LOGIN Timestamp NOT NULL Default CURRENT_TIMESTAMP,
	DT_VALIDADE Timestamp NOT NULL Default CURRENT_TIMESTAMP + INTERVAL '7 days',
	DT_ULTIMO_ACESSO Timestamp NULL ,
	DT_REVOGACAO Timestamp NULL ,
	DS_ENDERECO_IP Varchar(45) NOT NULL,
	DS_USER_AGENT Text NOT NULL,
	DS_DADOS_NAVEGADOR JSONB NULL ,
 primary key (ID_LOGIN)
);

Create table  Cadastro.PROGRAMAS
(
	ID_PROGRAMA UUID NOT NULL,
	ID_PROGRAMA_PAI UUID NULL ,
	CD_PROGRAMA Varchar(70) NOT NULL Constraint uk_programas_codigo UNIQUE ,
	DS_NOME Varchar(120) NOT NULL,
	DS_DESCRICAO Text NOT NULL,
	TP_PROGRAMA Char(1) NOT NULL,
	DS_ROTA_INTERFACE Varchar(200) NULL ,
	SN_ATIVO Boolean NOT NULL Default TRUE,
	DT_INCLUSAO Timestamp NOT NULL Default CURRENT_TIMESTAMP,
	DT_ALTERACAO Timestamp NOT NULL Default CURRENT_TIMESTAMP,
	DT_EXCLUSAO Timestamp NULL ,
 primary key (ID_PROGRAMA)
);

Create table  Cadastro.PERMISSOES
(
	ID_PERMISSAO UUID NOT NULL,
	ID_PROGRAMA UUID NOT NULL,
	CD_PERMISSAO Varchar(120) NOT NULL Constraint uk_permissoes_codigo UNIQUE ,
	DS_NOME Varchar(120) NOT NULL,
	DS_DESCRICAO Text NOT NULL,
	CD_ACAO Varchar(30) NOT NULL,
	SN_SENSIVEL Boolean NOT NULL Default FALSE,
	SN_REQUER_CONFIRMACAO Boolean NOT NULL Default FALSE,
	SN_ATIVA Boolean NOT NULL Default TRUE,
	DT_INCLUSAO Timestamp NOT NULL Default CURRENT_TIMESTAMP,
	DT_ALTERACAO Timestamp NOT NULL Default CURRENT_TIMESTAMP,
	DT_EXCLUSAO Timestamp NULL ,
 primary key (ID_PERMISSAO)
);

Create table  Cadastro.PAPEIS
(
	ID_PAPEL UUID NOT NULL,
	CD_PAPEL Varchar(70) NOT NULL Constraint uk_papeis_codigo UNIQUE ,
	DS_NOME Varchar(120) NOT NULL,
	DS_DESCRICAO Text NOT NULL,
	SN_SISTEMA Boolean NOT NULL Default FALSE,
	SN_ATIVO Boolean NOT NULL Default TRUE,
	DT_INCLUSAO Timestamp NOT NULL Default CURRENT_TIMESTAMP,
	DT_ALTERACAO Timestamp NOT NULL Default CURRENT_TIMESTAMP,
	DT_EXCLUSAO Timestamp NULL ,
 primary key (ID_PAPEL)
);

Create table  Cadastro.PAPEL_PERMISSOES
(
	ID_PAPEL_PERMISSAO UUID NOT NULL,
	ID_PAPEL UUID NOT NULL,
	ID_PERMISSAO UUID NOT NULL,
	DT_INCLUSAO Timestamp NOT NULL Default CURRENT_TIMESTAMP,
	DT_EXCLUSAO Timestamp NULL ,
 primary key (ID_PAPEL_PERMISSAO)
);

Create table  Cadastro.PERFIS
(
	ID_PERFIL UUID NOT NULL,
	CD_PERFIL Varchar(70) NOT NULL Constraint uk_perfis_codigo UNIQUE ,
	DS_NOME Varchar(120) NOT NULL,
	DS_DESCRICAO Text NOT NULL,
	SN_SISTEMA Boolean NOT NULL Default FALSE,
	SN_ATIVO Boolean NOT NULL Default TRUE,
	DT_INCLUSAO Timestamp NOT NULL Default CURRENT_TIMESTAMP,
	DT_ALTERACAO Timestamp NOT NULL Default CURRENT_TIMESTAMP,
	DT_EXCLUSAO Timestamp NULL ,
 primary key (ID_PERFIL)
);

Create table  Cadastro.PERFIL_PAPEIS
(
	ID_PERFIL_PAPEL UUID NOT NULL,
	ID_PERFIL UUID NOT NULL,
	ID_PAPEL UUID NOT NULL,
	DT_INCLUSAO Timestamp NOT NULL Default CURRENT_TIMESTAMP,
	DT_EXCLUSAO Timestamp NULL ,
 primary key (ID_PERFIL_PAPEL)
);

Create table  Cadastro.PERFIL_PERMISSOES
(
	ID_PERFIL_PERMISSAO UUID NOT NULL,
	ID_PERFIL UUID NOT NULL,
	ID_PERMISSAO UUID NOT NULL,
	TP_EFEITO Char(1) NOT NULL Constraint ck_perfil_permissoes_efeito Check (TP_EFEITO IN ('C','N') ),
	DS_JUSTIFICATIVA Text NULL ,
	DT_INCLUSAO Timestamp NOT NULL Default CURRENT_TIMESTAMP,
	DT_EXCLUSAO Timestamp NULL ,
 primary key (ID_PERFIL_PERMISSAO)
);

Create table  Cadastro.USUARIO_PERFIS
(
	ID_USUARIO_PERFIL UUID NOT NULL,
	ID_USUARIO_SISTEMA UUID NOT NULL,
	ID_PERFIL UUID NOT NULL,
	DT_INCLUSAO Timestamp NOT NULL Default CURRENT_TIMESTAMP,
	DT_INICIO_VIGENCIA Timestamp NULL ,
	DT_FIM_VIGENCIA Timestamp NULL ,
	DT_REVOGACAO Timestamp NULL ,
 primary key (ID_USUARIO_PERFIL)
);

Create table  Cadastro.ORIGENS_LOGIN
(
	ID_ORIGEM_LOGIN UUID NOT NULL,
	CD_ORIGEM Smallint NOT NULL UNIQUE ,
	DS_NOME Varchar(120) NOT NULL,
	DS_DESCRICAO Text NOT NULL,
	TP_AUTENTICACAO Char(1) NOT NULL,
	SN_PERMITE_AUTOCADASTRO Boolean NOT NULL,
	SN_ATIVA Boolean NOT NULL,
	DT_INCLUSAO Timestamp NOT NULL,
	DT_ALTERACAO Timestamp NOT NULL,
	DT_EXCLUSAO Timestamp NULL ,
 primary key (ID_ORIGEM_LOGIN)
);

Create table  Cadastro.USUARIO_ORIGENS_LOGIN
(
	ID_USUARIO_ORIGEM_LOGIN UUID NOT NULL,
	ID_USUARIO_SISTEMA UUID NOT NULL,
	ID_ORIGEM_LOGIN UUID NOT NULL,
	CD_USUARIO_NA_ORIGEM Varchar(255) NOT NULL,
	DS_EMAIL_ORIGEM Varchar(320) NULL ,
	SN_EMAIL_VERIFICADO Boolean NOT NULL,
	DT_INCLUSAO Timestamp NOT NULL,
	DT_ULTIMO_LOGIN Timestamp NULL ,
	DT_REVOGACAO Timestamp NULL ,
 primary key (ID_USUARIO_ORIGEM_LOGIN)
);

Create table  Cadastro.INSTITUICAO
(
	ID_INSTITUICAO Smallint NOT NULL Default 1 Constraint ck_instituicoes_registro_unico Check (ID_INSTITUICAO = 1 ),
	DS_NOME Varchar(200) NOT NULL,
	NR_DIAS_PERMANENCIA_LIXEIRA Integer NOT NULL Default 30,
	NR_TAMANHO_MAXIMO_ARQUIVO_BYTES Integer NOT NULL Default 33554432 Constraint ck_instituicao_tamanho_maximo_positivo Check (NR_TAMANHO_MAXIMO_ARQUIVO_BYTES > 0),
	DT_INCLUSAO Timestamp NOT NULL,
	DT_ALTERACAO Timestamp NOT NULL,
 primary key (ID_INSTITUICAO)
);

Create table  Cadastro.CONFIRMACOES_EMAIL
(
	ID_CONFIRMACAO_EMAIL UUID NOT NULL,
	ID_USUARIO_SISTEMA UUID NOT NULL,
	DS_EMAIL Varchar(120) NOT NULL,
	CD_HASH_TOKEN Varchar(64) NOT NULL,
	DT_INCLUSAO Timestamp NOT NULL,
	DT_VALIDADE Timestamp NOT NULL,
	DT_CONFIRMACAO Timestamp NULL ,
	DT_REVOGACAO Timestamp NULL ,
	NR_TENTATIVAS_INVALIDAS Smallint NOT NULL Default 0,
 primary key (ID_CONFIRMACAO_EMAIL)
);

Create table  Cadastro.PESSOAS
(
	ID_PESSOA UUID NOT NULL,
	DS_NOME_PESSOA Varchar(255) NOT NULL,
	DS_NOME_SOCIAL Varchar(255) NULL ,
	TP_SEXO Char(1) NULL ,
	DS_END_EMAIL Varchar(120) NULL ,
	DS_TELEFONE Varchar(30) NULL ,
	DT_NASCIMENTO Timestamp NULL ,
	DT_INCLUSAO Timestamp NOT NULL,
	DT_EXCLUSAO Timestamp NULL ,
 primary key (ID_PESSOA)
);

Create table  Cadastro.PAISES
(
	ID_PAIS Serial NOT NULL,
	CD_ISO_2 Char(2) NOT NULL,
	CD_ISO_3 Char(3) NOT NULL,
	DS_NOME Varchar(100) NOT NULL,
	DS_NOME_OFICIAL Varchar(150) NOT NULL,
	CD_TELEFONE Varchar(10) NOT NULL,
	CD_MOEDA Char(3) NOT NULL,
	CD_IDIOMA Varchar(20) NOT NULL,
	DS_CAPITAL Varchar(100) NOT NULL,
	SN_ATIVO Boolean NOT NULL,
	DT_INCLUSAO Timestamp NOT NULL,
 primary key (ID_PAIS)
);

Create table  Cadastro.PESSOA_NACIONALIDADES
(
	ID_PESSOA UUID NOT NULL,
	ID_PAIS Integer NOT NULL,
 primary key (ID_PESSOA,ID_PAIS)
);

Create table  Cadastro.TIPOS_IDENTIFICACAO
(
	ID_TIPO_IDENTIFICACAO Serial NOT NULL,
	ID_PAIS Integer NOT NULL,
	CD_TIPO Varchar(10) NOT NULL,
	DS_NOME Varchar(70) NOT NULL,
	DS_DESCRICAO Varchar(255) NULL ,
	CD_REGEX Varchar(50) NOT NULL,
	DS_MASCARA Varchar(30) NULL ,
	SN_ATIVO Boolean NOT NULL,
	DT_INCLUSAO Timestamp NOT NULL,
	DT_ALTERACAO Timestamp NOT NULL,
 primary key (ID_TIPO_IDENTIFICACAO)
);

Create table  Cadastro.PESSOA_IDENTIFICACOES
(
	ID_PESSOA UUID NOT NULL,
	ID_TIPO_IDENTIFICACAO Integer NOT NULL,
	ID_PAIS Integer NOT NULL,
	CD_IDENTIFICACAO Varchar(70) NOT NULL,
	DT_INCLUSAO Timestamp NOT NULL,
 primary key (ID_PESSOA,ID_TIPO_IDENTIFICACAO)
);

Create table  Cadastro.GRUPOS
(
	ID_GRUPO Serial NOT NULL,
	DS_NOME_GRUPO Varchar(50) NOT NULL,
	SN_ATIVO Boolean NOT NULL,
	DT_INCLUSAO Timestamp NOT NULL,
	DT_ALTERACAO Timestamp NOT NULL,
 primary key (ID_GRUPO)
);

Create table  Cadastro.USUARIO_GRUPOS
(
	ID_USUARIO_SISTEMA UUID NOT NULL,
	ID_GRUPO Integer NOT NULL,
	SN_ATIVO Boolean NOT NULL,
	DT_INCLUSAO Timestamp NOT NULL,
	DT_ALTERACAO Timestamp NOT NULL,
 primary key (ID_USUARIO_SISTEMA,ID_GRUPO)
);

Create table  Cadastro.TAGS
(
	CD_TAG Varchar(30) NOT NULL,
	DS_TAG Varchar(255) NULL ,
	SN_GRUPO Boolean NOT NULL,
	SN_USUARIO Boolean NOT NULL,
	SN_VINCULO Boolean NOT NULL,
	SN_ATIVA Boolean NOT NULL,
	DT_INCLUSAO Timestamp NOT NULL,
	DT_ALTERACAO Timestamp NOT NULL,
 primary key (CD_TAG)
);

Create table  Cadastro.GRUPO_TAGS
(
	ID_GRUPO Integer NOT NULL,
	CD_TAG Varchar(30) NOT NULL,
	SN_ATIVA Boolean NOT NULL,
	DT_INCLUSAO Timestamp NOT NULL,
	DT_ALTERACAO Timestamp NOT NULL,
 primary key (ID_GRUPO,CD_TAG)
);

Create table  Cadastro.USUARIO_TAGS
(
	ID_USUARIO_SISTEMA UUID NOT NULL,
	CD_TAG Varchar(30) NOT NULL,
	SN_ATIVA Boolean NOT NULL,
	DT_INCLUSAO Timestamp NOT NULL,
	DT_ALTERACAO Timestamp NOT NULL,
 primary key (ID_USUARIO_SISTEMA,CD_TAG)
);

Create table  Cadastro.VINCULO_TAGS
(
	ID_USUARIO_SISTEMA UUID NOT NULL,
	ID_GRUPO Integer NOT NULL,
	CD_TAG Varchar(30) NOT NULL,
	SN_ATIVO Boolean NOT NULL,
	DT_INCLUSAO Timestamp NOT NULL,
	DT_ALTERACAO Timestamp NOT NULL,
 primary key (ID_USUARIO_SISTEMA,ID_GRUPO,CD_TAG)
);

Create unique index porEmail on Cadastro.USUARIOS_SISTEMA (DS_EMAIL);

Create unique index PorPapelPermissao on Cadastro.PAPEL_PERMISSOES (ID_PAPEL,ID_PERMISSAO);

Create unique index porPerfilPapel on Cadastro.PERFIL_PAPEIS (ID_PERFIL,ID_PAPEL);

Create unique index PorPerfilPermissao on Cadastro.PERFIL_PERMISSOES (ID_PERFIL,ID_PERMISSAO);

Create unique index PorUsuarioPerfil on Cadastro.USUARIO_PERFIS (ID_USUARIO_SISTEMA,ID_PERFIL);

Create unique index porIDUsuarioOrigem on Cadastro.USUARIO_ORIGENS_LOGIN (CD_USUARIO_NA_ORIGEM,ID_ORIGEM_LOGIN);

Create unique index TipoNoPais on Cadastro.TIPOS_IDENTIFICACAO (ID_PAIS,CD_TIPO);

Create unique index PessoaPais on Cadastro.PESSOA_IDENTIFICACOES (ID_PESSOA,ID_PAIS);
Create unique index IdentificacaoPorPais on Cadastro.PESSOA_IDENTIFICACOES (ID_PAIS,CD_IDENTIFICACAO);

Alter table Cadastro.USUARIO_PERFIS add  foreign key (ID_USUARIO_SISTEMA) references Cadastro.USUARIOS_SISTEMA (ID_USUARIO_SISTEMA)  on update restrict  on delete restrict ;
Alter table Cadastro.USUARIO_ORIGENS_LOGIN add  foreign key (ID_USUARIO_SISTEMA) references Cadastro.USUARIOS_SISTEMA (ID_USUARIO_SISTEMA)  on update restrict  on delete restrict ;
Alter table Cadastro.CONFIRMACOES_EMAIL add  foreign key (ID_USUARIO_SISTEMA) references Cadastro.USUARIOS_SISTEMA (ID_USUARIO_SISTEMA)  on update restrict  on delete restrict ;
Alter table Cadastro.USUARIO_GRUPOS add  foreign key (ID_USUARIO_SISTEMA) references Cadastro.USUARIOS_SISTEMA (ID_USUARIO_SISTEMA)  on update restrict  on delete restrict ;
Alter table Cadastro.USUARIO_TAGS add  foreign key (ID_USUARIO_SISTEMA) references Cadastro.USUARIOS_SISTEMA (ID_USUARIO_SISTEMA)  on update restrict  on delete restrict ;
Alter table Cadastro.PROGRAMAS add  foreign key (ID_PROGRAMA_PAI) references Cadastro.PROGRAMAS (ID_PROGRAMA)  on update restrict  on delete restrict ;
Alter table Cadastro.PERMISSOES add  foreign key (ID_PROGRAMA) references Cadastro.PROGRAMAS (ID_PROGRAMA)  on update restrict  on delete restrict ;
Alter table Cadastro.PAPEL_PERMISSOES add  foreign key (ID_PERMISSAO) references Cadastro.PERMISSOES (ID_PERMISSAO)  on update restrict  on delete restrict ;
Alter table Cadastro.PERFIL_PERMISSOES add  foreign key (ID_PERMISSAO) references Cadastro.PERMISSOES (ID_PERMISSAO)  on update restrict  on delete restrict ;
Alter table Cadastro.PAPEL_PERMISSOES add  foreign key (ID_PAPEL) references Cadastro.PAPEIS (ID_PAPEL)  on update restrict  on delete restrict ;
Alter table Cadastro.PERFIL_PAPEIS add  foreign key (ID_PAPEL) references Cadastro.PAPEIS (ID_PAPEL)  on update restrict  on delete restrict ;
Alter table Cadastro.PERFIL_PAPEIS add  foreign key (ID_PERFIL) references Cadastro.PERFIS (ID_PERFIL)  on update restrict  on delete restrict ;
Alter table Cadastro.PERFIL_PERMISSOES add  foreign key (ID_PERFIL) references Cadastro.PERFIS (ID_PERFIL)  on update restrict  on delete restrict ;
Alter table Cadastro.USUARIO_PERFIS add  foreign key (ID_PERFIL) references Cadastro.PERFIS (ID_PERFIL)  on update restrict  on delete restrict ;
Alter table Cadastro.USUARIO_ORIGENS_LOGIN add  foreign key (ID_ORIGEM_LOGIN) references Cadastro.ORIGENS_LOGIN (ID_ORIGEM_LOGIN)  on update restrict  on delete restrict ;
Alter table Cadastro.HISTORICO_LOGINS add  foreign key (ID_USUARIO_ORIGEM_LOGIN) references Cadastro.USUARIO_ORIGENS_LOGIN (ID_USUARIO_ORIGEM_LOGIN)  on update restrict  on delete restrict ;
Alter table Cadastro.USUARIOS_SISTEMA add  foreign key (ID_PESSOA) references Cadastro.PESSOAS (ID_PESSOA)  on update restrict  on delete restrict ;
Alter table Cadastro.PESSOA_NACIONALIDADES add  foreign key (ID_PESSOA) references Cadastro.PESSOAS (ID_PESSOA)  on update restrict  on delete restrict ;
Alter table Cadastro.PESSOA_IDENTIFICACOES add  foreign key (ID_PESSOA) references Cadastro.PESSOAS (ID_PESSOA)  on update restrict  on delete restrict ;
Alter table Cadastro.PESSOA_NACIONALIDADES add  foreign key (ID_PAIS) references Cadastro.PAISES (ID_PAIS)  on update restrict  on delete restrict ;
Alter table Cadastro.TIPOS_IDENTIFICACAO add  foreign key (ID_PAIS) references Cadastro.PAISES (ID_PAIS)  on update restrict  on delete restrict ;
Alter table Cadastro.PESSOA_IDENTIFICACOES add  foreign key (ID_PAIS) references Cadastro.PAISES (ID_PAIS)  on update restrict  on delete restrict ;
Alter table Cadastro.PESSOA_IDENTIFICACOES add  foreign key (ID_TIPO_IDENTIFICACAO) references Cadastro.TIPOS_IDENTIFICACAO (ID_TIPO_IDENTIFICACAO)  on update restrict  on delete restrict ;
Alter table Cadastro.USUARIO_GRUPOS add  foreign key (ID_GRUPO) references Cadastro.GRUPOS (ID_GRUPO)  on update restrict  on delete restrict ;
Alter table Cadastro.GRUPO_TAGS add  foreign key (ID_GRUPO) references Cadastro.GRUPOS (ID_GRUPO)  on update restrict  on delete restrict ;
Alter table Cadastro.VINCULO_TAGS add  foreign key (ID_USUARIO_SISTEMA,ID_GRUPO) references Cadastro.USUARIO_GRUPOS (ID_USUARIO_SISTEMA,ID_GRUPO)  on update restrict  on delete restrict ;
Alter table Cadastro.GRUPO_TAGS add  foreign key (CD_TAG) references Cadastro.TAGS (CD_TAG)  on update restrict  on delete restrict ;
Alter table Cadastro.USUARIO_TAGS add  foreign key (CD_TAG) references Cadastro.TAGS (CD_TAG)  on update restrict  on delete restrict ;
Alter table Cadastro.VINCULO_TAGS add  foreign key (CD_TAG) references Cadastro.TAGS (CD_TAG)  on update restrict  on delete restrict ;

-- Executar a estrutura com um proprietário distinto do usuário da aplicação.
REVOKE CREATE ON SCHEMA Cadastro FROM PUBLIC;
REVOKE CREATE ON SCHEMA Cadastro FROM carlos;
REVOKE TRIGGER ON ALL TABLES IN SCHEMA Cadastro FROM carlos;
GRANT USAGE ON SCHEMA Cadastro TO carlos;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA Cadastro TO carlos;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA Cadastro TO carlos;

-- Aplica-se apenas aos objetos criados futuramente pelo papel que executa este DDL.
ALTER DEFAULT PRIVILEGES IN SCHEMA Cadastro
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO carlos;
ALTER DEFAULT PRIVILEGES IN SCHEMA Cadastro
    GRANT USAGE, SELECT ON SEQUENCES TO carlos;

COMMIT;
