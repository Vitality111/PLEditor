// Runs every check in order: unit tests, then browser suites against a temporary local server.
import { spawn, spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';

const run = (args, env = process.env) => spawnSync(process.execPath, args, { stdio: 'inherit', env }).status;
let failed =
  run([
    '--test',
    ...readdirSync('tests')
      .filter(f => f.endsWith('.test.mjs'))
      .map(f => `tests/${f}`)
  ]) !== 0
    ? ['unit']
    : [];

// Every suite gets its own fresh server, like a first start (PB keeps nothing between runs anyway).
for (const suite of ['browser', 'interaction', 'rulers', 'variations', 'kit', 'html-import', 'no-storage', 'play', 'fiction-text', 'elements', 'resize', 'ui-contrast', 'fonts', 'rich-text', 'screenshot', 'last-creative', 'anchor', 'music', 'store-links', 'landscape-picture', 'cta-weight', 'tour', 'keys', 'audit', 'fuzz']) {
  const server = spawn(process.execPath, ['server.mjs'], { stdio: 'ignore' });
  await new Promise(r => setTimeout(r, 800));
  try {
    console.log(`\n=== ${suite}`);
    if (run([`tests/${suite}.mjs`, ...(suite === 'fuzz' ? ['3', '150'] : [])]) !== 0) failed.push(suite);
  } finally {
    server.kill();
    await new Promise(r => server.once('exit', r));
  }
}
console.log(failed.length ? `\nFAILED: ${failed.join(', ')}` : '\nAll suites passed');
process.exit(failed.length ? 1 : 0);
