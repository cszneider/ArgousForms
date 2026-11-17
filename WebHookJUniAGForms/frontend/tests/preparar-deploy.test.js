import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, stat, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { prepararDeploy } from '../scripts/preparar-deploy.js';

test('copia a configuração preservando origem e WAR; permite novo deploy', async () => {
  const projeto = await mkdtemp(join(tmpdir(), 'webhook-deploy-'));
  try {
    const origem = join(projeto, 'src/main/webapp/WEB-INF');
    const destino = join(projeto, 'target/WebHookJUniAGForms/WEB-INF');
    await mkdir(origem, { recursive: true });
    await mkdir(destino, { recursive: true });
    const conteudo = '<configuracao>dados-ficticios-cifrados</configuracao>';
    await writeFile(join(origem, 'configuracao.xml'), conteudo);
    const war = join(projeto, 'target/WebHookJUniAGForms.war');
    const sentinela = Buffer.from('representa-o-war-ja-empacotado');
    await writeFile(war, sentinela);
    assert.equal(await prepararDeploy(projeto), true);
    assert.equal(await readFile(join(destino, 'configuracao.xml'), 'utf8'), conteudo);
    assert.equal(await readFile(join(origem, 'configuracao.xml'), 'utf8'), conteudo);
    assert.deepEqual(await readFile(war), sentinela);
    if (process.platform !== 'win32') assert.equal((await stat(join(destino, 'configuracao.xml'))).mode & 0o777, 0o600);
    await writeFile(join(origem, 'configuracao.xml'), 'configuracao-atualizada-ficticia');
    await prepararDeploy(projeto);
    assert.equal(await readFile(join(destino, 'configuracao.xml'), 'utf8'), 'configuracao-atualizada-ficticia');
  } finally { await rm(projeto, { recursive: true, force: true }); }
});

test('não exige configuração local para distribuir o exemplo', async () => {
  const projeto = await mkdtemp(join(tmpdir(), 'webhook-deploy-'));
  try { assert.equal(await prepararDeploy(projeto), false); }
  finally { await rm(projeto, { recursive: true, force: true }); }
});

test('falha se a aplicação ainda não foi expandida', async () => {
  const projeto = await mkdtemp(join(tmpdir(), 'webhook-deploy-'));
  try {
    const origem = join(projeto, 'src/main/webapp/WEB-INF');
    await mkdir(origem, { recursive: true });
    await writeFile(join(origem, 'configuracao.xml'), 'ficticio');
    await assert.rejects(prepararDeploy(projeto));
  } finally { await rm(projeto, { recursive: true, force: true }); }
});

test('não segue link simbólico como configuração de origem', async () => {
  if (process.platform === 'win32') return;
  const projeto = await mkdtemp(join(tmpdir(), 'webhook-deploy-'));
  try {
    const origem = join(projeto, 'src/main/webapp/WEB-INF');
    await mkdir(origem, { recursive: true });
    await writeFile(join(projeto, 'outro.xml'), 'ficticio');
    await symlink(join(projeto, 'outro.xml'), join(origem, 'configuracao.xml'));
    await assert.rejects(prepararDeploy(projeto));
  } finally { await rm(projeto, { recursive: true, force: true }); }
});
