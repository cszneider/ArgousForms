import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const script = fileURLToPath(new URL('../scripts/enviar.js', import.meta.url));
function simulate(mode) {
  const dir = mkdtempSync(join(tmpdir(), 'argous-send-'));
  const log = join(dir, 'calls');
  const executable = `#!${process.execPath}
const fs=require('fs'),path=require('path');
const cmd=path.basename(process.argv[1]),args=process.argv.slice(2),key=cmd+' '+args.join(' ');
fs.appendFileSync(process.env.CALLS,key+'\\n');
if(process.env.MODE==='auth'&&cmd==='gh')process.exit(1);
if(process.env.MODE==='tests'&&key==='npm test')process.exit(1);
if(key==='git remote get-url --push principal')console.log(process.env.MODE==='remote'?'git@github.com:other/repo.git':'git@github.com:cszneider/ArgousForms.git');
if(key==='git branch --show-current')console.log('frontend-test');
if(key==='git diff --cached --name-only')console.log(process.env.MODE==='scope'?'ArgousForms/pom.xml':'ArgousForms/frontend/src/test.js');
if(cmd==='gh'&&args[0]==='pr')console.log(JSON.stringify([{state:'OPEN',url:'https://github.com/cszneider/ArgousForms/pull/123'}]));
`;
  for (const cmd of ['git', 'gh', 'npm'])
    writeFileSync(join(dir, cmd), executable, { mode: 0o755 });
  try {
    const result = spawnSync(process.execPath, [script], {
      encoding: 'utf8',
      env: {
        ...process.env,
        PATH: `${dir}:${process.env.PATH}`,
        CALLS: log,
        MODE: mode,
      },
    });
    return { status: result.status, calls: readFileSync(log, 'utf8') };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
for (const mode of ['auth', 'remote', 'scope', 'tests']) {
  test(`envio interrompe antes de commit/push em falha: ${mode}`, () => {
    const result = simulate(mode);
    assert.equal(result.status, 1);
    assert.doesNotMatch(result.calls, /git commit|git push/);
  });
}
test('envio executa testes e build antes de commit e push apenas ao principal', () => {
  const { status, calls } = simulate('ok');
  assert.equal(status, 0);
  assert.ok(calls.indexOf('npm test') < calls.indexOf('npm run build'));
  assert.ok(calls.indexOf('npm run build') < calls.indexOf('git commit'));
  assert.match(calls, /git push -u principal frontend-test/);
  assert.doesNotMatch(calls, /git push.*main|git push.*origin/);
});
