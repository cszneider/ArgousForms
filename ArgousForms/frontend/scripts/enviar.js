import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const cwd = fileURLToPath(new URL('../', import.meta.url));
const repository = 'cszneider/ArgousForms';
const remote = 'principal';
const scope = 'ArgousForms/frontend/';
function run(command, args, capture = false) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
  });
  if (result.error || result.status !== 0)
    throw new Error(
      capture
        ? `${command}: ${result.stderr?.trim() || result.error?.message}`
        : `Falha em ${command}. Nenhum passo seguinte foi executado.`,
    );
  return capture ? result.stdout.trim() : '';
}
try {
  if (process.argv.includes('--check')) {
    run('git', ['status', '--short']);
    run('gh', ['auth', 'status', '--hostname', 'github.com']);
    console.log('Verificação concluída. Nenhum arquivo foi enviado.');
    process.exit(0);
  }
  run('gh', ['auth', 'status', '--hostname', 'github.com']);
  const url = run('git', ['remote', 'get-url', '--push', remote], true);
  if (
    !/^(git@github\.com:|https:\/\/github\.com\/)cszneider\/ArgousForms(?:\.git)?$/.test(
      url,
    )
  )
    throw new Error(
      'O remoto principal não corresponde ao repositório autorizado.',
    );
  const staged = run('git', ['diff', '--cached', '--name-only'], true)
    .split('\n')
    .filter(Boolean);
  if (staged.some((path) => !path.startsWith(scope)))
    throw new Error(
      'Há arquivos preparados fora do frontend. Separe esse commit antes de enviar.',
    );
  let branch = run('git', ['branch', '--show-current'], true);
  if (!branch) throw new Error('Selecione uma branch antes de enviar.');
  const title =
    process.argv.slice(2).join(' ').trim() || 'Atualiza frontend ArgousDocs';
  run('npm', ['test']);
  run('npm', ['run', 'build']);
  if (branch === 'main' || branch === 'master') {
    branch = `frontend-${new Date().toISOString().replace(/[:.]/g, '-')}`;
    run('git', ['switch', '-c', branch]);
  }
  const previous = JSON.parse(
    run(
      'gh',
      [
        'pr',
        'list',
        '--repo',
        repository,
        '--head',
        branch,
        '--state',
        'all',
        '--json',
        'state,url',
      ],
      true,
    ),
  );
  if (previous.length && !previous.some((pr) => pr.state === 'OPEN'))
    throw new Error(
      'Esta branch já possui um pull request encerrado. Atualize a main e crie uma nova branch para o próximo envio.',
    );
  run('git', ['add', '--all', '--', '.']);
  run('git', ['diff', '--cached', '--check']);
  const files = run('git', ['diff', '--cached', '--name-only'], true)
    .split('\n')
    .filter(Boolean);
  if (
    files.some(
      (path) =>
        !path.startsWith(scope) ||
        /(^|\/)(\.env[^/]*|node_modules|dist|\.next|\.openai|\.codex)(\/|$)|\.(pem|p12|key)$/.test(
          path,
        ),
    )
  )
    throw new Error(
      'Há arquivos fora do escopo ou configurações privadas preparados. Revise git diff --cached antes de continuar.',
    );
  if (files.length) run('git', ['commit', '-m', title]);
  run('git', ['push', '-u', remote, branch]);
  const open = previous.find((pr) => pr.state === 'OPEN');
  if (open) console.log(`Pull request atualizado: ${open.url}`);
  else
    run('gh', [
      'pr',
      'create',
      '--repo',
      repository,
      '--base',
      'main',
      '--head',
      branch,
      '--draft',
      '--title',
      title,
      '--body',
      'Atualiza o frontend ArgousDocs em ArgousForms/frontend.\n\nValidação: npm test e npm run build concluídos antes do envio.',
    ]);
  console.log(
    'Envio concluído. A integração na main continua sujeita a revisão.',
  );
} catch (error) {
  console.error(error.message);
  console.error(
    'Se faltar autenticação, execute: gh auth login --hostname github.com --git-protocol ssh --web',
  );
  process.exitCode = 1;
}
