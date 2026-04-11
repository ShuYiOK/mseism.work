/**
 * 配置服务
 * 处理配置相关的业务逻辑
 */

const config = require('../config');

/**
 * 获取完整配置
 * @returns {Object} 配置对象
 */
function getConfig() {
  return config.getConfig();
}

/**
 * 获取特定配置项
 * @param {string} path 配置路径
 * @returns {any} 配置值
 */
function getConfigValue(path) {
  return config.get(path);
}

/**
 * 重新加载配置
 * @returns {Object} 重新加载结果
 */
function reloadConfig() {
  return config.reloadConfig();
}

/**
 * 验证配置
 * @param {Object} configObj 配置对象
 * @returns {Object} 验证结果
 */
function validateConfig(configObj) {
  return config.validateConfig(configObj);
}

/**
 * 检查配置是否需要重启才能生效
 * @param {string} configPath 配置路径
 * @returns {boolean} 是否需要重启
 */
function needsRestart(configPath) {
  return config.needsRestart(configPath);
}

/**
 * 注册配置变更监听器
 * @param {Function} listener 监听器函数
 */
function onConfigChange(listener) {
  config.onConfigChange(listener);
}

module.exports = {
  getConfig,
  getConfigValue,
  reloadConfig,
  validateConfig,
  needsRestart,
  onConfigChange
};
