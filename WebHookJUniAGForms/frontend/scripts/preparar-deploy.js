import { constants } from 'node:fs';
import { chmod, copyFile, lstat, rename, unlink } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Executar depois de war:war: a configuração local não deve entrar no arquivo WAR.
export async function prepararDeploy(projeto = resolve(dirname(fileURLToPath(import.meta.url)), '../..')) {
  const origem = resolve(projeto, 'src/main/webapp/WEB-INF/configuracao.xml');
  let arquivo;
  try {
    arquivo = await lstat(origem);
  } catch (erro) {
    if (erro.code === 'ENOENT') return false;
    throw erro;
  }
  if (!arquivo.isFile()) throw new Error('A configuração local deve ser um arquivo regular.');

  const diretorio = resolve(projeto, 'target/WebHookJUniAGForms/WEB-INF');
  if (!(await lstat(diretorio)).isDirectory()) {
    throw new Error('A aplicação expandida deve ser gerada antes da cópia da configuração.');
  }
  const temporario = resolve(diretorio, `.configuracao-${randomUUID()}.tmp`);
  try {
    await copyFile(origem, temporario, constants.COPYFILE_EXCL);
    await chmod(temporario, 0o600);
    await rename(temporario, resolve(diretorio, 'configuracao.xml'));
  } finally {
    await unlink(temporario).catch((erro) => { if (erro.code !== 'ENOENT') throw erro; });
  }
  return true;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const copiou = await prepararDeploy();
  console.log(copiou
    ? 'Configuração local copiada para WEB-INF da aplicação expandida; WAR preservado.'
    : 'Configuração local ausente; nenhuma configuração de instalação foi copiada.');
}
