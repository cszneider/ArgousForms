-- Aplicar uma vez na instalação existente, após a estrutura de Processos.
-- A pasta pode ser escolhida depois da criação do rascunho do Protocolo.

ALTER TABLE Processos.PROTOCOLOS ALTER COLUMN ID_PASTA DROP NOT NULL;
