import * as fs from 'fs';
import * as path from 'path';

import { buildDepTreeFromFiles } from '../lib';
import { systemVersionsStub } from './stubs/system_deps_stub';

// These deps are plain CommonJS shipping their own (or no) types. We require() them so they stay
// directly callable without enabling esModuleInterop — the library relies on `import * as fn` /
// `fn(...)` working, which only holds while esModuleInterop is off.
const _get = require('lodash.get');
const _find = require('lodash.find');
const fetch = require('node-fetch');

function readExpectedTree(projFolder: string, fileName = 'composer_deps.json') {
  return JSON.parse(fs.readFileSync(path.resolve(projFolder, fileName), 'utf-8'));
}

const deepTestFolders = [
  'proj_with_no_deps',
  'vulnerable_project',
  'circular_deps_php_project',
  'many_deps_php_project',
  'circular_deps_special_test',
  'proj_with_aliases',
  'proj_with_aliases_external_github',
  'no_branch_alias',
  'lockfile_with_no_name_dep',
];

describe('buildDepTreeFromFiles matches expected dep tree', () => {
  it.each(deepTestFolders)('php plugin for %s', (folder) => {
    const projFolder = './test/fixtures/' + folder;
    const depTree = buildDepTreeFromFiles(projFolder, 'composer.lock', systemVersionsStub);
    expect(depTree).toEqual(readExpectedTree(projFolder));
  });
});

test('dev dependencies are not parsed by default', () => {
  const projFolder = './test/fixtures/proj_with_dev_deps';
  const depTree = buildDepTreeFromFiles(projFolder, './composer.lock', systemVersionsStub);
  expect(depTree).toEqual(readExpectedTree(projFolder));
});

test('dev dependencies are parsed when include dev true', () => {
  const projFolder = './test/fixtures/proj_with_dev_deps';
  const depTree = buildDepTreeFromFiles(projFolder, './composer.lock', systemVersionsStub, true);
  expect(depTree).toEqual(readExpectedTree(projFolder, 'composer_deps_with_dev.json'));
});

test('missing function `basePath` param', () => {
  expect.assertions(2);
  try {
    buildDepTreeFromFiles(null as any, './composer.lock', systemVersionsStub);
  } catch (err) {
    expect(err.name).toBe('InvalidUserInputError');
    expect(err.message).toBe('Missing `basePath` parameter for buildDepTreeFromFiles()');
  }
});

test('missing function `lockFileName` param', () => {
  expect.assertions(2);
  const projFolder = './test/fixtures/many_deps_php_project';
  try {
    buildDepTreeFromFiles(projFolder, null as any, systemVersionsStub);
  } catch (err) {
    expect(err.name).toBe('InvalidUserInputError');
    expect(err.message).toBe('Missing `lockfile` parameter for buildDepTreeFromFiles()');
  }
});

test('missing function `systemVersion` params', () => {
  expect.assertions(2);
  const projFolder = './test/fixtures/many_deps_php_project';
  try {
    buildDepTreeFromFiles(projFolder, './composer.lock', null as any);
  } catch (err) {
    expect(err.name).toBe('InvalidUserInputError');
    expect(err.message).toBe('Missing `systemVersions` parameter for buildDepTreeFromFiles()');
  }
});

test('lockfile not found', () => {
  expect.assertions(2);
  const projFolder = './test/fixtures/many_deps_php_project';
  try {
    buildDepTreeFromFiles(projFolder, './c_o_m_p_o_s_e_r.lock', systemVersionsStub);
  } catch (err) {
    expect(err.name).toBe('InvalidUserInputError');
    expect(err.message).toMatch(/^Lockfile not found at location:/);
  }
});

test('composer.json not found', () => {
  expect.assertions(2);
  const projFolder = './test/fixtures/missing_compose_json';
  try {
    buildDepTreeFromFiles(projFolder, './composer.lock', systemVersionsStub);
  } catch (err) {
    expect(err.name).toBe('InvalidUserInputError');
    expect(err.message).toMatch(/^Target file composer\.json not found at location:/);
  }
});

test('package param in lock file is missing', () => {
  expect.assertions(2);
  const projFolder = './test/fixtures/missing_package_prop';
  try {
    buildDepTreeFromFiles(projFolder, './composer.lock', systemVersionsStub);
  } catch (err) {
    expect(err.name).toBe('InvalidUserInputError');
    expect(err.message).toBe('Invalid lock file. Must contain `packages` property');
  }
});

test('composer.lock is not valid json', () => {
  expect.assertions(2);
  const projFolder = './test/fixtures/lockfile-invalid-json';
  try {
    buildDepTreeFromFiles(projFolder, './composer.lock', systemVersionsStub);
  } catch (err) {
    expect(err.name).toBe('ParseError');
    expect(err.message).toMatch(/^Failed to parse lock file\. Error:/);
  }
});

test('composer.json is not valid json', () => {
  expect.assertions(2);
  const projFolder = './test/fixtures/composer-invalid-json';
  try {
    buildDepTreeFromFiles(projFolder, './composer.lock', systemVersionsStub);
  } catch (err) {
    expect(err.name).toBe('ParseError');
    expect(err.message).toMatch(/^Failed to parse manifest file\. Error:/);
  }
});

test('composer parser for project with many deps', () => {
  const projFolder = './test/fixtures/many_deps_php_project';
  const depTree = buildDepTreeFromFiles(projFolder, './composer.lock', systemVersionsStub);
  expect(depTree).toMatchObject({
    name: 'symfony/console',
    version: '4.0-dev',
    packageFormatVersion: 'composer:0.0.1',
    hasDevDependencies: true,
  });
});

test('composer parser for project with interconnected deps', () => {
  const projFolder = './test/fixtures/interdependent_modules';
  const depTree = buildDepTreeFromFiles(projFolder, './composer.lock', systemVersionsStub);
  expect(depTree).toMatchObject({
    name: 'foo',
    version: '1.1.1',
    packageFormatVersion: 'composer:0.0.1',
    hasDevDependencies: false,
  });
  expect(JSON.stringify(depTree).length).toBeLessThan(200000);
});

test('with alias, uses correct version', () => {
  const projFolder = './test/fixtures/proj_with_aliases';
  const composerJson = JSON.parse(fs.readFileSync(path.resolve(projFolder, 'composer.json'), 'utf-8'));

  const depTree = buildDepTreeFromFiles(projFolder, 'composer.lock', systemVersionsStub);
  const deps: any = depTree.dependencies;
  const monologBridgeObj = _find(deps, { name: 'symfony/monolog-bridge' });
  const actualVersionInstalled = monologBridgeObj.version.slice(0, -2); // remove the trailing .0
  const expectedVersionString = _get(composerJson, "require['symfony/monolog-bridge']"); // '2.6 as 2.7'
  const [realVersion, aliasVersion] = expectedVersionString.split(' as '); // real = 2.6, alias = 2.7

  expect(actualVersionInstalled).toBe(realVersion);
  expect(actualVersionInstalled).not.toBe(aliasVersion);
});

test('with alias in external repo', async () => {
  const projFolder = './test/fixtures/proj_with_aliases_external_github';
  const depTree = buildDepTreeFromFiles(projFolder, 'composer.lock', systemVersionsStub);

  const composerJson = JSON.parse(fs.readFileSync(path.resolve(projFolder, 'composer.json'), 'utf-8'));
  const composerJsonAlias = composerJson.require['symfony/monolog-bridge'];
  const aliasBranch = composerJsonAlias.split(' as ').shift().replace('dev-', '');

  // to be really sure, we take a look at repo@`url` and check for branch
  const apiBranchesUrl = composerJson.repositories[0].url.replace(
    'https://github.com/', 'https://api.github.com/repos/') + '/branches';
  let branchesData;

  // sometimes we hit the github api limit, so we fall back to a mock
  try {
    const res = await fetch(apiBranchesUrl, {
      headers: {
        'user-agent': 'CI Testing',
      },
    });
    branchesData = await res.json();
  } catch (error) {
    branchesData = [
      { name: 'my-bugfix' },
    ];
  }
  const ourAliasBranchName = _get(_find(branchesData, { name: aliasBranch }), 'name');

  // in composer.json
  expect(composerJson.version).toBeUndefined();
  // it's version looks like this: dev-my-bugfix as 2.7
  expect(composerJsonAlias.split(' as ')).toHaveLength(2);
  expect(composerJsonAlias.split('-').shift()).toBe('dev');
  expect(composerJson.repositories[0].url).toBe('https://github.com/aryehbeitz/monolog-bridge');
  expect(composerJson.repositories[0].type).toBe('vcs');
  // the alias is a branch
  expect(ourAliasBranchName).toBe(aliasBranch);

  // now to make sure we got it right in the plugin parsing
  const deps: any = depTree.dependencies;
  const monologBridgeObj = _find(deps, { name: 'symfony/monolog-bridge' });
  expect(monologBridgeObj.version).toBe(aliasBranch);
});

test('project name is not empty', () => {
  const projFolder = './test/fixtures/no_project_name';
  const depTree = buildDepTreeFromFiles(projFolder, 'composer.lock', systemVersionsStub);
  expect(depTree.name).toEqual('no_project_name');
});
