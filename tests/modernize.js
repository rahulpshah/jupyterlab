/* eslint-disable no-console */
const fs = require('fs-extra');
const glob = require('glob');
const path = require('path');
const utils = require('@jupyterlab/buildutils');

let target = process.argv[2];
if (!target) {
  console.error('Specify a target dir');
  process.exit(1);
}
if (target.indexOf('test-') !== 0) {
  target = 'test-' + target;
}

// Make sure folder exists
let testSrc = path.join(__dirname, target);

console.debug(testSrc); // eslint-disable-line
if (!fs.existsSync(testSrc)) {
  console.debug('bailing'); // eslint-disable-line
  process.exit(1);
}

const pkgPath = path.resolve(path.join(__dirname, '../packages'));
const name = target.replace('test-', '');

// Convert to jest if needed
if (fs.existsSync(path.join(testSrc, 'karma.conf.js'))) {
  utils.run(`node convert-to-jest.js ${name}`);
}

// Copy files from console
['tsconfig.test.json', 'babel.config.js', 'jest.config.js'].forEach(fname => {
  const srcPath = path.join(pkgPath, 'console', fname);
  fs.copySync(srcPath, path.join(testSrc, fname));
});

// Update target package.json
const sourceData = utils.readJSONFile(
  path.join(pkgPath, 'console', 'package.json')
);
const targetData = utils.readJSONFile(path.join(pkgPath, name, 'package.json'));
// Add dev dependencies
['@jupyterlab/testutils', '@types/jest', 'jest', 'ts-jest'].forEach(dep => {
  targetData['devDependencies'][dep] = sourceData['devDependencies'][dep];
});
// Update scripts
[
  'build:test',
  'test',
  'test:cov',
  'test:debug',
  'test:debug:watch',
  'watch'
].forEach(script => {
  targetData['scripts'][script] = sourceData['scripts'][script];
});
utils.writeJSONFile(path.join(pkgPath, name, 'package.json'), targetData);

// Update tsconfigs.json - Remove skipLibCheck (added because jest and mocha types confict)
const tsData = utils.readJSONFile(path.join(testSrc, 'tsconfig.json'));
delete tsData['compilerOptions']['skipLibCheck'];
utils.writeJSONFile(path.join(testSrc, 'tsconfig.json'), tsData);

// Update the test files to use imports from `../src` and import "jest"
glob.sync(path.join(testSrc, 'src', '**', '*.ts*')).forEach(function(filePath) {
  console.debug(filePath);
  let src = fs.readFileSync(filePath, 'utf8');
  src = src.split(`'@jupyterlab/${name}/src';`).join(`'../src';`);
  let lines = src.split('\n');
  let i = 0;
  while (!lines[i++].startsWith('//')) {
    // no-op
  }
  lines.splice(i, 0, ["\nimport 'jest';"]);
  fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
});

// Run jest-codemods to convert from chai to jest.
console.debug('------------------------------------');
console.debug('Select the following options');
console.debug('TypeScript & TSX');
console.debug('Chai : Should / Expect BDD Syntax');
console.debug("Yes, and I'm not afraid of false positive transformations");
console.debug('Yes, use the globals provided by Jest(recommended)');
console.debug('.');
console.debug('------------------------------------');
utils.run('jlpm jest-codemods --force', { cwd: testSrc });

// Move the test config files to `/packages/{name}`
utils.run(`git mv ${testSrc}/src ${pkgPath}/${name}/test`);
['tsconfig.test.json', 'babel.config.js', 'jest.config.js'].forEach(fname => {
  utils.run(`mv ${testSrc}/${fname} ${pkgPath}/${name}`);
});
utils.run(`git add ${pkgPath}/${name}`);

// Add a vscode launch file and force it to commit.
utils.run(`mkdir -p ${pkgPath}/${name}/.vscode`);
utils.run(
  `cp ${pkgPath}/console/.vscode/launch.json ${pkgPath}/${name}/.vscode`
);
utils.run(`git add -f ${pkgPath}/${name}/.vscode/launch.json`);

// Remove local folder
utils.run(`git rm -rf ${testSrc} && rm -rf ${testSrc}`);

// Run integrity
const rootDir = path.resolve('..');
utils.run(`jlpm integrity`, {
  cwd: rootDir
});
