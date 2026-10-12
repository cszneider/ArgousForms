-- Executar manualmente com o proprietário do esquema Cadastro.
-- Tags existentes sem aplicação precisarão ser corrigidas antes desta execução.
ALTER TABLE Cadastro.TAGS
    ADD CONSTRAINT CK_TAGS_APLICACAO
    CHECK (SN_GRUPO OR SN_USUARIO OR SN_VINCULO);
