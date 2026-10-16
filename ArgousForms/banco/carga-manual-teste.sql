-- Carga provisória para o banco de desenvolvimento recém-recriado.
-- Executar uma vez, após estrutura-inicial.sql e validar-pais-identificacao.sql.
-- Não executar perfis-papeis-iniciais.sql depois desta carga: seus registros já estão incluídos aqui.
-- Idioma, moeda, telefone e capital representam os valores principais escolhidos para teste.
-- Não cria instituição nem primeiro administrador; esses dados dependem da instalação concreta.
BEGIN;

DO $carga$
BEGIN
    IF EXISTS (SELECT 1 FROM Cadastro.PAISES)
       OR EXISTS (SELECT 1 FROM Cadastro.PAPEIS)
       OR EXISTS (SELECT 1 FROM Cadastro.PERFIS)
       OR EXISTS (SELECT 1 FROM Cadastro.ORIGENS_LOGIN) THEN
        RAISE EXCEPTION 'A carga manual exige as tabelas de catálogo vazias.';
    END IF;
END;
$carga$;

INSERT INTO Cadastro.PAISES
    (CD_ISO_2, CD_ISO_3, DS_NOME, DS_NOME_OFICIAL, CD_TELEFONE, CD_MOEDA, CD_IDIOMA, DS_CAPITAL, SN_ATIVO, DT_INCLUSAO)
VALUES
    ('AG', 'ATG', 'Antígua e Barbuda', 'Antígua e Barbuda', '+1268', 'XCD', 'en', 'Saint John''s', true, now()),
    ('AR', 'ARG', 'Argentina', 'República Argentina', '+54', 'ARS', 'es', 'Buenos Aires', true, now()),
    ('BS', 'BHS', 'Bahamas', 'Comunidade das Bahamas', '+1242', 'BSD', 'en', 'Nassau', true, now()),
    ('BB', 'BRB', 'Barbados', 'Barbados', '+1246', 'BBD', 'en', 'Bridgetown', true, now()),
    ('BZ', 'BLZ', 'Belize', 'Belize', '+501', 'BZD', 'en', 'Belmopan', true, now()),
    ('BO', 'BOL', 'Bolívia', 'Estado Plurinacional da Bolívia', '+591', 'BOB', 'es', 'La Paz', true, now()),
    ('BR', 'BRA', 'Brasil', 'República Federativa do Brasil', '+55', 'BRL', 'pt', 'Brasília', true, now()),
    ('CA', 'CAN', 'Canadá', 'Canadá', '+1', 'CAD', 'en', 'Ottawa', true, now()),
    ('CL', 'CHL', 'Chile', 'República do Chile', '+56', 'CLP', 'es', 'Santiago', true, now()),
    ('CO', 'COL', 'Colômbia', 'República da Colômbia', '+57', 'COP', 'es', 'Bogotá', true, now()),
    ('CR', 'CRI', 'Costa Rica', 'República da Costa Rica', '+506', 'CRC', 'es', 'San José', true, now()),
    ('CU', 'CUB', 'Cuba', 'República de Cuba', '+53', 'CUP', 'es', 'Havana', true, now()),
    ('DM', 'DMA', 'Dominica', 'Comunidade da Dominica', '+1767', 'XCD', 'en', 'Roseau', true, now()),
    ('DO', 'DOM', 'República Dominicana', 'República Dominicana', '+1809', 'DOP', 'es', 'Santo Domingo', true, now()),
    ('EC', 'ECU', 'Equador', 'República do Equador', '+593', 'USD', 'es', 'Quito', true, now()),
    ('SV', 'SLV', 'El Salvador', 'República de El Salvador', '+503', 'USD', 'es', 'San Salvador', true, now()),
    ('GD', 'GRD', 'Granada', 'Granada', '+1473', 'XCD', 'en', 'Saint George''s', true, now()),
    ('GT', 'GTM', 'Guatemala', 'República da Guatemala', '+502', 'GTQ', 'es', 'Cidade da Guatemala', true, now()),
    ('GY', 'GUY', 'Guiana', 'República Cooperativa da Guiana', '+592', 'GYD', 'en', 'Georgetown', true, now()),
    ('HT', 'HTI', 'Haiti', 'República do Haiti', '+509', 'HTG', 'ht', 'Porto Príncipe', true, now()),
    ('HN', 'HND', 'Honduras', 'República de Honduras', '+504', 'HNL', 'es', 'Tegucigalpa', true, now()),
    ('JM', 'JAM', 'Jamaica', 'Jamaica', '+1876', 'JMD', 'en', 'Kingston', true, now()),
    ('MX', 'MEX', 'México', 'Estados Unidos Mexicanos', '+52', 'MXN', 'es', 'Cidade do México', true, now()),
    ('NI', 'NIC', 'Nicarágua', 'República da Nicarágua', '+505', 'NIO', 'es', 'Manágua', true, now()),
    ('PA', 'PAN', 'Panamá', 'República do Panamá', '+507', 'PAB', 'es', 'Cidade do Panamá', true, now()),
    ('PY', 'PRY', 'Paraguai', 'República do Paraguai', '+595', 'PYG', 'es', 'Assunção', true, now()),
    ('PE', 'PER', 'Peru', 'República do Peru', '+51', 'PEN', 'es', 'Lima', true, now()),
    ('KN', 'KNA', 'São Cristóvão e Neves', 'Federação de São Cristóvão e Neves', '+1869', 'XCD', 'en', 'Basseterre', true, now()),
    ('LC', 'LCA', 'Santa Lúcia', 'Santa Lúcia', '+1758', 'XCD', 'en', 'Castries', true, now()),
    ('VC', 'VCT', 'São Vicente e Granadinas', 'São Vicente e Granadinas', '+1784', 'XCD', 'en', 'Kingstown', true, now()),
    ('SR', 'SUR', 'Suriname', 'República do Suriname', '+597', 'SRD', 'nl', 'Paramaribo', true, now()),
    ('TT', 'TTO', 'Trinidad e Tobago', 'República de Trinidad e Tobago', '+1868', 'TTD', 'en', 'Port of Spain', true, now()),
    ('US', 'USA', 'Estados Unidos', 'Estados Unidos da América', '+1', 'USD', 'en', 'Washington, D.C.', true, now()),
    ('UY', 'URY', 'Uruguai', 'República Oriental do Uruguai', '+598', 'UYU', 'es', 'Montevidéu', true, now()),
    ('VE', 'VEN', 'Venezuela', 'República Bolivariana da Venezuela', '+58', 'VES', 'es', 'Caracas', true, now()),
    ('PT', 'PRT', 'Portugal', 'República Portuguesa', '+351', 'EUR', 'pt', 'Lisboa', true, now()),
    ('ES', 'ESP', 'Espanha', 'Reino da Espanha', '+34', 'EUR', 'es', 'Madri', true, now()),
    ('GB', 'GBR', 'Reino Unido', 'Reino Unido da Grã-Bretanha e Irlanda do Norte', '+44', 'GBP', 'en', 'Londres', true, now()),
    ('AU', 'AUS', 'Austrália', 'Comunidade da Austrália', '+61', 'AUD', 'en', 'Camberra', true, now()),
    ('FR', 'FRA', 'França', 'República Francesa', '+33', 'EUR', 'fr', 'Paris', true, now());

INSERT INTO Cadastro.ORIGENS_LOGIN
    (ID_ORIGEM_LOGIN, CD_ORIGEM, DS_NOME, DS_DESCRICAO, TP_AUTENTICACAO,
     SN_PERMITE_AUTOCADASTRO, SN_ATIVA, DT_INCLUSAO, DT_ALTERACAO)
VALUES
    (gen_random_uuid(), 1, 'ArgousForms', 'Login local por e-mail e senha', 'L', true, true, now(), now());

INSERT INTO Cadastro.PAPEIS
    (ID_PAPEL, CD_PAPEL, DS_NOME, DS_DESCRICAO, SN_SISTEMA, SN_ATIVO, DT_INCLUSAO)
VALUES
    (gen_random_uuid(), 'INSTALADOR', 'Instalador', 'Executa atividades iniciais da instalação', true, true, now()),
    (gen_random_uuid(), 'ADMINISTRADOR_USUARIOS', 'Administrador de usuários', 'Administra usuários e seus acessos', true, true, now()),
    (gen_random_uuid(), 'GESTOR_ACESSOS', 'Gestor de acessos', 'Administra papéis, perfis e permissões', true, true, now()),
    (gen_random_uuid(), 'GESTOR_GRUPOS_TAGS', 'Gestor de grupos e tags', 'Administra grupos, vínculos e tags', true, true, now()),
    (gen_random_uuid(), 'GESTAO_DOCUMENTOS', 'Gestão de documentos', 'Gerencia as pastas para as quais foi nomeado gestor', true, true, now()),
    (gen_random_uuid(), 'AUTOGESTAO', 'Autogestão', 'Consulta suas pendências e mantém os próprios dados', true, true, now()),
    (gen_random_uuid(), 'CONSULTA_DOCUMENTOS', 'Consulta de documentos', 'Acessa documentos conforme as permissões de cada documento', true, true, now()),
    (gen_random_uuid(), 'EDITOR_DE_DOCUMENTOS', 'Editor de documentos', 'Inicia documentos elegíveis e edita etapas atribuídas', true, true, now()),
    (gen_random_uuid(), 'MODELADOR', 'Modelador', 'Cria e altera modelos de documentos e fluxos', true, true, now()),
    (gen_random_uuid(), 'ANALISTA_INDICADORES', 'Analista de indicadores', 'Consulta indicadores autorizados', true, true, now());

INSERT INTO Cadastro.PERFIS
    (ID_PERFIL, CD_PERFIL, DS_NOME, DS_DESCRICAO, SN_SISTEMA, SN_ATIVO, DT_INCLUSAO)
VALUES
    (gen_random_uuid(), 'ADMINISTRADOR', 'Administrador', 'Administra usuários, grupos, tags, acessos e pastas sob sua gestão', true, true, now()),
    (gen_random_uuid(), 'ESSENCIAL', 'Essencial', 'Acesso pessoal comum a todos os usuários', true, true, now()),
    (gen_random_uuid(), 'PARTICIPANTE', 'Participante', 'Inicia documentos elegíveis e edita etapas atribuídas', true, true, now()),
    (gen_random_uuid(), 'MODELADOR', 'Modelador', 'Cria e altera modelos', true, true, now()),
    (gen_random_uuid(), 'GESTOR', 'Gestor', 'Consulta indicadores autorizados', true, true, now());

INSERT INTO Cadastro.PERFIL_PAPEIS
    (ID_PERFIL_PAPEL, ID_PERFIL, ID_PAPEL, DT_INCLUSAO)
SELECT gen_random_uuid(), perfil.ID_PERFIL, papel.ID_PAPEL, now()
  FROM (VALUES
      ('ADMINISTRADOR', 'ADMINISTRADOR_USUARIOS'),
      ('ADMINISTRADOR', 'GESTOR_ACESSOS'),
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
