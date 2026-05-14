export const DEFAULT_EXCLUDED_DIRS = [
  'node_modules',
  'vendor',
  'venv',
  'env',
  '.venv',
  '__pycache__',
  'target',
  'build',
  'dist',
  'out',
  'bin',
  'obj',
  '.git',
  '.svn',
  '.hg',
  '.next',
  '.nuxt',
  '.cache',
  '.parcel-cache',
  'coverage',
  'packages',
  'bower_components',
  'jspm_packages',
];

export function toGlobIgnore(dirs) {
  const patterns = [];
  for (const dir of dirs) {
    patterns.push(`**/${dir}`);
    patterns.push(`**/${dir}/**`);
  }
  return patterns;
}
