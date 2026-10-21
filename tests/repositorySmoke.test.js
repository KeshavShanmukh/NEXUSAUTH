const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const packageJson = require(path.join(root, 'package.json'));

test('project exposes production lifecycle scripts', () => {
  assert.equal(typeof packageJson.scripts.start, 'string');
  assert.equal(typeof packageJson.scripts.build, 'string');
  assert.equal(typeof packageJson.scripts.test, 'string');
});

test('application entry point and route modules are present', () => {
  assert.equal(fs.existsSync(path.join(root, 'server.js')), true);
  for (const route of ['authRoutes.js', 'adminRoutes.js', 'usageRoutes.js']) {
    assert.equal(fs.existsSync(path.join(root, 'routes', route)), true, `${route} is missing`);
  }
});

test('secret-bearing runtime files are excluded from the repository', () => {
  const gitignore = fs.readFileSync(path.join(root, '.gitignore'), 'utf8');
  assert.match(gitignore, /^\.env$/m);
  assert.match(gitignore, /^\.env\.\*$/m);
  assert.equal(fs.existsSync(path.join(root, '.env')), false);
  assert.equal(fs.existsSync(path.join(root, '.env.local')), false);
});
