/**
 * 代码质量报告生成脚本
 * 生成代码质量指标的详细报告
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const srcDir = path.join(__dirname, '..');

console.log('='.repeat(60));
console.log('代码质量报告');
console.log('='.repeat(60));
console.log(`生成时间: ${new Date().toISOString()}`);
console.log('');

function countFiles(dir, extensions) {
  let count = 0;

  function scan(directory) {
    const items = fs.readdirSync(directory);

    for (const item of items) {
      if (item === 'node_modules' || item === '.git' || item === 'coverage') {
        continue;
      }

      const fullPath = path.join(directory, item);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        scan(fullPath);
      } else if (stat.isFile() && extensions.some(ext => item.endsWith(ext))) {
        count++;
      }
    }
  }

  scan(dir);
  return count;
}

function countLines(dir, extensions) {
  let totalLines = 0;
  let codeLines = 0;
  let commentLines = 0;
  let blankLines = 0;

  function scan(directory) {
    const items = fs.readdirSync(directory);

    for (const item of items) {
      if (item === 'node_modules' || item === '.git' || item === 'coverage') {
        continue;
      }

      const fullPath = path.join(directory, item);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        scan(fullPath);
      } else if (stat.isFile() && extensions.some(ext => item.endsWith(ext))) {
        const content = fs.readFileSync(fullPath, 'utf8');
        const lines = content.split('\n');

        totalLines += lines.length;

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed === '') {
            blankLines++;
          } else if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
            commentLines++;
          } else {
            codeLines++;
          }
        }
      }
    }
  }

  scan(dir);
  return { totalLines, codeLines, commentLines, blankLines };
}

function findLargeFunctions(dir, extensions) {
  const largeFunctions = [];

  function scan(directory) {
    const items = fs.readdirSync(directory);

    for (const item of items) {
      if (item === 'node_modules' || item === '.git' || item === 'coverage') {
        continue;
      }

      const fullPath = path.join(directory, item);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        scan(fullPath);
      } else if (stat.isFile() && extensions.some(ext => item.endsWith(ext))) {
        const content = fs.readFileSync(fullPath, 'utf8');
        const lines = content.split('\n');

        let braceCount = 0;
        let functionStart = 0;
        let functionName = '';

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];

          if (/^(export\s+)?(async\s+)?function\s+\w+/.test(line) ||
              /^(export\s+)?(async\s+)?\w+\s*=\s*(async\s+)?\(/.test(line)) {
            functionStart = i;
            functionName = line.trim();
            braceCount = 0;
          }

          braceCount += (line.match(/{/g) || []).length;
          braceCount -= (line.match(/}/g) || []).length;

          if (braceCount === 0 && functionStart > 0 && i - functionStart > 50) {
            largeFunctions.push({
              file: path.relative(srcDir, fullPath),
              line: functionStart + 1,
              lines: i - functionStart + 1,
              name: functionName
            });
          }
        }
      }
    }
  }

  scan(dir);
  return largeFunctions;
}

function findDuplicateCode(dir) {
  const codeBlocks = {};
  const duplicates = [];

  function scan(directory) {
    const items = fs.readdirSync(directory);

    for (const item of items) {
      if (item === 'node_modules' || item === '.git' || item === 'coverage' || item.endsWith('.test.js')) {
        continue;
      }

      const fullPath = path.join(directory, item);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        scan(fullPath);
      } else if (stat.isFile() && item.endsWith('.js')) {
        const content = fs.readFileSync(fullPath, 'utf8');
        const lines = content.split('\n');

        let block = [];
        let inBlock = false;

        for (const line of lines) {
          const trimmed = line.trim();

          if (trimmed.length > 10 && !trimmed.startsWith('//') && !trimmed.startsWith('*')) {
            block.push(trimmed);
            inBlock = true;
          } else if (inBlock) {
            if (block.length >= 4) {
              const hash = block.join('').substring(0, 100);
              if (codeBlocks[hash]) {
                duplicates.push({
                  hash,
                  locations: codeBlocks[hash],
                  new: path.relative(srcDir, fullPath)
                });
              } else {
                codeBlocks[hash] = path.relative(srcDir, fullPath);
              }
            }
            block = [];
            inBlock = false;
          }
        }
      }
    }
  }

  scan(dir);
  return duplicates;
}

console.log('📊 代码规模统计');
console.log('-'.repeat(40));

const jsFiles = countFiles(path.join(srcDir, 'server'), ['.js']);
const lines = countLines(path.join(srcDir, 'server'), ['.js']);

console.log(`JavaScript 文件数: ${jsFiles}`);
console.log(`总代码行数: ${lines.totalLines}`);
console.log(`  - 代码行: ${lines.codeLines}`);
console.log(`  - 注释行: ${lines.commentLines}`);
console.log(`  - 空白行: ${lines.blankLines}`);
console.log(`注释率: ${((lines.commentLines / lines.totalLines) * 100).toFixed(1)}%`);

console.log('\n📏 函数复杂度分析');
console.log('-'.repeat(40));

const largeFunctions = findLargeFunctions(path.join(srcDir, 'server'), ['.js']);

if (largeFunctions.length > 0) {
  console.log('⚠️  发现过长函数 (>50行):');
  largeFunctions.forEach(fn => {
    console.log(`  - ${fn.file}:${fn.line} (${fn.lines}行)`);
    console.log(`    ${fn.name}`);
  });
} else {
  console.log('✅ 所有函数长度均在合理范围内');
}

console.log('\n🔄 代码重复分析');
console.log('-'.repeat(40));

const duplicates = findDuplicateCode(path.join(srcDir, 'server'));

if (duplicates.length > 0) {
  console.log(`⚠️  发现 ${duplicates.length} 处潜在重复代码`);
  duplicates.slice(0, 5).forEach(dup => {
    console.log(`  - ${dup.locations} & ${dup.new}`);
  });
} else {
  console.log('✅ 未发现明显重复代码');
}

console.log('\n📦 依赖分析');
console.log('-'.repeat(40));

try {
  const packageJson = JSON.parse(fs.readFileSync(path.join(srcDir, 'package.json'), 'utf8'));
  const depsCount = Object.keys(packageJson.dependencies || {}).length;
  const devDepsCount = Object.keys(packageJson.devDependencies || {}).length;

  console.log(`生产依赖: ${depsCount}`);
  console.log(`开发依赖: ${devDepsCount}`);
} catch (error) {
  console.log('⚠️  无法读取 package.json');
}

console.log('\n🧪 测试覆盖');
console.log('-'.repeat(40));

try {
  const coverageDir = path.join(srcDir, 'coverage');
  if (fs.existsSync(coverageDir)) {
    const lcovFile = path.join(coverageDir, 'lcov.info');
    if (fs.existsSync(lcovFile)) {
      const lcov = fs.readFileSync(lcovFile, 'utf8');
      const linesCovered = (lcov.match(/LH:/g) || []).length;
      const linesTotal = (lcov.match(/LF:/g) || []).length;
      const coverage = linesTotal > 0 ? ((linesCovered / linesTotal) * 100).toFixed(1) : 'N/A';

      console.log(`行覆盖率: ${coverage}%`);
    }
  } else {
    console.log('⚠️  尚未生成覆盖率报告');
    console.log('  运行: npm test');
  }
} catch (error) {
  console.log('⚠️  无法读取覆盖率报告');
}

console.log('\n🔒 安全状态');
console.log('-'.repeat(40));

try {
  const audit = execSync('npm audit --json', {
    encoding: 'utf8',
    cwd: srcDir
  });
  const auditResult = JSON.parse(audit);
  const vulns = auditResult.metadata?.vulnerabilities || {};

  const total = Object.values(vulns).reduce((sum, v) => sum + v, 0);

  if (total > 0) {
    console.log(`⚠️  发现 ${total} 个安全漏洞:`);
    console.log(`  - 严重: ${vulns.critical || 0}`);
    console.log(`  - 高危: ${vulns.high || 0}`);
    console.log(`  - 中危: ${vulns.moderate || 0}`);
    console.log(`  - 低危: ${vulns.low || 0}`);
  } else {
    console.log('✅ 未发现安全漏洞');
  }
} catch (error) {
  if (error.stdout) {
    try {
      const auditResult = JSON.parse(error.stdout);
      const vulns = auditResult.metadata?.vulnerabilities || {};
      const total = Object.values(vulns).reduce((sum, v) => sum + v, 0);
      console.log(total > 0 ? `⚠️  发现 ${total} 个安全漏洞` : '✅ 未发现安全漏洞');
    } catch (e) {
      console.log('⚠️  无法解析审计结果');
    }
  } else {
    console.log('⚠️  无法运行安全审计');
  }
}

console.log('\n' + '='.repeat(60));
console.log('报告生成完成');
console.log('='.repeat(60));

console.log('\n💡 改进建议:');

if (largeFunctions.length > 0) {
  console.log(`1. 拆分 ${largeFunctions.length} 个过长函数`);
}

if (duplicates.length > 0) {
  console.log(`2. 提取 ${duplicates.length} 处重复代码为公共函数`);
}

console.log('3. 增加测试覆盖率至 80% 以上');
console.log('4. 修复所有安全漏洞');
console.log('5. 定期运行 npm audit 和 npm update');
