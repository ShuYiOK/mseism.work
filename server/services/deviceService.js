/**
 * 设备服务
 * 处理设备相关的业务逻辑
 */

const db = require('../database');
const cache = require('../cache');

/**
 * 获取所有设备
 * @returns {Promise<Array>} 设备列表
 */
async function getAllDevices() {
  return await db.getAllDevices();
}

/**
 * 根据 ID 获取设备
 * @param {string} id 设备 ID
 * @returns {Promise<Object|null>} 设备信息
 */
async function getDeviceById(id) {
  return await db.getDeviceById(id);
}

/**
 * 同步设备数据
 * @param {Array} remoteDevices 远程设备数据
 * @returns {Promise<Array>} 更新后的设备列表
 */
async function syncDevices(remoteDevices) {
  return await db.syncDevices(remoteDevices);
}

/**
 * 获取设备变化
 * @param {Array} newDevices 新设备数据
 * @returns {Promise<Object>} 设备变化信息
 */
async function getDeviceChanges(newDevices) {
  return await db.getDeviceChanges(newDevices);
}

/**
 * 删除设备
 * @param {string} id 设备 ID
 * @returns {Promise<any>} 删除结果
 */
async function deleteDevice(id) {
  return await db.deleteDevice(id);
}

/**
 * 获取设备统计
 * @returns {Promise<Object>} 设备统计信息
 */
async function getDeviceStats() {
  return await db.getDeviceStats();
}

/**
 * 获取在线设备
 * @param {number|null} limit 限制数量
 * @returns {Promise<Array>} 在线设备列表
 */
async function getOnlineDevices(limit = null) {
  return await db.getOnlineDevices(limit);
}

/**
 * 获取离线设备
 * @param {number|null} limit 限制数量
 * @returns {Promise<Array>} 离线设备列表
 */
async function getOfflineDevices(limit = null) {
  return await db.getOfflineDevices(limit);
}

/**
 * 按状态获取设备
 * @param {string} status 设备状态
 * @param {number|null} limit 限制数量
 * @returns {Promise<Array>} 设备列表
 */
async function getDevicesByStatus(status, limit = null) {
  return await db.getDevicesByStatus(status, limit);
}

/**
 * 获取带分组信息的设备列表
 * @returns {Promise<Array>} 带分组信息的设备列表
 */
async function getAllDevicesWithGroups() {
  return await db.getAllDevicesWithGroups();
}

module.exports = {
  getAllDevices,
  getDeviceById,
  syncDevices,
  getDeviceChanges,
  deleteDevice,
  getDeviceStats,
  getOnlineDevices,
  getOfflineDevices,
  getDevicesByStatus,
  getAllDevicesWithGroups
};
