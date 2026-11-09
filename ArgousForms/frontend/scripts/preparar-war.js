import { copyFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const output = fileURLToPath(new URL('../dist/war/', import.meta.url));

for (const route of ['app', 'cadastro', 'convite', 'inicio', 'login', 'plataforma']) {
  const directory = join(output, route);
  mkdirSync(directory, { recursive: true });
  copyFileSync(join(output, 'index.html'), join(directory, 'index.html'));
}
