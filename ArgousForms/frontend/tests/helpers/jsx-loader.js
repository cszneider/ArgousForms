import { readFile } from 'node:fs/promises';
import ts from 'typescript';
const sourceRoot = new URL('../../src/', import.meta.url).href;
export async function load(url, context, nextLoad) {
  if (url.endsWith('?url')) {
    return {
      format: 'module',
      shortCircuit: true,
      source: `export default ${JSON.stringify(url.replace('?url', ''))};`,
    };
  }
  if (url.startsWith(sourceRoot) && url.endsWith('.js')) {
    const source = await readFile(new URL(url), 'utf8');
    return {
      format: 'module',
      shortCircuit: true,
      source: ts.transpileModule(source, {
        compilerOptions: {
          jsx: ts.JsxEmit.ReactJSX,
          module: ts.ModuleKind.ESNext,
          target: ts.ScriptTarget.ES2022,
        },
      }).outputText,
    };
  }
  return nextLoad(url, context);
}
