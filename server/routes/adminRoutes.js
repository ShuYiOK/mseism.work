/**
 * 管理路由
 * 提供插件和配置管理的API端点
 */

const express = require('express');
const router = express.Router();
const pluginManager = require('../utils/pluginManager');
const configManager = require('../utils/configManager');
const { authenticateToken, requireSuperAdmin } = require('../middlewares/authMiddleware');

// 插件管理 API

/**
 * 获取所有插件
 * @route GET /api/admin/plugins
 * @group 管理 - 插件管理
 * @security Bearer
 * @returns {Array} 200 - 插件列表
 */
router.get('/plugins', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const plugins = pluginManager.getPlugins();
    res.json({ success: true, data: plugins });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 加载插件
 * @route POST /api/admin/plugins/load
 * @group 管理 - 插件管理
 * @security Bearer
 * @param {string} pluginPath.query 插件路径
 * @returns {Object} 200 - 加载结果
 */
router.post('/plugins/load', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const { pluginPath } = req.query;
    if (!pluginPath) {
      return res.status(400).json({ success: false, error: '缺少插件路径' });
    }
    const result = await pluginManager.loadPlugin(pluginPath);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 卸载插件
 * @route POST /api/admin/plugins/unload
 * @group 管理 - 插件管理
 * @security Bearer
 * @param {string} pluginName.query 插件名称
 * @returns {Object} 200 - 卸载结果
 */
router.post('/plugins/unload', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const { pluginName } = req.query;
    if (!pluginName) {
      return res.status(400).json({ success: false, error: '缺少插件名称' });
    }
    const result = pluginManager.unloadPlugin(pluginName);
    res.json({ success: result, message: result ? '插件卸载成功' : '插件不存在' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 重新加载插件
 * @route POST /api/admin/plugins/reload
 * @group 管理 - 插件管理
 * @security Bearer
 * @param {string} pluginName.query 插件名称
 * @returns {Object} 200 - 加载结果
 */
router.post('/plugins/reload', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const { pluginName } = req.query;
    if (!pluginName) {
      return res.status(400).json({ success: false, error: '缺少插件名称' });
    }
    const result = await pluginManager.reloadPlugin(pluginName);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 加载插件目录
 * @route POST /api/admin/plugins/load-dir
 * @group 管理 - 插件管理
 * @security Bearer
 * @param {string} pluginsDir.query 插件目录
 * @returns {Array} 200 - 加载结果
 */
router.post('/plugins/load-dir', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const { pluginsDir } = req.query;
    if (!pluginsDir) {
      return res.status(400).json({ success: false, error: '缺少插件目录' });
    }
    const results = await pluginManager.loadPluginsFromDir(pluginsDir);
    res.json({ success: true, data: results });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 配置管理 API

/**
 * 获取配置
 * @route GET /api/admin/config
 * @group 管理 - 配置管理
 * @security Bearer
 * @param {string} key.query 配置键
 * @returns {Object} 200 - 配置值
 */
router.get('/config', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const { key } = req.query;
    const value = configManager.get(key);
    res.json({ success: true, data: value });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 设置配置
 * @route POST /api/admin/config
 * @group 管理 - 配置管理
 * @security Bearer
 * @param {string} key.query 配置键
 * @param {*} value.body 配置值
 * @returns {Object} 200 - 设置结果
 */
router.post('/config', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const { key } = req.query;
    const { value } = req.body;
    if (!key) {
      return res.status(400).json({ success: false, error: '缺少配置键' });
    }
    const result = configManager.set(key, value);
    res.json({ success: result, message: result ? '配置设置成功' : '配置设置失败' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 重置配置
 * @route POST /api/admin/config/reset
 * @group 管理 - 配置管理
 * @security Bearer
 * @returns {Object} 200 - 重置结果
 */
router.post('/config/reset', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const result = configManager.resetConfig();
    res.json({ success: result, message: result ? '配置重置成功' : '配置重置失败' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 验证配置
 * @route POST /api/admin/config/validate
 * @group 管理 - 配置管理
 * @security Bearer
 * @param {Object} config.body 配置对象
 * @returns {Object} 200 - 验证结果
 */
router.post('/config/validate', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const { config } = req.body;
    const result = configManager.validateConfig(config);
    res.json({ success: result.valid, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
