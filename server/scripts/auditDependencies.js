/**
 * 依赖管理和安全审计脚本
 * 用于检查依赖版本、安全漏洞和未使用的依赖
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const packageJsonPath = path.join(__dirname, '../package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

console.log('='.repeat(60));
console.log('依赖管理和安全审计报告');
console.log('='.repeat(60));
console.log(`生成时间: ${new Date().toISOString()}`);
console.log('');

console.log('📦 依赖概览');
console.log('-'.repeat(40));
console.log(`生产依赖: ${Object.keys(packageJson.dependencies || {}).length}`);
console.log(`开发依赖: ${Object.keys(packageJson.devDependencies || {}).length}`);
console.log('');

console.log('🔍 正在检查过时依赖...');
try {
  const outdated = execSync('npm outdated --json', {
    encoding: 'utf8',
    cwd: path.join(__dirname, '..')
  });
  const outdatedDeps = JSON.parse(outdated);

  if (Object.keys(outdatedDeps).length > 0) {
    console.log('\n⚠️  发现过时依赖:');
    for (const [name, info] of Object.entries(outdatedDeps)) {
      console.log(`  - ${name}: ${info.current} → ${info.latest} (wanted: ${info.wanted})`);
    }
  } else {
    console.log('  ✅ 所有依赖都是最新版本');
  }
} catch (error) {
  if (error.stdout) {
    const outdatedDeps = JSON.parse(error.stdout);
    if (Object.keys(outdatedDeps).length > 0) {
      console.log('\n⚠️  发现过时依赖:');
      for (const [name, info] of Object.entries(outdatedDeps)) {
        console.log(`  - ${name}: ${info.current} → ${info.latest}`);
      }
    }
  } else {
    console.log('  ✅ 所有依赖都是最新版本');
  }
}

console.log('\n🔒 正在检查安全漏洞...');
try {
  const audit = execSync('npm audit --json', {
    encoding: 'utf8',
    cwd: path.join(__dirname, '..')
  });
  const auditResult = JSON.parse(audit);

  if (auditResult.metadata.vulnerabilities &&
      Object.values(auditResult.metadata.vulnerabilities).some(v => v > 0)) {
    console.log('\n⚠️  发现安全漏洞:');

    const vulns = auditResult.metadata.vulnerabilities;
    console.log(`  - 严重: ${vulns.critical || 0}`);
    console.log(`  - 高危: ${vulns.high || 0}`);
    console.log(`  - 中危: ${vulns.moderate || 0}`);
    console.log(`  - 低危: ${vulns.low || 0}`);

    if (auditResult.vulnerabilities) {
      console.log('\n详细漏洞列表:');
      for (const [name, vuln] of Object.entries(auditResult.vulnerabilities)) {
        if (vuln.via && vuln.via.length > 0) {
          const severity = vuln.severity || 'unknown';
          console.log(`  [${severity.toUpperCase()}] ${name}`);
          if (typeof vuln.via[0] === 'object') {
            console.log(`    ${vuln.via[0].title}`);
            if (vuln.via[0].url) {
              console.log(`    参考: ${vuln.via[0].url}`);
            }
          }
        }
      }
    }
  } else {
    console.log('  ✅ 未发现安全漏洞');
  }
} catch (error) {
  if (error.stdout) {
    const auditResult = JSON.parse(error.stdout);
    if (auditResult.metadata.vulnerabilities &&
        Object.values(auditResult.metadata.vulnerabilities).some(v => v > 0)) {
      console.log('  ⚠️  发现安全漏洞');
    } else {
      console.log('  ✅ 未发现安全漏洞');
    }
  } else {
    console.log('  ⚠️  无法运行安全审计');
  }
}

console.log('\n📋 依赖使用分析');
console.log('-'.repeat(40));

const srcDir = path.join(__dirname, '..');
const dependencies = Object.keys(packageJson.dependencies || {});
const dependencyUsage = {};

dependencies.forEach(dep => {
  dependencyUsage[dep] = {
    used: false,
    files: []
  };
});

function scanDirectory(dir, excludeDirs = ['node_modules', '.git', 'coverage']) {
  if (!fs.existsSync(dir)) return;

  const items = fs.readdirSync(dir);

  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      if (!excludeDirs.includes(item)) {
        scanDirectory(fullPath, excludeDirs);
      }
    } else if (stat.isFile() && /\.(js|jsx|ts|tsx)$/.test(item)) {
      const content = fs.readFileSync(fullPath, 'utf8');

      dependencies.forEach(dep => {
        const patterns = [
          new RegExp(`require\\s*\\(['"]${dep}['"]\\)`),
          new RegExp(`import\\s+.*from\\s+['"]${dep}['"]`),
          new RegExp(`import\\s+['"]${dep}['"]`)
        ];

        if (patterns.some(p => p.test(content))) {
          dependencyUsage[dep].used = true;
          dependencyUsage[dep].files.push(path.relative(srcDir, fullPath));
        }
      });
    }
  }
}

scanDirectory(srcDir);

const unusedDeps = Object.entries(dependencyUsage)
  .filter(([_, info]) => !info.used)
  .map(([name]) => name);

if (unusedDeps.length > 0) {
  console.log('\n⚠️  未使用的生产依赖:');
  unusedDeps.forEach(dep => console.log(`  - ${dep}`));
} else {
  console.log('  ✅ 所有生产依赖都在使用中');
}

console.log('\n📊 依赖大小分析');
console.log('-'.repeat(40));
try {
  const npmLs = execSync('npm ls --json --depth=1', {
    encoding: 'utf8',
    cwd: path.join(__dirname, '..')
  });
  const npmLsResult = JSON.parse(npmLs);

  if (npmLsResult.dependencies) {
    const largeDeps = [];

    function checkDeps(deps, indent = 0) {
      for (const [name, info] of Object.entries(deps)) {
        if (info.size) {
          const sizeMB = info.size / 1024 / 1024;
          if (sizeMB > 5) {
            largeDeps.push({ name, size: sizeMB });
          }
        }
        if (info.dependencies) {
          checkDeps(info.dependencies, indent + 1);
        }
      }
    }

    checkDeps(npmLsResult.dependencies);

    if (largeDeps.length > 0) {
      console.log('\n⚠️  大型依赖包 (>5MB):');
      largeDeps.forEach(dep => {
        console.log(`  - ${dep.name}: ${dep.size.toFixed(2)}MB`);
      });
    } else {
      console.log('  ✅ 没有发现异常大的依赖包');
    }
  }
} catch (error) {
  console.log('  ⚠️  无法获取依赖大小信息');
}

console.log('\n' + '='.repeat(60));
console.log('审计完成');
console.log('='.repeat(60));

console.log('\n💡 建议:');
if (unusedDeps.length > 0) {
  console.log(`  1. 移除未使用的依赖: npm uninstall ${unusedDeps.join(' ')}`);
}
console.log('  2. 定期运行 npm update 更新依赖');
console.log('  3. 定期运行 npm audit 修复安全漏洞');
console.log('  4. 使用 npm install --save-exact 锁定精确版本');
