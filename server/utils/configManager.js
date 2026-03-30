/**
 * 配置管理器
 * 提供动态配置管理、配置验证和热更新功能
 */

const path = require('path');
const fs = require('fs');

class ConfigManager {
  constructor() {
    this.config = {};
    this.configFile = path.join(__dirname, '../config.json');
    this.listeners = new Set();
  }

  /**
   * 加载配置
   * @param {string} configFile 配置文件路径
   * @returns {Object} 配置对象
   */
  loadConfig(configFile = this.configFile) {
    try {
      if (fs.existsSync(configFile)) {
        const configContent = fs.readFileSync(configFile, 'utf8');
        this.config = JSON.parse(configContent);
        console.log('配置加载成功');
      } else {
        console.warn('配置文件不存在，使用默认配置');
        this.config = this.getDefaultConfig();
        this.saveConfig();
      }
      return this.config;
    } catch (error) {
      console.error('配置加载失败:', error);
      this.config = this.getDefaultConfig();
      return this.config;
    }
  }

  /**
   * 保存配置
   * @param {string} configFile 配置文件路径
   * @returns {boolean} 是否保存成功
   */
  saveConfig(configFile = this.configFile) {
    try {
      fs.writeFileSync(configFile, JSON.stringify(this.config, null, 2));
      console.log('配置保存成功');
      return true;
    } catch (error) {
      console.error('配置保存失败:', error);
      return false;
    }
  }

  /**
   * 获取配置
   * @param {string} key 配置键
   * @param {*} defaultValue 默认值
   * @returns {*} 配置值
   */
  get(key, defaultValue = undefined) {
    if (!key) return this.config;

    const keys = key.split('.');
    let value = this.config;

    for (const k of keys) {
      if (value === undefined || value === null) {
        return defaultValue;
      }
      value = value[k];
    }

    return value === undefined ? defaultValue : value;
  }

  /**
   * 设置配置
   * @param {string} key 配置键
   * @param {*} value 配置值
   * @returns {boolean} 是否设置成功
   */
  set(key, value) {
    try {
      const keys = key.split('.');
      let config = this.config;

      for (let i = 0; i < keys.length - 1; i++) {
        const k = keys[i];
        if (!config[k]) {
          config[k] = {};
        }
        config = config[k];
      }

      config[keys[keys.length - 1]] = value;
      this.saveConfig();
      this.notifyListeners();
      return true;
    } catch (error) {
      console.error('配置设置失败:', error);
      return false;
    }
  }

  /**
   * 重置配置
   * @returns {boolean} 是否重置成功
   */
  resetConfig() {
    this.config = this.getDefaultConfig();
    return this.saveConfig();
  }

  /**
   * 获取默认配置
   * @returns {Object} 默认配置
   */
  getDefaultConfig() {
    return {
      server: {
        port: 3001,
        nodeEnv: 'development',
      },
      database: {
        type: 'mysql',
        host: 'localhost',
        port: 3306,
        user: 'root',
        password: 'Steven84',
        database: 'mseism',
      },
      plugins: {
        enabled: true,
        directory: './plugins',
      },
      features: {
        performanceMonitoring: true,
        operationLogging: true,
        rateLimiting: true,
        csrfProtection: true,
      },
    };
  }

  /**
   * 注册配置变更监听器
   * @param {Function} listener 监听器函数
   */
  onConfigChange(listener) {
    this.listeners.add(listener);
  }

  /**
   * 移除配置变更监听器
   * @param {Function} listener 监听器函数
   */
  offConfigChange(listener) {
    this.listeners.delete(listener);
  }

  /**
   * 通知配置变更
   */
  notifyListeners() {
    for (const listener of this.listeners) {
      try {
        listener(this.config);
      } catch (error) {
        console.error('配置变更监听器执行失败:', error);
      }
    }
  }

  /**
   * 验证配置
   * @param {Object} config 配置对象
   * @returns {Object} 验证结果
   */
  validateConfig(config) {
    try {
      // 简单的配置验证
      if (typeof config !== 'object' || config === null) {
        return { valid: false, message: '配置必须是对象' };
      }

      if (config.server && typeof config.server.port !== 'number') {
        return { valid: false, message: '服务器端口必须是数字' };
      }

      return { valid: true };
    } catch (error) {
      return { valid: false, message: error.message };
    }
  }

  /**
   * 合并配置
   * @param {Object} newConfig 新配置
   * @returns {Object} 合并后的配置
   */
  mergeConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    this.saveConfig();
    this.notifyListeners();
    return this.config;
  }
}

// 导出单例
module.exports = new ConfigManager();
