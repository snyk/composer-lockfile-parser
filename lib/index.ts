import * as fs from 'fs';
import * as _isEmpty from 'lodash.isempty';
import * as path from 'path';

import { InvalidUserInputError } from './errors';
import { FileParser } from './parsers/file-parser';
import { ComposerParser } from './parsers/composer-parser';
import { ComposerJsonFile, ComposerLockFile, ComposerParserResponse, SystemPackages } from './types';

function buildDepTree(
  lockFileContent: string,
  manifestFileContent: string,
  defaultProjectName: string,
  systemVersions: SystemPackages,
  includeDev = false,
): ComposerParserResponse {

  const lockFileJson: ComposerLockFile = FileParser.parseLockFile(lockFileContent);
  const manifestJson: ComposerJsonFile = FileParser.parseManifestFile(manifestFileContent);

  if (!lockFileJson.packages) {
    throw new InvalidUserInputError('Invalid lock file. Must contain `packages` property');
  }

  const name: string = manifestJson.name || defaultProjectName;
  const version: string = ComposerParser.getVersion(manifestJson) || '0.0.0';
  const dependencies = ComposerParser.buildDependencies(
    manifestJson,
    lockFileJson,
    manifestJson,
    systemVersions,
    includeDev,
  );
  const hasDevDependencies = !_isEmpty(manifestJson['require-dev']);

  return {
    name,
    version,
    dependencies,
    hasDevDependencies,
    packageFormatVersion: 'composer:0.0.1',
  };
}

function buildDepTreeFromFiles(
  basePath: string,
  lockFileName: string,
  systemVersions: SystemPackages,
  includeDev = false): ComposerParserResponse {
  if (!basePath) {
    throw new InvalidUserInputError('Missing `basePath` parameter for buildDepTreeFromFiles()');
  }

  if (!lockFileName) {
    throw new InvalidUserInputError('Missing `lockfile` parameter for buildDepTreeFromFiles()');
  }

  if (!systemVersions) {
    throw new InvalidUserInputError('Missing `systemVersions` parameter for buildDepTreeFromFiles()');
  }

  const lockFilePath: string = path.resolve(basePath, lockFileName);
  const manifestFilePath: string = path.resolve(basePath, path.dirname(lockFilePath), 'composer.json');

  if (!fs.existsSync(lockFilePath)) {
    throw new InvalidUserInputError(`Lockfile not found at location: ${lockFilePath}`);
  }

  if (!fs.existsSync(manifestFilePath)) {
    throw new InvalidUserInputError(`Target file composer.json not found at location: ${manifestFilePath}`);
  }

  const lockFileContent: string = fs.readFileSync(lockFilePath, 'utf-8');
  const manifestFileContent: string = fs.readFileSync(manifestFilePath, 'utf-8');

  const defaultProjectName: string = getDefaultProjectName(basePath, lockFileName);

  return buildDepTree(lockFileContent, manifestFileContent, defaultProjectName, systemVersions, includeDev);
}

function getDefaultProjectName(basePath: string, lockFileName: string): string {
  return path.dirname(path.resolve(path.join(basePath, lockFileName))).split(path.sep).pop()!;
}

export {
  buildDepTree,
  buildDepTreeFromFiles,
  SystemPackages,
  ComposerJsonFile,
  ComposerLockFile,
  ComposerParserResponse,
};
