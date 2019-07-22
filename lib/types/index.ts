/**
 * Manifest file related types
 */
export interface ComposerJsonFile {
  name: string;
  version?: string;
  extra: ComposerExtras;
  require: ComposerDependencies;
  'require-dev': ComposerDependencies;
}

export interface ComposerExtras {
  'branch-alias': {
    [alias: string]: string,
  };
}

export interface ComposerDependencies {
  [depName: string]: string;
}

export interface ComposerLockFile {
  packages: LockFilePackage[];
}

/**
 * Lock file related types
 */
export interface LockFilePackage {
  name: string;
  version?: string;
  require: LockFileDependencies;
  'require-dev': LockFileDependencies;
}

export interface LockFileDependencies {
  [depName: string]: string;
}

/**
 * Dependency tree related types
 */
export interface DepTree {
  name: string;
  version: string;
  dependencies: DepTreeDependencies;
  depType?: DepType;
}

export type DepTreeDependencies = DepTree | {};

export enum DepType {
  prod = 'prod',
  dev = 'dev',
}

/**
 * Helper types
 */
export interface Options {
  dev?: boolean;
  systemVersions?: SystemPackages;
}

export interface SystemPackages {
  [depName: string]: string;
}

export interface PackageRefCount {
  [depName: string]: number;
}

/**
 * Response type
 */
export interface ComposerParserResponse {
  name: string;
  version: string;
  packageFormatVersion: 'composer:0.0.1';
  dependencies: DepTreeDependencies;
}
