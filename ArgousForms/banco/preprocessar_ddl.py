#!/usr/bin/env python3
"""Qualifica o DDL exportado usando os @Table do JAR de fontes do ArgousForms."""

import argparse
import re
import zipfile
from pathlib import Path


TABELA = re.compile(r'@Table\s*\(\s*name\s*=\s*"([^".]+)\.([^"]+)"\s*\)')
DROP = re.compile(r'^\s*Drop table\s+([A-Z_]+)\s*;\s*$', re.IGNORECASE | re.MULTILINE)
CREATE = re.compile(r'^\s*Create table\s+([A-Z_]+)\b', re.IGNORECASE | re.MULTILINE)
FK = re.compile(r'^\s*Alter table\s+([A-Z_]+)\s+add\s+foreign key\s*\([^)]*\)\s+references\s+([A-Z_]+)\b', re.IGNORECASE | re.MULTILINE)
INDICE = re.compile(r'^\s*Create(?:\s+unique)?\s+index\s+\w+\s+on\s+([A-Z_]+)\b[^;]*;\s*$', re.IGNORECASE | re.MULTILINE)
ALTERACAO = re.compile(r'^\s*Alter table\s+([A-Z_]+)\b[^;]*;\s*$', re.IGNORECASE | re.MULTILINE)
DROP_QUALIFICADO = re.compile(r'^\s*DROP TABLE IF EXISTS\s+([A-Za-z_]+\.[A-Z_]+);\s*$', re.IGNORECASE | re.MULTILINE)


def esquemas(jar):
    encontrados = {}

    with zipfile.ZipFile(jar) as fontes:
        for nome in fontes.namelist():
            if not nome.startswith("br/com/argousForms/model/persistencia/") or not nome.endswith(".java"):
                continue

            conteudo = fontes.read(nome).decode("utf-8", errors="replace")
            referencia = TABELA.search(conteudo)
            if referencia is None:
                continue

            esquema, tabela = referencia.groups()
            tabela = tabela.upper()
            if tabela in encontrados and encontrados[tabela] != esquema:
                raise ValueError(f"Tabela {tabela} aparece em mais de um esquema")
            encontrados[tabela] = esquema

    return encontrados


def ordem_exclusao(tabelas, dependencias):
    filhos = {tabela: [] for tabela in tabelas}
    for filho, pai in dependencias:
        if filho != pai:
            filhos[pai].append(filho)

    visitados = set()
    em_visita = set()
    resultado = []

    def visitar(tabela):
        if tabela in em_visita:
            raise ValueError(f"Dependência circular envolvendo {tabela}; revisar os DROP TABLE")
        if tabela in visitados:
            return

        em_visita.add(tabela)
        for filho in filhos[tabela]:
            visitar(filho)
        em_visita.remove(tabela)
        visitados.add(tabela)
        resultado.append(tabela)

    for tabela in tabelas:
        visitar(tabela)

    return resultado


def processar(ddl, mapa, drops_anteriores=""):
    drops = [nome.upper() for nome in DROP.findall(ddl)]
    creates = [nome.upper() for nome in CREATE.findall(ddl)]
    if not drops or len(drops) != len(set(drops)) or set(drops) != set(creates):
        raise ValueError("Os DROP TABLE devem corresponder exatamente às tabelas criadas")

    ausentes = sorted(set(creates) - mapa.keys())
    if ausentes:
        raise ValueError(f"Tabelas sem @Table com esquema no JAR: {', '.join(ausentes)}")

    dependencias = [(filho.upper(), pai.upper()) for filho, pai in FK.findall(ddl) if filho.upper() in drops and pai.upper() in drops]

    primeira_exclusao = DROP.search(ddl)
    cabecalho = ddl[:primeira_exclusao.start()]
    corpo = DROP.sub("", ddl[primeira_exclusao.start():])
    corpo = INDICE.sub(lambda trecho: trecho.group(0) if trecho.group(1).upper() in creates else "", corpo)
    corpo = ALTERACAO.sub(lambda trecho: trecho.group(0) if trecho.group(1).upper() in creates else "", corpo)
    exclusoes = "\n".join(f"DROP TABLE IF EXISTS {mapa[nome]}.{nome};" for nome in ordem_exclusao(drops, dependencias))
    if drops_anteriores:
        exclusoes = drops_anteriores.rstrip() + "\n" + exclusoes
    esquemas_criados = {mapa[nome] for nome in creates}
    esquemas_anteriores = {nome.split(".")[0] for nome in DROP_QUALIFICADO.findall(drops_anteriores)}
    resultado = cabecalho + "\nBEGIN;\n" + "\n".join(
        f"CREATE SCHEMA IF NOT EXISTS {esquema};" for esquema in sorted(esquemas_criados | esquemas_anteriores)
    ) + "\n\n" + exclusoes + "\n" + corpo

    def qualificar(expressao, texto):
        def substituir(match):
            nome = match.group(2).upper()
            if nome not in mapa:
                raise ValueError(f"Referência sem esquema no JAR: {nome}")
            return match.group(1) + mapa[nome] + "." + nome

        return expressao.sub(substituir, texto)

    for expressao in (
        re.compile(r'(?im)^(\s*Create table\s+)([A-Z_]+)\b'),
        re.compile(r'(?im)^(\s*Alter table\s+)([A-Z_]+)\b'),
        re.compile(r'(?im)\b(REFERENCES\s+)([A-Z_]+)\b'),
        re.compile(r'(?im)\b(ON\s+)([A-Z_]+)(?=\s*\()'),
    ):
        resultado = qualificar(expressao, resultado)

    resultado = re.sub(r"\n{3,}", "\n\n", resultado)
    permissoes = """
-- Executar a estrutura com um proprietário distinto do usuário da aplicação.
"""
    for esquema in sorted(esquemas_criados):
        permissoes += f"""REVOKE CREATE ON SCHEMA {esquema} FROM PUBLIC;
REVOKE CREATE ON SCHEMA {esquema} FROM carlos;
REVOKE TRIGGER ON ALL TABLES IN SCHEMA {esquema} FROM carlos;
GRANT USAGE ON SCHEMA {esquema} TO carlos;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA {esquema} TO carlos;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA {esquema} TO carlos;

-- Aplica-se apenas aos objetos criados futuramente pelo papel que executa este DDL.
ALTER DEFAULT PRIVILEGES IN SCHEMA {esquema}
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO carlos;
ALTER DEFAULT PRIVILEGES IN SCHEMA {esquema}
    GRANT USAGE, SELECT ON SEQUENCES TO carlos;

"""
    return resultado.rstrip() + "\n\n" + permissoes.strip() + "\n\nCOMMIT;\n"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("entrada", type=Path)
    parser.add_argument("saida", type=Path)
    parser.add_argument("--sources-jar", required=True, type=Path)
    parser.add_argument("--drop-before", type=Path, help="Script cujas tabelas devem ser removidas antes das tabelas desta entrada")
    argumentos = parser.parse_args()

    ddl = argumentos.entrada.read_text(encoding="utf-8")
    anteriores = ""
    if argumentos.drop_before:
        linhas = DROP_QUALIFICADO.findall(argumentos.drop_before.read_text(encoding="utf-8"))
        if not linhas:
            raise ValueError("O script informado em --drop-before não possui DROP TABLE qualificados")
        anteriores = "\n".join(f"DROP TABLE IF EXISTS {nome};" for nome in linhas)
    resultado = processar(ddl, esquemas(argumentos.sources_jar), anteriores)
    argumentos.saida.write_text(resultado, encoding="utf-8")


if __name__ == "__main__":
    main()
