/**
 * 配置管理模块
 * 提供集中式配置管理、多环境支持和配置版本控制
 */

const fs = require('fs');
const path = require('path');

class ConfigManager {
  constructor() {
    this.config = {};
    this.configDir = path.join(__dirname, '../config');
    this.env = process.env.NODE_ENV || 'development';
    this.configCache = new Map();
    this.versionHistory = [];
  }

  load() {
    console.log(`[配置] 加载环境配置: ${this.env}`);

    const defaultConfig = this.loadFile('default.json');
    const envConfig = this.loadFile(`${this.env}.json`);
    const localConfig = this.loadFile('local.json');

    this.config = {
      ...defaultConfig,
      ...envConfig,
      ...localConfig,
      _meta: {
        env: this.env,
        loadedAt: new Date().toISOString()
      }
    };

    this.applyEnvironmentVariables();

    console.log('[配置] 配置加载完成');

    return this.config;
  }

  loadFile(filename) {
    const filePath = path.join(this.configDir, filename);

    if (!fs.existsSync(filePath)) {
      return {};
    }

    try {
      const content = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      console.error(`[配置] 加载文件失败 ${filename}:`, error.message);
      return {};
    }
  }

  applyEnvironmentVariables() {
    const envMappings = {
      'database.host': 'DB_HOST',
      'database.port': 'DB_PORT',
      'database.user': 'DB_USER',
      'database.password': 'DB_PASSWORD',
      'database.database': 'DB_NAME',
      'redis.host': 'REDIS_HOST',
      'redis.port': 'REDIS_PORT',
      'redis.password': 'REDIS_PASSWORD',
      'app.port': 'APP_PORT',
      'app.host': 'APP_HOST',
      'jwt.secret': 'JWT_SECRET',
      'jwt.expiresIn': 'JWT_EXPIRES_IN'
    };

    for (const [configPath, envVar] of Object.entries(envMappings)) {
      if (process.env[envVar]) {
        this.set(configPath, this.parseValue(process.env[envVar]));
      }
    }
  }

  parseValue(value) {
    if (value === 'true') return true;
    if (value === 'false') return false;
    if (value === 'null') return null;
    if (/^\d+$/.test(value)) return parseInt(value, 10);
    if (/^\d+\.\d+$/.test(value)) return parseFloat(value);
    return value;
  }

  get(path, defaultValue = undefined) {
    const keys = path.split('.');
    let value = this.config;

    for (const key of keys) {
      if (value === undefined || value === null) {
        return defaultValue;
      }
      value = value[key];
    }

    if (value === undefined) {
      return defaultValue;
    }

    return value;
  }

  set(path, value) {
    const keys = path.split('.');
    let current = this.config;

    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!(key in current)) {
        current[key] = {};
      }
      current = current[key];
    }

    const oldValue = current[keys[keys.length - 1]];
    current[keys[keys.length - 1]] = value;

    this.configCache.clear();
  }

  has(path) {
    return this.get(path) !== undefined;
  }

  getAll() {
    return { ...this.config };
  }

  update(path, value, reason = '') {
    const oldValue = this.get(path);

    this.versionHistory.push({
      path,
      oldValue,
      newValue: value,
      timestamp: new Date().toISOString(),
      reason
    });

    this.set(path, value);

    console.log(`[配置] 更新配置 ${path}:`, { from: oldValue, to: value, reason });

    return { path, oldValue, newValue: value };
  }

  getVersionHistory(path = null) {
    if (path) {
      return this.versionHistory.filter(v => v.path === path);
    }
    return [...this.versionHistory];
  }

  rollback(versionIndex) {
    if (versionIndex < 0 || versionIndex >= this.versionHistory.length) {
      throw new Error('无效的版本索引');
    }

    const version = this.versionHistory[versionIndex];
    this.set(version.path, version.oldValue);

    console.log(`[配置] 回滚配置 ${version.path} 到值:`, version.oldValue);

    return version;
  }

  reload() {
    this.configCache.clear();
    return this.load();
  }

  save() {
    const savePath = path.join(this.configDir, `${this.env}.json`);
    const configToSave = { ...this.config };
    delete configToSave._meta;

    fs.writeFileSync(savePath, JSON.stringify(configToSave, null, 2));

    console.log(`[配置] 配置已保存到 ${savePath}`);
  }
}

class FeatureFlags {
  constructor() {
    this.flags = {
      enableCache: true,
      enableWebSocket: true,
      enableBatchApi: true,
      enableCompression: true,
      enableRateLimit: true,
      enableMetrics: true
    };
    this.overrides = new Map();
  }

  enable(feature) {
    this.flags[feature] = true;
    console.log(`[功能开关] 启用: ${feature}`);
  }

  disable(feature) {
    this.flags[feature] = false;
    console.log(`[功能开关] 禁用: ${feature}`);
  }

  isEnabled(feature) {
    if (this.overrides.has(feature)) {
      return this.overrides.get(feature);
    }
    return this.flags[feature] || false;
  }

  setOverride(feature, value) {
    this.overrides.set(feature, value);
    console.log(`[功能开关] 覆盖 ${feature} = ${value}`);
  }

  clearOverride(feature) {
    this.overrides.delete(feature);
  }

  getAll() {
    return { ...this.flags };
  }
}

class EnvironmentConfig {
  constructor() {
    this.env = process.env.NODE_ENV || 'development';
    this.configs = this.loadAllEnvironments();
  }

  loadAllEnvironments() {
    const envs = ['development', 'test', 'staging', 'production'];
    const configs = {};

    for (const env of envs) {
      const configPath = path.join(__dirname, `../config/${env}.json`);
      if (fs.existsSync(configPath)) {
        try {
          configs[env] = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        } catch (error) {
          configs[env] = {};
        }
      }
    }

    return configs;
  }

  getCurrent() {
    return this.configs[this.env] || {};
  }

  getEnvironment(name) {
    return this.configs[name] || null;
  }

  getAllEnvironments() {
    return Object.keys(this.configs);
  }

  compare(env1, env2) {
    const config1 = this.configs[env1] || {};
    const config2 = this.configs[env2] || {};

    const differences = [];

    const allKeys = new Set([
      ...Object.keys(config1),
      ...Object.keys(config2)
    ]);

    for (const key of allKeys) {
      if (JSON.stringify(config1[key]) !== JSON.stringify(config2[key])) {
        differences.push({
          key,
          [env1]: config1[key],
          [env2]: config2[key]
        });
      }
    }

    return differences;
  }
}

const configManager = new ConfigManager();
const featureFlags = new FeatureFlags();
const environmentConfig = new EnvironmentConfig();

module.exports = {
  ConfigManager,
  FeatureFlags,
  EnvironmentConfig,
  configManager,
  featureFlags,
  environmentConfig
};
