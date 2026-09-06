/* Metro has to be told about the monorepo: the shared packages live outside
   this app's folder, and dependencies resolve from the workspace root. */
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules')
];
config.resolver.disableHierarchicalLookup = true;

/* @wag/api-client exposes a "./app" subpath through package exports, which
   Metro only honours with this flag. */
config.resolver.unstable_enablePackageExports = true;
config.resolver.unstable_conditionNames = ['require', 'import', 'react-native', 'default'];

module.exports = config;
