-- Executar somente na base que já recebeu a adequação antiga com Notificacoes.Notificacoes_EVENTOS.
-- A renomeação preserva registros, índices, restrições, gatilhos e referências de chave estrangeira.
BEGIN;

DO $$
BEGIN
    IF to_regclass('Notificacoes.EVENTOS') IS NOT NULL AND to_regclass('Notificacoes.Notificacoes_EVENTOS') IS NOT NULL THEN
        RAISE EXCEPTION 'As duas tabelas de eventos existem. Confira os dados antes de renomear.';
    ELSIF to_regclass('Notificacoes.EVENTOS') IS NULL AND to_regclass('Notificacoes.Notificacoes_EVENTOS') IS NULL THEN
        RAISE EXCEPTION 'Nenhuma tabela de eventos existe. Execute a adequação completa de notificações.';
    ELSIF to_regclass('Notificacoes.Notificacoes_EVENTOS') IS NOT NULL THEN
        ALTER TABLE Notificacoes.Notificacoes_EVENTOS RENAME TO EVENTOS;
    END IF;
END;
$$;

COMMIT;
