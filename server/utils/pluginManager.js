/**
 * 插件管理器
 * 提供插件加载、管理和执行功能，提高系统可扩展性
 */

const fs = require('fs');
const path = require('path');

class PluginManager {
  constructor() {
    this.plugins = new Map();
    this.hooks = new Map();
  }

  /**
   * 加载插件
   * @param {string} pluginPath 插件路径
   * @returns {Promise<Object>} 加载结果
   */
  async loadPlugin(pluginPath) {
    try {
      const pluginModule = require(pluginPath);
      const pluginName = path.basename(pluginPath, path.extname(pluginPath));
      
      // 验证插件结构
      if (!pluginModule.name || !pluginModule.version || !pluginModule.init) {
        throw new Error('插件结构无效，缺少必要的属性');
      }

      // 初始化插件
      const plugin = await pluginModule.init();
      
      // 注册插件
      this.plugins.set(pluginName, {
        name: pluginModule.name,
        version: pluginModule.version,
        description: pluginModule.description || '',
        plugin: plugin,
        hooks: pluginModule.hooks || {}
      });

      // 注册钩子
      this.registerHooks(pluginName, pluginModule.hooks);

      console.log(`插件加载成功: ${pluginModule.name} v${pluginModule.version}`);
      return { success: true, message: `插件加载成功: ${pluginModule.name} v${pluginModule.version}` };
    } catch (error) {
      console.error('插件加载失败:', error);
      return { success: false, message: error.message };
    }
  }

  /**
   * 加载插件目录
   * @param {string} pluginsDir 插件目录
   * @returns {Promise<Array>} 加载结果
   */
  async loadPluginsFromDir(pluginsDir) {
    const results = [];
    
    try {
      if (!fs.existsSync(pluginsDir)) {
        fs.mkdirSync(pluginsDir, { recursive: true });
        return results;
      }

      const files = fs.readdirSync(pluginsDir);
      
      for (const file of files) {
        if (file.endsWith('.js')) {
          const pluginPath = path.join(pluginsDir, file);
          const result = await this.loadPlugin(pluginPath);
          results.push(result);
        }
      }
    } catch (error) {
      console.error('加载插件目录失败:', error);
      results.push({ success: false, message: error.message });
    }

    return results;
  }

  /**
   * 注册钩子
   * @param {string} pluginName 插件名称
   * @param {Object} hooks 钩子定义
   */
  registerHooks(pluginName, hooks) {
    if (!hooks) return;

    for (const [hookName, hookFn] of Object.entries(hooks)) {
      if (!this.hooks.has(hookName)) {
        this.hooks.set(hookName, []);
      }
      
      this.hooks.get(hookName).push({
        plugin: pluginName,
        fn: hookFn
      });
    }
  }

  /**
   * 执行钩子
   * @param {string} hookName 钩子名称
   * @param {Array} args 钩子参数
   * @returns {Promise<Array>} 执行结果
   */
  async executeHook(hookName, ...args) {
    const hookHandlers = this.hooks.get(hookName);
    if (!hookHandlers) return [];

    const results = [];
    
    for (const handler of hookHandlers) {
      try {
        const result = await handler.fn(...args);
        results.push({ plugin: handler.plugin, result });
      } catch (error) {
        console.error(`执行钩子 ${hookName} 失败 (${handler.plugin}):`, error);
        results.push({ plugin: handler.plugin, error: error.message });
      }
    }

    return results;
  }

  /**
   * 获取所有插件
   * @returns {Array} 插件列表
   */
  getPlugins() {
    return Array.from(this.plugins.values());
  }

  /**
   * 获取指定插件
   * @param {string} pluginName 插件名称
   * @returns {Object|null} 插件信息
   */
  getPlugin(pluginName) {
    return this.plugins.get(pluginName) || null;
  }

  /**
   * 卸载插件
   * @param {string} pluginName 插件名称
   * @returns {boolean} 是否卸载成功
   */
  unloadPlugin(pluginName) {
    if (!this.plugins.has(pluginName)) {
      return false;
    }

    // 移除插件
    this.plugins.delete(pluginName);

    // 移除该插件的所有钩子
    for (const [hookName, handlers] of this.hooks.entries()) {
      const filteredHandlers = handlers.filter(handler => handler.plugin !== pluginName);
      if (filteredHandlers.length === 0) {
        this.hooks.delete(hookName);
      } else {
        this.hooks.set(hookName, filteredHandlers);
      }
    }

    console.log(`插件卸载成功: ${pluginName}`);
    return true;
  }

  /**
   * 重新加载插件
   * @param {string} pluginName 插件名称
   * @returns {Promise<Object>} 加载结果
   */
  async reloadPlugin(pluginName) {
    const pluginInfo = this.plugins.get(pluginName);
    if (!pluginInfo) {
      return { success: false, message: '插件不存在' };
    }

    // 卸载插件
    this.unloadPlugin(pluginName);

    // 重新加载插件
    const pluginPath = path.join(__dirname, '../plugins', `${pluginName}.js`);
    return await this.loadPlugin(pluginPath);
  }
}

// 导出单例
module.exports = new PluginManager();
