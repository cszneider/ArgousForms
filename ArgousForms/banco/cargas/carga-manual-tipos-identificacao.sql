-- Carga inicial de tipos de identificação para o banco de desenvolvimento.
-- Executar após estrutura-inicial.sql e carga-manual-teste.sql, com a tabela
-- Cadastro.TIPOS_IDENTIFICACAO vazia. Não executa validação de dígitos de controle.
-- Os números são armazenados sem máscara; DS_MASCARA fica nulo até que o
-- formato de máscara da interface seja definido.
-- O Reino Unido não recebe número fiscal/previdenciário nesta carga.
-- Os Estados Unidos usam SSN; Austrália, TFN; Canadá, SIN.

BEGIN;

DO $carga$
BEGIN
    IF EXISTS (SELECT 1 FROM Cadastro.TIPOS_IDENTIFICACAO) THEN
        RAISE EXCEPTION 'A carga de tipos de identificação exige a tabela vazia.';
    END IF;

    IF EXISTS (
        SELECT cod.cd_iso_2
          FROM (VALUES ('AR'), ('AU'), ('BR'), ('CA'), ('CL'), ('CO'), ('EC'), ('ES'),
                       ('MX'), ('PE'), ('PT'), ('PY'), ('US'), ('UY')) AS cod(cd_iso_2)
          LEFT JOIN Cadastro.PAISES pais ON pais.CD_ISO_2 = cod.cd_iso_2
         GROUP BY cod.cd_iso_2
        HAVING COUNT(pais.ID_PAIS) <> 1
    ) THEN
        RAISE EXCEPTION 'Cada país da carga precisa existir uma única vez em Cadastro.PAISES.';
    END IF;
END;
$carga$;

INSERT INTO Cadastro.TIPOS_IDENTIFICACAO
    (ID_PAIS, CD_TIPO, DS_NOME, DS_DESCRICAO, CD_REGEX, DS_MASCARA,
     SN_ATIVO, DT_INCLUSAO, DT_ALTERACAO)
SELECT pais.ID_PAIS, dados.CD_TIPO, dados.DS_NOME, dados.DS_DESCRICAO,
       dados.CD_REGEX, NULL, true, now(), now()
  FROM (VALUES
    ('BR', 'CPF', 'Cadastro de Pessoas Físicas',
     'CPF sem pontuação; o formato não verifica os dígitos de controle.',
     '^[0-9]{11}$'),
    ('AR', 'DNI', 'Documento Nacional de Identidade',
     'DNI argentino; aceita números de seis a oito dígitos e eventual prefixo histórico F ou M.',
     '^[FM]?[0-9]{6,8}$'),
    ('UY', 'CI', 'Cédula de Identidade',
     'Cédula uruguaia com sete dígitos e dígito verificador, sem separadores.',
     '^[0-9]{8}$'),
    ('PY', 'CI', 'Cédula de Identidade',
     'Cédula paraguaia; regra numérica ampla e provisória, sem verificação oficial de comprimento.',
     '^[0-9]{1,10}$'),
    ('US', 'SSN', 'Social Security Number',
     'Número de seguridade social dos Estados Unidos; nove dígitos, sem separadores.',
     '^[0-9]{9}$'),
    ('AU', 'TFN', 'Tax File Number',
     'Número fiscal australiano; formato usual de nove dígitos, sem separadores.',
     '^[0-9]{9}$'),
    ('CA', 'SIN', 'Social Insurance Number',
     'Número de seguridade social canadense; nove dígitos, sem separadores.',
     '^[0-9]{9}$'),
    ('CL', 'RUN', 'Rol Único Nacional',
     'RUN chileno com dígito verificador numérico ou K, sem pontos ou hífen.',
     '^[0-9]{7,8}[0-9K]$'),
    ('MX', 'CURP', 'Clave Única de Registro de Población',
     'CURP mexicana de 18 caracteres; o formato não confere os dados biográficos ou dígito final.',
     '^[A-Z]{4}[0-9]{6}[A-Z]{6}[0-9A-Z][0-9]$'),
    ('ES', 'DNI', 'Documento Nacional de Identidade',
     'DNI espanhol com oito dígitos e letra de controle.',
     '^[0-9]{8}[A-Z]$'),
    ('ES', 'NIE', 'Número de Identidade de Estrangeiro',
     'NIE espanhol com prefixo X, Y ou Z, sete dígitos e letra de controle.',
     '^[XYZ][0-9]{7}[A-Z]$'),
    ('PT', 'NIF', 'Número de Identificação Fiscal',
     'NIF português de pessoa singular, com nove dígitos.',
     '^[0-9]{9}$'),
    ('CO', 'CC', 'Cédula de Cidadania',
     'Cédula colombiana: números antigos de até oito dígitos ou NUIP atual de dez dígitos.',
     '^(?:[0-9]{1,8}|[0-9]{10})$'),
    ('EC', 'NUI', 'Número Único de Identificação',
     'NUI equatoriano de dez dígitos, usado como número da cédula.',
     '^[0-9]{10}$'),
    ('PE', 'DNI', 'Documento Nacional de Identidade',
     'DNI peruano de oito dígitos.',
     '^[0-9]{8}$')
  ) AS dados(CD_ISO_2, CD_TIPO, DS_NOME, DS_DESCRICAO, CD_REGEX)
  JOIN Cadastro.PAISES pais ON pais.CD_ISO_2 = dados.CD_ISO_2;

COMMIT;
