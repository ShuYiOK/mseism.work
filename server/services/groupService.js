/**
 * 分组服务
 * 处理分组相关的业务逻辑
 */

const db = require('../database');

/**
 * 获取所有分组
 * @returns {Promise<Array>} 分组列表
 */
async function getAllGroups() {
  return await db.getAllGroups();
}

/**
 * 根据 ID 获取分组
 * @param {string} id 分组 ID
 * @returns {Promise<Object|null>} 分组信息
 */
async function getGroupById(id) {
  return await db.getGroupById(id);
}

/**
 * 创建分组
 * @param {string} name 分组名称
 * @param {string} description 分组描述
 * @param {string} color 分组颜色
 * @param {number} sort_order 排序顺序
 * @returns {Promise<Object>} 创建的分组信息
 */
async function createGroup(name, description = '', color = '#667eea', sort_order = 0) {
  return await db.createGroup(name, description, color, sort_order);
}

/**
 * 更新分组
 * @param {string} id 分组 ID
 * @param {string} name 分组名称
 * @param {string} description 分组描述
 * @param {string} color 分组颜色
 * @param {number} sort_order 排序顺序
 * @returns {Promise<Object>} 更新后的分组信息
 */
async function updateGroup(id, name, description, color, sort_order) {
  return await db.updateGroup(id, name, description, color, sort_order);
}

/**
 * 删除分组
 * @param {string} id 分组 ID
 * @returns {Promise<any>} 删除结果
 */
async function deleteGroup(id) {
  return await db.deleteGroup(id);
}

/**
 * 将设备添加到分组
 * @param {string} deviceId 设备 ID
 * @param {string} groupId 分组 ID
 * @returns {Promise<boolean>} 是否添加成功
 */
async function addDeviceToGroup(deviceId, groupId) {
  return await db.addDeviceToGroup(deviceId, groupId);
}

/**
 * 从分组移除设备
 * @param {string} deviceId 设备 ID
 * @param {string} groupId 分组 ID
 * @returns {Promise<any>} 移除结果
 */
async function removeDeviceFromGroup(deviceId, groupId) {
  return await db.removeDeviceFromGroup(deviceId, groupId);
}

/**
 * 获取分组的所有设备
 * @param {string} groupId 分组 ID
 * @returns {Promise<Array>} 设备列表
 */
async function getGroupDevices(groupId) {
  return await db.getGroupDevices(groupId);
}

/**
 * 获取设备所属的所有分组
 * @param {string} deviceId 设备 ID
 * @returns {Promise<Array>} 分组列表
 */
async function getDeviceGroups(deviceId) {
  return await db.getDeviceGroups(deviceId);
}

/**
 * 获取所有分组及其设备
 * @returns {Promise<Array>} 带设备信息的分组列表
 */
async function getAllGroupsWithDevices() {
  return await db.getAllGroupsWithDevices();
}

/**
 * 获取设备分组映射
 * @returns {Promise<Object>} 设备分组映射
 */
async function getDeviceGroupMappings() {
  return await db.getDeviceGroupMappings();
}

/**
 * 获取设备分组统计
 * @returns {Promise<Array>} 分组统计信息
 */
async function getGroupDeviceStats() {
  return await db.getGroupDeviceStats();
}

/**
 * 获取可用于添加到指定分组的设备
 * 排除已归属其他自定义分组的设备，保留未分组和已在当前分组中的设备
 * @param {string} groupId 目标分组 ID
 * @returns {Promise<Array>} 可用设备列表，每个设备包含 assignedGroup 信息
 */
async function getAvailableDevicesForGroup(groupId) {
  const db = require('../database');

  const group = await db.getGroupById(groupId);
  if (!group) {
    throw new Error('分组不存在');
  }

  const allDevices = await db.getAllDevices();

  const mappings = await db.query(`
    SELECT m.device_id, m.group_id, g.name as group_name, g.color as group_color
    FROM device_group_mapping m
    INNER JOIN device_groups g ON g.id = m.group_id
  `);

  const deviceGroupMap = {};
  mappings.forEach(m => {
    deviceGroupMap[m.device_id] = {
      id: m.group_id,
      name: m.group_name,
      color: m.group_color
    };
  });

  return allDevices.map(device => ({
    ...device,
    assignedGroup: deviceGroupMap[device.id] || null,
    isAvailable: !deviceGroupMap[device.id] || deviceGroupMap[device.id].id === groupId
  }));
}

module.exports = {
  getAllGroups,
  getGroupById,
  createGroup,
  updateGroup,
  deleteGroup,
  addDeviceToGroup,
  removeDeviceFromGroup,
  getGroupDevices,
  getDeviceGroups,
  getAllGroupsWithDevices,
  getDeviceGroupMappings,
  getGroupDeviceStats,
  getAvailableDevicesForGroup
};
