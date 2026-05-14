import fs from 'node:fs/promises';
import { EXT_TO_LANGUAGE, SPECIAL_FILE_TO_LANGUAGE } from './constants/languages.js';
import {
  NODE_FRAMEWORKS,
  NODE_BUILD_TOOLS,
  NODE_DB_HINTS,
  PYTHON_FRAMEWORKS,
  PHP_FRAMEWORKS,
  RUBY_FRAMEWORKS,
  JAVA_FRAMEWORK_KEYWORDS,
  GO_MODULE_HINTS,
  RUST_CRATE_HINTS,
  BUILD_CONFIG_FILES,
} from './constants/frameworks.js';

export function detectLanguage(file) {
  const byBase = SPECIAL_FILE_TO_LANGUAGE[file.basename.toLowerCase()];
  if (byBase) return byBase;
  return EXT_TO_LANGUAGE[file.ext] || null;
}

async function readJsonSafe(absPath) {
  try {
    const text = await fs.readFile(absPath, 'utf8');
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function readTextSafe(absPath) {
  try {
    return await fs.readFile(absPath, 'utf8');
  } catch {
    return null;
  }
}

function escapeReg(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function indexByBasename(files) {
  const map = new Map();
  for (const f of files) {
    const key = f.basename.toLowerCase();
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(f);
  }
  return map;
}

const NODE_LOCKFILES = [
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'bun.lockb',
  'bun.lock',
];

async function detectFromNodePackageJson(packageFiles, byBasename, sets) {
  if (packageFiles.length === 0) return;
  for (const f of packageFiles) {
    const pkg = await readJsonSafe(f.absPath);
    if (!pkg) continue;
    const allDeps = {
      ...(pkg.dependencies || {}),
      ...(pkg.devDependencies || {}),
      ...(pkg.peerDependencies || {}),
      ...(pkg.optionalDependencies || {}),
    };
    for (const dep of Object.keys(allDeps)) {
      if (NODE_FRAMEWORKS[dep]) sets.frameworks.add(NODE_FRAMEWORKS[dep]);
      if (NODE_BUILD_TOOLS[dep]) sets.buildTools.add(NODE_BUILD_TOOLS[dep]);
      if (NODE_DB_HINTS[dep]) sets.databases.add(NODE_DB_HINTS[dep]);
    }
    if (pkg.packageManager && typeof pkg.packageManager === 'string') {
      const pm = pkg.packageManager.split('@')[0];
      if (pm) sets.packageManagers.add(pm);
    }
  }
  const hasNodeLock = NODE_LOCKFILES.some((n) => byBasename.has(n));
  if (!hasNodeLock) sets.packageManagers.add('npm');
}

async function detectFromRequirementsTxt(files, sets) {
  for (const f of files) {
    const text = await readTextSafe(f.absPath);
    if (!text) continue;
    sets.packageManagers.add('pip');
    for (const rawLine of text.split('\n')) {
      const line = rawLine.split('#')[0].trim();
      if (!line) continue;
      const name = line.split(/[<>=!~\s;[]/)[0].toLowerCase();
      if (PYTHON_FRAMEWORKS[name]) sets.frameworks.add(PYTHON_FRAMEWORKS[name]);
    }
  }
}

async function detectFromPyprojectToml(files, sets) {
  for (const f of files) {
    const text = await readTextSafe(f.absPath);
    if (!text) continue;
    for (const [key, value] of Object.entries(PYTHON_FRAMEWORKS)) {
      const re = new RegExp(`["'\\s,]${escapeReg(key)}[=<>~!\\s"',\\^]`, 'i');
      if (re.test(text)) sets.frameworks.add(value);
    }
    if (/\[tool\.poetry\]/i.test(text)) sets.packageManagers.add('poetry');
    if (/\[tool\.hatch/i.test(text)) sets.buildTools.add('Hatch');
    if (/\[tool\.pdm\]/i.test(text)) sets.packageManagers.add('pdm');
  }
}

async function detectFromPipfile(files, sets) {
  for (const f of files) {
    const text = await readTextSafe(f.absPath);
    if (!text) continue;
    sets.packageManagers.add('pipenv');
    for (const [key, value] of Object.entries(PYTHON_FRAMEWORKS)) {
      const re = new RegExp(`^\\s*${escapeReg(key)}\\s*=`, 'mi');
      if (re.test(text)) sets.frameworks.add(value);
    }
  }
}

async function detectFromJavaManifests(files, sets, isGradle) {
  for (const f of files) {
    const text = await readTextSafe(f.absPath);
    if (!text) continue;
    if (isGradle) {
      sets.packageManagers.add('Gradle');
      sets.buildTools.add('Gradle');
    } else {
      sets.packageManagers.add('Maven');
      sets.buildTools.add('Maven');
    }
    const lower = text.toLowerCase();
    for (const [key, value] of Object.entries(JAVA_FRAMEWORK_KEYWORDS)) {
      if (lower.includes(key.toLowerCase())) sets.frameworks.add(value);
    }
  }
}

async function detectFromGoMod(files, sets) {
  for (const f of files) {
    const text = await readTextSafe(f.absPath);
    if (!text) continue;
    sets.packageManagers.add('go mod');
    for (const [key, value] of Object.entries(GO_MODULE_HINTS)) {
      if (text.includes(key)) sets.frameworks.add(value);
    }
  }
}

async function detectFromCargoToml(files, sets) {
  for (const f of files) {
    const text = await readTextSafe(f.absPath);
    if (!text) continue;
    sets.packageManagers.add('cargo');
    for (const [key, value] of Object.entries(RUST_CRATE_HINTS)) {
      const re = new RegExp(`^\\s*${escapeReg(key)}\\s*=`, 'mi');
      if (re.test(text)) sets.frameworks.add(value);
    }
  }
}

async function detectFromComposerJson(files, sets) {
  for (const f of files) {
    const pkg = await readJsonSafe(f.absPath);
    if (!pkg) continue;
    sets.packageManagers.add('composer');
    const allDeps = {
      ...(pkg.require || {}),
      ...(pkg['require-dev'] || {}),
    };
    for (const dep of Object.keys(allDeps)) {
      if (PHP_FRAMEWORKS[dep]) sets.frameworks.add(PHP_FRAMEWORKS[dep]);
    }
  }
}

async function detectFromGemfile(files, sets) {
  for (const f of files) {
    const text = await readTextSafe(f.absPath);
    if (!text) continue;
    sets.packageManagers.add('bundler');
    for (const [key, value] of Object.entries(RUBY_FRAMEWORKS)) {
      const re = new RegExp(`gem\\s+['"]${escapeReg(key)}['"]`);
      if (re.test(text)) sets.frameworks.add(value);
    }
  }
}

async function detectFromPubspecYaml(files, sets) {
  for (const f of files) {
    const text = await readTextSafe(f.absPath);
    if (!text) continue;
    sets.packageManagers.add('pub');
    if (/^\s*flutter\s*:/m.test(text) || /sdk\s*:\s*flutter/.test(text)) {
      sets.frameworks.add('Flutter');
    } else {
      sets.frameworks.add('Dart');
    }
  }
}

function detectDotnetProjects(files, sets) {
  for (const f of files) {
    if (f.ext === '.csproj' || f.ext === '.fsproj' || f.ext === '.vbproj') {
      sets.frameworks.add('.NET');
      sets.packageManagers.add('NuGet');
    }
    if (f.ext === '.sln') {
      sets.frameworks.add('.NET');
    }
  }
}

async function detectDotnetAspNet(files, sets) {
  for (const f of files) {
    if (f.ext !== '.csproj') continue;
    const text = await readTextSafe(f.absPath);
    if (text && text.includes('Microsoft.AspNetCore')) {
      sets.frameworks.add('ASP.NET Core');
    }
  }
}

function detectBuildConfigs(byBasename, sets) {
  for (const [name, tool] of Object.entries(BUILD_CONFIG_FILES)) {
    if (byBasename.has(name)) sets.buildTools.add(tool);
  }
}

function detectLockfilePackageManagers(byBasename, sets) {
  const lockfiles = {
    'package-lock.json': 'npm',
    'yarn.lock': 'yarn',
    'pnpm-lock.yaml': 'pnpm',
    'bun.lockb': 'bun',
    'bun.lock': 'bun',
    'poetry.lock': 'poetry',
    'cargo.lock': 'cargo',
    'go.sum': 'go mod',
    'composer.lock': 'composer',
    'gemfile.lock': 'bundler',
    'pipfile.lock': 'pipenv',
  };
  for (const [name, pm] of Object.entries(lockfiles)) {
    if (byBasename.has(name)) sets.packageManagers.add(pm);
  }
}

export async function detectFrameworks(_root, files) {
  const sets = {
    frameworks: new Set(),
    packageManagers: new Set(),
    buildTools: new Set(),
    databases: new Set(),
  };

  const byBasename = indexByBasename(files);
  const get = (name) => byBasename.get(name) || [];

  await detectFromNodePackageJson(get('package.json'), byBasename, sets);
  await detectFromRequirementsTxt(get('requirements.txt'), sets);
  await detectFromPyprojectToml(get('pyproject.toml'), sets);
  await detectFromPipfile(get('pipfile'), sets);
  await detectFromJavaManifests(get('pom.xml'), sets, false);
  await detectFromJavaManifests(
    [...get('build.gradle'), ...get('build.gradle.kts')],
    sets,
    true,
  );
  await detectFromGoMod(get('go.mod'), sets);
  await detectFromCargoToml(get('cargo.toml'), sets);
  await detectFromComposerJson(get('composer.json'), sets);
  await detectFromGemfile(get('gemfile'), sets);
  await detectFromPubspecYaml(get('pubspec.yaml'), sets);

  detectDotnetProjects(files, sets);
  await detectDotnetAspNet(files, sets);
  detectBuildConfigs(byBasename, sets);
  detectLockfilePackageManagers(byBasename, sets);

  return {
    frameworks: [...sets.frameworks].sort(),
    packageManagers: [...sets.packageManagers].sort(),
    buildTools: [...sets.buildTools].sort(),
    databases: [...sets.databases].sort(),
  };
}
