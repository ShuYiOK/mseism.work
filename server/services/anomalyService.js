/**
 * 设备异常监控服务
 * 负责检测和记录设备异常状态
 */

const db = require('../database');

// 异常检测阈值
const ANOMALY_THRESHOLD = 3; // 24小时内上下线次数超过3次
const TIME_WINDOW_HOURS = 24; // 时间窗口：24小时
const DETECTION_INTERVAL_MS = 5 * 60 * 1000; // 检测间隔：5分钟

let detectionInterval = null;

/**
 * 记录设备状态变化
 * @param {string} deviceId - 设备ID
 * @param {string} status - 状态 (online/offline)
 * @param {string} ipAddress - IP地址
 * @param {object} metadata - 其他元数据
 */
async function recordDeviceStatusChange(deviceId, status, ipAddress = null, metadata = null) {
  try {
    const result = await db.logDeviceStatusChange(deviceId, status, ipAddress, metadata);
    console.log(`[AnomalyService] 记录设备状态变化: ${deviceId} -> ${status}`);
    return result;
  } catch (error) {
    console.error(`[AnomalyService] 记录设备状态变化失败: ${error.message}`);
    throw error;
  }
}

/**
 * 记录设备坐标变化
 * @param {string} deviceId - 设备ID
 * @param {number} coodX - X坐标
 * @param {number} coodY - Y坐标
 * @param {number} coodZ - Z坐标
 * @param {string} changeType - 变化类型
 */
async function recordCoordinateChange(deviceId, coodX, coodY, coodZ, changeType = 'update') {
  try {
    const result = await db.logCoordinateChange(deviceId, coodX, coodY, coodZ, changeType);
    console.log(`[AnomalyService] 记录坐标变化: ${deviceId} -> (${coodX}, ${coodY}, ${coodZ})`);
    return result;
  } catch (error) {
    console.error(`[AnomalyService] 记录坐标变化失败: ${error.message}`);
    throw error;
  }
}

/**
 * 检测频繁上下线的异常设备
 */
async function detectAnomalousDevices() {
  try {
    console.log(`[AnomalyService] 开始检测异常设备 (时间窗口: ${TIME_WINDOW_HOURS}小时, 阈值: ${ANOMALY_THRESHOLD}次)`);
    
    // 检测频繁上下线的设备
    const anomalies = await db.detectFrequentOnlineOfflineDevices(TIME_WINDOW_HOURS, ANOMALY_THRESHOLD);
    
    console.log(`[AnomalyService] 检测到 ${anomalies.length} 个异常设备`);
    
    // 保存异常记录
    for (const anomaly of anomalies) {
      try {
        const details = {
          change_sequence: anomaly.change_sequence,
          detection_time: Date.now()
        };
        
        await db.saveAnomaly(
          anomaly.device_id,
          'frequent_online_offline',
          anomaly.status_change_count,
          anomaly.first_occurrence,
          anomaly.last_occurrence,
          details
        );
      } catch (error) {
        console.error(`[AnomalyService] 保存异常记录失败: ${error.message}`);
      }
    }
    
    return anomalies;
  } catch (error) {
    console.error(`[AnomalyService] 检测异常设备失败: ${error.message}`);
    throw error;
  }
}

/**
 * 获取异常设备列表
 */
async function getAnomalousDevices() {
  try {
    const devices = await db.getAnomalousDevices(TIME_WINDOW_HOURS);
    return devices.map(device => ({
      deviceId: device.device_id,
      deviceName: device.device_name,
      ipAddress: device.ip_address,
      online: !!device.online,
      statusChangeCount: device.status_change_count,
      firstOccurrence: device.first_occurrence,
      lastOccurrence: device.last_occurrence,
      anomalyType: device.anomaly_type
    }));
  } catch (error) {
    console.error(`[AnomalyService] 获取异常设备列表失败: ${error.message}`);
    throw error;
  }
}

/**
 * 获取异常设备详细信息
 * @param {string} deviceId - 设备ID
 */
async function getDeviceAnomalyDetails(deviceId) {
  try {
    const details = await db.getAnomalyDetails(deviceId);
    
    if (!details) {
      return null;
    }
    
    return {
      deviceId: details.device_id,
      deviceName: details.device_name,
      ipAddress: details.ip_address,
      online: !!details.online,
      currentCoordinates: {
        x: details.coodX,
        y: details.coodY,
        z: details.coodZ
      },
      anomalyType: details.anomaly_type,
      statusChangeCount: details.status_change_count,
      firstOccurrence: details.first_occurrence,
      lastOccurrence: details.last_occurrence,
      statusHistory: (details.statusHistory || []).map(log => ({
        status: log.status,
        timestamp: log.timestamp,
        ipAddress: log.ip_address,
        formattedTime: new Date(log.timestamp * 1000).toLocaleString('zh-CN')
      })),
      coordinateHistory: (details.coordinateHistory || []).map(log => ({
        coordinates: {
          x: log.coodX,
          y: log.coodY,
          z: log.coodZ
        },
        timestamp: log.timestamp,
        changeType: log.change_type,
        formattedTime: new Date(log.timestamp * 1000).toLocaleString('zh-CN')
      }))
    };
  } catch (error) {
    console.error(`[AnomalyService] 获取异常设备详情失败: ${error.message}`);
    throw error;
  }
}

/**
 * 启动异常检测定时任务
 */
function startAnomalyDetection() {
  if (detectionInterval) {
    console.log('[AnomalyService] 异常检测任务已在运行');
    return;
  }
  
  console.log(`[AnomalyService] 启动异常检测定时任务 (间隔: ${DETECTION_INTERVAL_MS / 1000 / 60}分钟)`);
  
  // 立即执行一次检测
  detectAnomalousDevices().catch(console.error);
  
  // 设置定时任务
  detectionInterval = setInterval(() => {
    detectAnomalousDevices().catch(console.error);
  }, DETECTION_INTERVAL_MS);
}

/**
 * 停止异常检测定时任务
 */
function stopAnomalyDetection() {
  if (detectionInterval) {
    clearInterval(detectionInterval);
    detectionInterval = null;
    console.log('[AnomalyService] 异常检测定时任务已停止');
  }
}

/**
 * 处理设备状态变化
 * 当设备上下线时调用此方法
 * @param {object} device - 设备对象
 */
async function handleDeviceStatusChange(device) {
  try {
    const status = device.online ? 'online' : 'offline';
    await recordDeviceStatusChange(
      device.id,
      status,
      device.ip_address,
      { name: device.name }
    );
  } catch (error) {
    console.error(`[AnomalyService] 处理设备状态变化失败: ${error.message}`);
  }
}

/**
 * 处理设备坐标变化
 * 当设备坐标发生显著变化时调用此方法
 * @param {object} device - 设备对象
 * @param {object} oldCoordinates - 旧坐标
 */
async function handleCoordinateChange(device, oldCoordinates) {
  try {
    // 判断是否为显著变化（坐标变化超过一定阈值）
    const threshold = 0.1; // 变化阈值
    const dx = Math.abs(device.coodX - oldCoordinates.coodX);
    const dy = Math.abs(device.coodY - oldCoordinates.coodY);
    const dz = Math.abs(device.coodZ - oldCoordinates.coodZ);
    
    if (dx > threshold || dy > threshold || dz > threshold) {
      await recordCoordinateChange(
        device.id,
        device.coodX,
        device.coodY,
        device.coodZ,
        'coordinate_change'
      );
    }
  } catch (error) {
    console.error(`[AnomalyService] 处理坐标变化失败: ${error.message}`);
  }
}

module.exports = {
  recordDeviceStatusChange,
  recordCoordinateChange,
  detectAnomalousDevices,
  getAnomalousDevices,
  getDeviceAnomalyDetails,
  startAnomalyDetection,
  stopAnomalyDetection,
  handleDeviceStatusChange,
  handleCoordinateChange,
  ANOMALY_THRESHOLD,
  TIME_WINDOW_HOURS
};
