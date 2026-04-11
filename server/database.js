/**
 * 数据库模块 - 仅支持 MySQL
 * 负责设备数据和分组管理的持久化
 */

const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

const config = require('./config');
const cache = require('./cache');

// 数据库连接
let db;
let query;

// 健康检查相关
let healthCheckInterval = null;
let isReconnecting = false;
let lastHealthCheckTime = null;
let connectionErrors = 0;
const HEALTH_CHECK_INTERVAL = 30000; // 30秒检查一次
const MAX_CONNECTION_ERRORS = 3; // 最大连续错误次数
const RECONNECT_DELAY = 5000; // 重连延迟5秒

// 初始化数据库连接
async function initDatabaseConnection() {
  // 强制使用MySQL
  const mysql = require('mysql2/promise');
  
  try {
    // 尝试连接到MySQL服务器（不指定数据库）
    console.log('尝试连接到MySQL服务器...');
    console.log('连接参数:', {
      host: config.database.host,
      port: config.database.port,
      user: config.database.user,
      password: config.database.password ? '********' : '空'
    });
    
    const connection = await mysql.createConnection({
      host: config.database.host,
      port: config.database.port,
      user: config.database.user,
      password: config.database.password,
      multipleStatements: true,
      connectTimeout: 10000
    });
    
    console.log('MySQL服务器连接成功！');
    
    // 尝试创建数据库
    try {
      console.log(`尝试创建数据库 ${config.database.database}...`);
      await connection.execute(`CREATE DATABASE IF NOT EXISTS ${config.database.database}`);
      console.log(`数据库 ${config.database.database} 已创建或已存在`);
    } catch (error) {
      console.error('创建数据库失败:', error.message);
    }
    
    // 关闭临时连接
    await connection.end();
    console.log('临时连接已关闭');
    
    // 创建连接池（指定数据库）
    console.log('创建MySQL连接池...');
    db = mysql.createPool({
      host: config.database.host,
      port: config.database.port,
      user: config.database.user,
      password: config.database.password,
      database: config.database.database,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      connectTimeout: 10000
    });
    
    // 测试连接池
    console.log('测试MySQL连接池...');
    const poolConnection = await db.getConnection();
    console.log('MySQL连接池创建成功！');
    poolConnection.release();
    
    // MySQL 查询方法
    query = async (sql, params = []) => {
      const [rows] = await db.execute(sql, params);
      return rows;
    };
    
    console.log('使用 MySQL 数据库');
    return 'mysql';
  } catch (error) {
    console.error('MySQL连接失败:', error.message);
    console.error('错误代码:', error.code);
    console.error('错误序号:', error.errno);
    console.error('请检查以下内容:');
    console.error('1. MySQL服务是否正在运行');
    console.error('2. 用户名和密码是否正确');
    console.error('3. 网络连接是否正常');
    console.error('4. MySQL是否允许远程连接');
    console.error('MySQL配置信息:');
    console.error('  主机:', config.database.host);
    console.error('  端口:', config.database.port);
    console.error('  用户名:', config.database.user);
    console.error('  密码:', config.database.password ? '********' : '空');
    console.error('  数据库:', config.database.database);
    throw error;
  }
}

// 数据库连接池健康检查
async function checkPoolHealth() {
  if (!db) {
    console.warn('[健康检查] 数据库连接池不存在');
    return false;
  }
  
  try {
    const connection = await db.getConnection();
    await connection.ping();
    connection.release();
    
    lastHealthCheckTime = Date.now();
    connectionErrors = 0; // 重置错误计数
    
    return true;
  } catch (error) {
    connectionErrors++;
    console.error(`[健康检查] 数据库连接池健康检查失败 (错误次数: ${connectionErrors}/${MAX_CONNECTION_ERRORS}):`, error.message);
    
    // 超过最大错误次数，尝试重连
    if (connectionErrors >= MAX_CONNECTION_ERRORS && !isReconnecting) {
      console.warn('[健康检查] 连续错误次数过多，尝试重新连接数据库...');
      await reconnectDatabase();
    }
    
    return false;
  }
}

// 获取连接池状态
function getPoolStatus() {
  if (!db) {
    return {
      connected: false,
      status: 'disconnected',
      message: '数据库连接池未初始化'
    };
  }
  
  try {
    // mysql2 连接池的状态信息
    const poolInfo = {
      connected: true,
      status: 'connected',
      lastHealthCheck: lastHealthCheckTime ? new Date(lastHealthCheckTime).toISOString() : 'never',
      connectionErrors: connectionErrors,
      isReconnecting: isReconnecting
    };
    
    return poolInfo;
  } catch (error) {
    return {
      connected: false,
      status: 'error',
      message: error.message
    };
  }
}

// 自动重连数据库
async function reconnectDatabase() {
  if (isReconnecting) {
    console.log('[重连] 已有重连任务正在进行中，跳过');
    return false;
  }
  
  isReconnecting = true;
  console.log('[重连] 开始尝试重新连接数据库...');
  
  try {
    // 停止健康检查
    stopHealthCheck();
    
    // 关闭旧连接池
    if (db) {
      try {
        await db.end();
        console.log('[重连] 旧连接池已关闭');
      } catch (err) {
        console.warn('[重连] 关闭旧连接池时出错:', err.message);
      }
    }
    
    // 等待一段时间后重连
    await new Promise(resolve => setTimeout(resolve, RECONNECT_DELAY));
    
    // 重新初始化连接
    await initDatabaseConnection();
    
    // 重置状态
    connectionErrors = 0;
    isReconnecting = false;
    
    // 重新启动健康检查
    startHealthCheck();
    
    console.log('[重连] 数据库重连成功！');
    return true;
  } catch (error) {
    isReconnecting = false;
    console.error('[重连] 数据库重连失败:', error.message);
    
    // 继续尝试重连
    setTimeout(() => {
      console.log('[重连] 将在 10 秒后再次尝试重连...');
      reconnectDatabase();
    }, 10000);
    
    return false;
  }
}

// 启动健康检查
function startHealthCheck() {
  if (healthCheckInterval) {
    clearInterval(healthCheckInterval);
  }
  
  console.log(`[健康检查] 启动数据库连接池健康检查，间隔: ${HEALTH_CHECK_INTERVAL / 1000}秒`);
  
  // 立即执行一次检查
  checkPoolHealth();
  
  // 定时检查
  healthCheckInterval = setInterval(async () => {
    await checkPoolHealth();
  }, HEALTH_CHECK_INTERVAL);
}

// 停止健康检查
function stopHealthCheck() {
  if (healthCheckInterval) {
    clearInterval(healthCheckInterval);
    healthCheckInterval = null;
    console.log('[健康检查] 已停止');
  }
}

// 计算设备数据哈希
function calculateDeviceHash(device) {
  // 确保 online 字段使用数字类型进行哈希计算
  const onlineValue = typeof device.online === 'boolean' ? (device.online ? 1 : 0) : device.online;
  
  const dataStr = JSON.stringify({
    status: device.status,
    online: onlineValue,
    cpu_usage: device.cpu_usage,
    memory_usage: device.memory_usage,
    storage_usage: device.storage_usage,
    temperature: device.temperature
  });
  return crypto.createHash('md5').update(dataStr).digest('hex');
}

// 数据库迁移：添加 sync_hash 字段
async function migrateDatabase() {
  try {
    // 检查列是否存在
    const columns = await query('SHOW COLUMNS FROM devices WHERE Field = ?', ['sync_hash']);
    const hasSyncHash = columns.length > 0;
    
    if (!hasSyncHash) {
      console.log('[迁移] 添加 sync_hash 字段到 devices 表...');
      await query('ALTER TABLE devices ADD COLUMN sync_hash VARCHAR(32)');
      
      // 创建索引
      await query('CREATE INDEX IF NOT EXISTS idx_devices_hash ON devices(sync_hash)');
      
      // 为现有设备计算哈希
      const devices = await query('SELECT * FROM devices');
      
      for (const device of devices) {
        const hash = calculateDeviceHash(device);
        await query('UPDATE devices SET sync_hash = ? WHERE id = ?', [hash, device.id]);
      }
      
      console.log(`[迁移] 已为 ${devices.length} 台设备计算哈希值`);
    }
  } catch (error) {
    console.error('[迁移] 数据库迁移失败:', error.message);
  }
}

// 初始化数据库表
async function initDatabase() {
  try {
    // 确保数据库连接已初始化
    await initDatabaseConnection();
    
    // MySQL 表创建
    await query(`
      CREATE TABLE IF NOT EXISTS devices (
        id VARCHAR(36) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        ip_address VARCHAR(255),
        mac_address VARCHAR(255),
        status VARCHAR(20) DEFAULT 'offline',
        online TINYINT(1) DEFAULT 0,
        cpu_usage DOUBLE DEFAULT 0,
        memory_usage DOUBLE DEFAULT 0,
        storage_usage DOUBLE DEFAULT 0,
        temperature DOUBLE DEFAULT 0,
        last_heartbeat INT DEFAULT 0,
        sync_hash VARCHAR(32),
        created_at INT DEFAULT 0,
        updated_at INT DEFAULT 0
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS device_groups (
        id VARCHAR(36) PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        description TEXT,
        color VARCHAR(20) DEFAULT '#667eea',
        sort_order INT DEFAULT 0,
        created_at INT DEFAULT 0,
        updated_at INT DEFAULT 0
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS device_group_mapping (
        id VARCHAR(36) PRIMARY KEY,
        device_id VARCHAR(36) NOT NULL,
        group_id VARCHAR(36) NOT NULL,
        created_at INT DEFAULT 0,
        FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE,
        FOREIGN KEY (group_id) REFERENCES device_groups(id) ON DELETE CASCADE,
        UNIQUE(device_id, group_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // 创建索引
    try {
      await query(`CREATE INDEX idx_devices_status ON devices(status)`);
      await query(`CREATE INDEX idx_devices_online ON devices(online)`);
      await query(`CREATE INDEX idx_devices_online_status ON devices(online, status)`);
      await query(`CREATE INDEX idx_devices_last_heartbeat ON devices(last_heartbeat)`);
      await query(`CREATE INDEX idx_devices_hash ON devices(sync_hash)`);
      await query(`CREATE INDEX idx_mapping_device ON device_group_mapping(device_id)`);
      await query(`CREATE INDEX idx_mapping_group ON device_group_mapping(group_id)`);
      await query(`CREATE INDEX idx_mapping_group_device ON device_group_mapping(group_id, device_id)`);
      await query(`CREATE INDEX idx_groups_sort ON device_groups(sort_order, name)`);
    } catch (error) {
      // 忽略索引创建失败（索引可能已存在）
      console.warn('[警告] 无法创建索引:', error.message);
    }

    // 执行数据库迁移（添加 sync_hash 字段）
    await migrateDatabase();

    // 迁移完成后创建哈希索引
    try {
      await query(`CREATE INDEX idx_devices_hash ON devices(sync_hash)`);
    } catch (error) {
      // 忽略索引创建失败（列可能不存在）
      console.warn('[警告] 无法创建 sync_hash 索引:', error.message);
    }

    console.log('数据库初始化完成');
    
    // 启动连接池健康检查
    startHealthCheck();
  } catch (error) {
    console.error('数据库初始化失败:', error.message);
    throw error;
  }
}

// ============== 设备相关操作 ==============

// 获取所有设备
async function getAllDevices() {
  // 尝试从缓存获取
  const cachedDevices = cache.get(cache.KEYS.ALL_DEVICES);
  if (cachedDevices) {
    return cachedDevices;
  }
  
  // MySQL 查询
  const devices = await query('SELECT * FROM devices ORDER BY id');
  
  // 移除 sync_hash 字段，不返回给前端（内部优化字段）
  // 将 online 字段从数字转换为布尔值
  const processedDevices = devices.map(d => {
    const { sync_hash, online, ...device } = d;
    return {
      ...device,
      online: online === 1
    };
  });
  
  // 存入缓存
  cache.set(cache.KEYS.ALL_DEVICES, processedDevices, cache.CONFIG.DEVICES_TTL);
  
  return processedDevices;
}

// 根据 ID 获取设备
async function getDeviceById(id) {
  // 尝试从缓存获取
  const cacheKey = cache.KEYS.DEVICE_BY_ID(id);
  const cachedDevice = cache.get(cacheKey);
  if (cachedDevice) {
    return cachedDevice;
  }
  
  // MySQL 查询
  const devices = await query('SELECT * FROM devices WHERE id = ?', [id]);
  const device = devices[0];
  
  if (device) {
    const { sync_hash, online, ...deviceData } = device;
    const processedDevice = {
      ...deviceData,
      online: online === 1
    };
    
    // 存入缓存
    cache.set(cacheKey, processedDevice, cache.CONFIG.DEVICES_TTL);
    
    return processedDevice;
  }
  return null;
}

// 批量同步设备数据（高性能批量插入/更新 - 使用事务和批量操作）
const BATCH_SIZE = 500; // 每批处理500条数据

async function syncDevices(remoteDevices) {
  if (!remoteDevices || remoteDevices.length === 0) {
    return await getAllDevices();
  }

  const now = Math.floor(Date.now() / 1000);
  const startTime = Date.now();
  
  console.log(`[syncDevices] 开始同步 ${remoteDevices.length} 台设备...`);

  // 标准化所有设备数据
  const normalizedDevices = remoteDevices.map(device => {
    const normalized = {
      id: device.id || device.device_id || device.deviceId,
      name: device.name || device.device_name || `设备-${device.id || device.device_id || device.deviceId}`,
      ip_address: device.ip_address || device.ipAddress || device.ip || '',
      mac_address: device.mac_address || device.macAddress || device.mac || '',
      status: device.status || (device.online ? 'online' : 'offline'),
      online: device.online ? 1 : 0,
      cpu_usage: device.cpu_usage || device.cpuUsage || device.cpu || 0,
      memory_usage: device.memory_usage || device.memoryUsage || device.memory || 0,
      storage_usage: device.storage_usage || device.storageUsage || device.storage || 0,
      temperature: device.temperature || device.temp || 0,
      last_heartbeat: now,
      sync_hash: calculateDeviceHash({
        status: device.status || (device.online ? 'online' : 'offline'),
        online: device.online ? 1 : 0,
        cpu_usage: device.cpu_usage || device.cpuUsage || device.cpu || 0,
        memory_usage: device.memory_usage || device.memoryUsage || device.memory || 0,
        storage_usage: device.storage_usage || device.storageUsage || device.storage || 0,
        temperature: device.temperature || device.temp || 0
      }),
      updated_at: now
    };
    return normalized;
  });

  // 分批处理
  const batches = [];
  for (let i = 0; i < normalizedDevices.length; i += BATCH_SIZE) {
    batches.push(normalizedDevices.slice(i, i + BATCH_SIZE));
  }

  console.log(`[syncDevices] 分为 ${batches.length} 批处理，每批最多 ${BATCH_SIZE} 条`);

  // 获取连接并开始事务
  const connection = await db.getConnection();
  
  try {
    await connection.beginTransaction();
    
    let processedCount = 0;
    
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      
      // 构建批量插入SQL
      const placeholders = batch.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(',');
      const values = batch.flatMap(d => [
        d.id,
        d.name,
        d.ip_address,
        d.mac_address,
        d.status,
        d.online,
        d.cpu_usage,
        d.memory_usage,
        d.storage_usage,
        d.temperature,
        d.last_heartbeat,
        d.sync_hash,
        d.updated_at
      ]);
      
      const sql = `
        INSERT INTO devices (id, name, ip_address, mac_address, status, online, cpu_usage, memory_usage, storage_usage, temperature, last_heartbeat, sync_hash, updated_at)
        VALUES ${placeholders}
        ON DUPLICATE KEY UPDATE
          name = VALUES(name),
          ip_address = VALUES(ip_address),
          mac_address = VALUES(mac_address),
          status = VALUES(status),
          online = VALUES(online),
          cpu_usage = VALUES(cpu_usage),
          memory_usage = VALUES(memory_usage),
          storage_usage = VALUES(storage_usage),
          temperature = VALUES(temperature),
          last_heartbeat = VALUES(last_heartbeat),
          sync_hash = VALUES(sync_hash),
          updated_at = VALUES(updated_at)
      `;
      
      await connection.execute(sql, values);
      processedCount += batch.length;
      
      // 每处理完一批输出进度
      if (batches.length > 1) {
        console.log(`[syncDevices] 批次 ${batchIndex + 1}/${batches.length} 完成，已处理 ${processedCount}/${normalizedDevices.length} 台设备`);
      }
    }
    
    await connection.commit();
    
    const duration = Date.now() - startTime;
    console.log(`[syncDevices] 同步完成！共处理 ${normalizedDevices.length} 台设备，耗时 ${duration}ms`);
    
  } catch (error) {
    await connection.rollback();
    console.error('[syncDevices] 同步失败，已回滚:', error.message);
    throw error;
  } finally {
    connection.release();
  }

  // 清除设备相关缓存
  cache.clearDeviceCache();
  
  // 获取更新后的所有设备
  return await getAllDevices();
}

// 获取设备变化（用于增量推送 - 使用哈希优化）
async function getDeviceChanges(newDevices) {
  // 直接从数据库获取设备信息（包含 sync_hash）
  const oldDevices = await query('SELECT id, sync_hash FROM devices');
  
  const oldDevicesMap = new Map(oldDevices.map(d => [d.id, d]));
  const newMap = new Map(newDevices.map(d => [d.id, d]));
  
  const changes = {
    added: [],
    updated: [],
    removed: []
  };

  // 查找新增和更新的设备
  newDevices.forEach(newDevice => {
    const oldDevice = oldDevicesMap.get(newDevice.id);
    if (!oldDevice) {
      changes.added.push(newDevice);
    } else {
      // 使用哈希对比，性能更高
      // 确保 newDevice.online 是数字类型，与数据库存储一致
      const deviceForHash = {
        ...newDevice,
        online: newDevice.online ? 1 : 0
      };
      const newHash = calculateDeviceHash(deviceForHash);
      const hasChanges = oldDevice.sync_hash !== newHash;
      
      if (hasChanges) {
        changes.updated.push(newDevice);
      }
    }
  });

  // 查找删除的设备
  oldDevicesMap.forEach((oldDevice, deviceId) => {
    if (!newMap.has(deviceId)) {
      changes.removed.push(deviceId);
    }
  });

  return changes;
}

// 删除设备
async function deleteDevice(id) {
  const result = await query('DELETE FROM devices WHERE id = ?', [id]);
  // 清除设备相关缓存
  cache.clearDeviceCache();
  return result;
}

// 获取设备统计
async function getDeviceStats() {
  // 尝试从缓存获取
  const cachedStats = cache.get(cache.KEYS.DEVICE_STATS);
  if (cachedStats) {
    return cachedStats;
  }
  
  const result = await query(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN online = 1 THEN 1 ELSE 0 END) as online_count,
      SUM(CASE WHEN online = 0 THEN 1 ELSE 0 END) as offline_count
    FROM devices
  `);
  const stats = result[0];
  
  // 存入缓存
  cache.set(cache.KEYS.DEVICE_STATS, stats, cache.CONFIG.STATS_TTL);
  
  return stats;
}

// ============== 分组相关操作 ==============

// 获取所有分组（优化版 - 使用JOIN避免N+1查询）
async function getAllGroups() {
  // 尝试从缓存获取
  const cachedGroups = cache.get(cache.KEYS.ALL_GROUPS);
  if (cachedGroups) {
    return cachedGroups;
  }
  
  const groups = await query(`
    SELECT 
      g.*,
      COUNT(m.device_id) as device_count
    FROM device_groups g
    LEFT JOIN device_group_mapping m ON g.id = m.group_id
    GROUP BY g.id
    ORDER BY g.sort_order, g.name
  `);
  
  // 存入缓存
  cache.set(cache.KEYS.ALL_GROUPS, groups, cache.CONFIG.GROUPS_TTL);
  
  return groups;
}

// 根据 ID 获取分组（包含设备数量 - 优化版）
async function getGroupById(id) {
  // 尝试从缓存获取
  const cacheKey = cache.KEYS.GROUP_BY_ID(id);
  const cachedGroup = cache.get(cacheKey);
  if (cachedGroup) {
    return cachedGroup;
  }
  
  const groups = await query(`
    SELECT 
      g.*,
      COUNT(m.device_id) as device_count
    FROM device_groups g
    LEFT JOIN device_group_mapping m ON g.id = m.group_id
    WHERE g.id = ?
    GROUP BY g.id
  `, [id]);
  const group = groups[0];
  
  if (group) {
    // 存入缓存
    cache.set(cacheKey, group, cache.CONFIG.GROUPS_TTL);
  }
  
  return group;
}

// 创建分组
async function createGroup(name, description = '', color = '#667eea', sort_order = 0) {
  const id = uuidv4();
  try {
    console.log('创建分组:', { id, name, description, color, sort_order });
    await query(`
      INSERT INTO device_groups (id, name, description, color, sort_order)
      VALUES (?, ?, ?, ?, ?)
    `, [id, name, description, color, sort_order]);
    
    // 清除分组相关缓存
    cache.clearGroupCache();
    
    const group = await getGroupById(id);
    console.log('创建分组成功:', group);
    return group;
  } catch (error) {
    console.error('创建分组失败:', error.message);
    console.error('错误详情:', error);
    throw error;
  }
}

// 更新分组
async function updateGroup(id, name, description, color, sort_order = 0) {
  try {
    console.log('更新分组:', { id, name, description, color, sort_order });
    await query(`
      UPDATE device_groups SET
        name = ?,
        description = ?,
        color = ?,
        sort_order = ?,
        updated_at = UNIX_TIMESTAMP()
      WHERE id = ?
    `, [name, description, color, sort_order, id]);
    
    // 清除分组相关缓存
    cache.clearGroupCache();
    
    const group = await getGroupById(id);
    console.log('更新分组成功:', group);
    return group;
  } catch (error) {
    console.error('更新分组失败:', error.message);
    console.error('错误详情:', error);
    throw error;
  }
}

// 删除分组
async function deleteGroup(id) {
  const result = await query('DELETE FROM device_groups WHERE id = ?', [id]);
  // 清除分组相关缓存
  cache.clearGroupCache();
  return result;
}

// 将设备添加到分组
async function addDeviceToGroup(deviceId, groupId) {
  const id = uuidv4();
  try {
    // 检查设备是否存在
    const deviceExists = await getDeviceById(deviceId);
    if (!deviceExists) {
      // 如果设备不存在，创建一个临时设备
      await syncDevices([{
        id: deviceId,
        name: `测试设备-${deviceId}`,
        ip_address: '192.168.1.1',
        mac_address: '00:11:22:33:44:55',
        status: 'offline',
        online: false,
        cpu_usage: 0,
        memory_usage: 0,
        storage_usage: 0,
        temperature: 0
      }]);
    }
    
    // 检查分组是否存在
    const groupExists = await getGroupById(groupId);
    if (!groupExists) {
      throw new Error('分组不存在');
    }
    
    await query(`
      INSERT INTO device_group_mapping (id, device_id, group_id)
      VALUES (?, ?, ?)
    `, [id, deviceId, groupId]);
    console.log(`[DB] 添加设备到分组：${deviceId} -> ${groupId}, 结果：成功`);
    
    // 清除相关缓存
    cache.clearGroupCache();
    cache.del(cache.KEYS.DEVICES_WITH_GROUPS);
    cache.del(cache.KEYS.GROUPS_WITH_DEVICES);
    cache.del(cache.KEYS.DEVICE_GROUP_MAPPINGS);
    cache.del(cache.KEYS.GROUP_STATS);
    
    return true;
  } catch (error) {
    console.error(`[DB] 添加设备到分组失败：${error.message}`);
    if (error.code === 'ER_DUP_ENTRY') {
      return false; // 已存在
    }
    throw error;
  }
}

// 从分组移除设备
async function removeDeviceFromGroup(deviceId, groupId) {
  const result = await query(`
    DELETE FROM device_group_mapping 
    WHERE device_id = ? AND group_id = ?
  `, [deviceId, groupId]);
  
  // 清除相关缓存
  cache.clearGroupCache();
  cache.del(cache.KEYS.DEVICES_WITH_GROUPS);
  cache.del(cache.KEYS.GROUPS_WITH_DEVICES);
  cache.del(cache.KEYS.DEVICE_GROUP_MAPPINGS);
  cache.del(cache.KEYS.GROUP_STATS);
  
  return result;
}

// 获取分组的所有设备
async function getGroupDevices(groupId) {
  const devices = await query(`
    SELECT d.* FROM devices d
    INNER JOIN device_group_mapping m ON d.id = m.device_id
    WHERE m.group_id = ?
    ORDER BY d.id
  `, [groupId]);
  
  // 移除 sync_hash 字段
  return devices.map(d => {
    const { sync_hash, ...device } = d;
    return device;
  });
}

// 获取设备所属的所有分组
async function getDeviceGroups(deviceId) {
  return await query(`
    SELECT g.* FROM device_groups g
    INNER JOIN device_group_mapping m ON g.id = m.group_id
    WHERE m.device_id = ?
  `, [deviceId]);
}

// ============== 批量查询优化 ==============

// 批量获取设备（指定ID列表）
async function getDevicesByIds(deviceIds) {
  if (!deviceIds || deviceIds.length === 0) {
    return [];
  }
  
  const placeholders = deviceIds.map(() => '?').join(',');
  const devices = await query(`
    SELECT * FROM devices 
    WHERE id IN (${placeholders})
    ORDER BY id
  `, deviceIds);
  
  // 移除 sync_hash 字段，将 online 字段从数字转换为布尔值
  return devices.map(d => {
    const { sync_hash, online, ...device } = d;
    return {
      ...device,
      online: online === 1
    };
  });
}

// 批量获取分组（指定ID列表）
async function getGroupsByIds(groupIds) {
  if (!groupIds || groupIds.length === 0) {
    return [];
  }
  
  const placeholders = groupIds.map(() => '?').join(',');
  
  return await query(`
    SELECT 
      g.*,
      COUNT(m.device_id) as device_count
    FROM device_groups g
    LEFT JOIN device_group_mapping m ON g.id = m.group_id
    WHERE g.id IN (${placeholders})
    GROUP BY g.id
    ORDER BY g.sort_order, g.name
  `, groupIds);
}

// 获取所有分组及其设备（一次查询完成）
async function getAllGroupsWithDevices() {
  // 尝试从缓存获取
  const cachedGroups = cache.get(cache.KEYS.GROUPS_WITH_DEVICES);
  if (cachedGroups) {
    return cachedGroups;
  }
  
  const rows = await query(`
    SELECT 
      g.id as group_id,
      g.name as group_name,
      g.description as group_description,
      g.color as group_color,
      g.sort_order,
      d.id as device_id,
      d.name as device_name,
      d.ip_address,
      d.mac_address,
      d.status as device_status,
      d.online,
      d.cpu_usage,
      d.memory_usage,
      d.storage_usage,
      d.temperature
    FROM device_groups g
    LEFT JOIN device_group_mapping m ON g.id = m.group_id
    LEFT JOIN devices d ON m.device_id = d.id
    ORDER BY g.sort_order, g.name, d.id
  `);
  
  // 转换为分组对象格式
  const groups = {};
  
  rows.forEach(row => {
    if (!groups[row.group_id]) {
      groups[row.group_id] = {
        id: row.group_id,
        name: row.group_name,
        description: row.group_description,
        color: row.group_color,
        sort_order: row.sort_order,
        device_count: 0,
        devices: []
      };
    }
    
    if (row.device_id) {
        groups[row.group_id].device_count++;
        groups[row.group_id].devices.push({
          id: row.device_id,
          name: row.device_name,
          ip_address: row.ip_address,
          mac_address: row.mac_address,
          status: row.device_status,
          online: row.online === 1,
          cpu_usage: row.cpu_usage,
        memory_usage: row.memory_usage,
        storage_usage: row.storage_usage,
        temperature: row.temperature
      });
    }
  });
  
  const result = Object.values(groups);
  
  // 存入缓存
  cache.set(cache.KEYS.GROUPS_WITH_DEVICES, result, cache.CONFIG.GROUPS_TTL);
  
  return result;
}

// 获取在线设备（优化查询）
async function getOnlineDevices(limit = null) {
  // 尝试从缓存获取
  const cacheKey = limit ? `${cache.KEYS.ONLINE_DEVICES}:${limit}` : cache.KEYS.ONLINE_DEVICES;
  const cachedDevices = cache.get(cacheKey);
  if (cachedDevices) {
    return cachedDevices;
  }
  
  let sql = `
    SELECT * FROM devices 
    WHERE online = 1
    ORDER BY id
  `;
  
  if (limit) {
    sql += ` LIMIT ${limit}`;
  }
  
  const devices = await query(sql);
  
  // 移除 sync_hash 字段，将 online 字段从数字转换为布尔值
  const processedDevices = devices.map(d => {
    const { sync_hash, online, ...device } = d;
    return {
      ...device,
      online: online === 1
    };
  });
  
  // 存入缓存
  cache.set(cacheKey, processedDevices, cache.CONFIG.DEVICES_TTL);
  
  return processedDevices;
}

// 获取离线设备（优化查询）
async function getOfflineDevices(limit = null) {
  // 尝试从缓存获取
  const cacheKey = limit ? `${cache.KEYS.OFFLINE_DEVICES}:${limit}` : cache.KEYS.OFFLINE_DEVICES;
  const cachedDevices = cache.get(cacheKey);
  if (cachedDevices) {
    return cachedDevices;
  }
  
  let sql = `
    SELECT * FROM devices 
    WHERE online = 0
    ORDER BY id
  `;
  
  if (limit) {
    sql += ` LIMIT ${limit}`;
  }
  
  const devices = await query(sql);
  
  // 移除 sync_hash 字段，将 online 字段从数字转换为布尔值
  const processedDevices = devices.map(d => {
    const { sync_hash, online, ...device } = d;
    return {
      ...device,
      online: online === 1
    };
  });
  
  // 存入缓存
  cache.set(cacheKey, processedDevices, cache.CONFIG.DEVICES_TTL);
  
  return processedDevices;
}

// 获取设备分组映射（批量查询）
async function getDeviceGroupMappings() {
  // 尝试从缓存获取
  const cachedMappings = cache.get(cache.KEYS.DEVICE_GROUP_MAPPINGS);
  if (cachedMappings) {
    return cachedMappings;
  }
  
  const mappings = await query(`
    SELECT 
      m.device_id,
      m.group_id,
      g.name as group_name,
      g.color as group_color
    FROM device_group_mapping m
    INNER JOIN device_groups g ON m.group_id = g.id
    ORDER BY m.device_id, m.group_id
  `);
  
  // 转换为设备ID -> 分组列表的映射
  const result = {};
  
  mappings.forEach(m => {
    if (!result[m.device_id]) {
      result[m.device_id] = [];
    }
    
    result[m.device_id].push({
      id: m.group_id,
      name: m.group_name,
      color: m.group_color
    });
  });
  
  // 存入缓存
  cache.set(cache.KEYS.DEVICE_GROUP_MAPPINGS, result, cache.CONFIG.MAPPINGS_TTL);
  
  return result;
}

// 获取带分组信息的设备列表（一次性查询）
async function getAllDevicesWithGroups() {
  // 尝试从缓存获取
  const cachedDevices = cache.get(cache.KEYS.DEVICES_WITH_GROUPS);
  if (cachedDevices) {
    return cachedDevices;
  }
  
  const rows = await query(`
    SELECT 
      d.id,
      d.name,
      d.ip_address,
      d.mac_address,
      d.status,
      d.online,
      d.cpu_usage,
      d.memory_usage,
      d.storage_usage,
      d.temperature,
      d.last_heartbeat,
      d.created_at,
      d.updated_at,
      m.group_id,
      g.name as group_name,
      g.color as group_color
    FROM devices d
    LEFT JOIN device_group_mapping m ON d.id = m.device_id
    LEFT JOIN device_groups g ON m.group_id = g.id
    ORDER BY d.id
  `);
  
  // 转换为设备对象格式
  const devices = {};
  
  rows.forEach(row => {
    if (!devices[row.id]) {
      devices[row.id] = {
        id: row.id,
        name: row.name,
        ip_address: row.ip_address,
        mac_address: row.mac_address,
        status: row.status,
        online: row.online,
        cpu_usage: row.cpu_usage,
        memory_usage: row.memory_usage,
        storage_usage: row.storage_usage,
        temperature: row.temperature,
        last_heartbeat: row.last_heartbeat,
        created_at: row.created_at,
        updated_at: row.updated_at,
        groups: []
      };
    }
    
    if (row.group_id) {
      devices[row.id].groups.push({
        id: row.group_id,
        name: row.group_name,
        color: row.group_color
      });
    }
  });
  
  const result = Object.values(devices);
  
  // 存入缓存
  cache.set(cache.KEYS.DEVICES_WITH_GROUPS, result, cache.CONFIG.DEVICES_TTL);
  
  return result;
}

// 按状态查询设备（优化查询）
async function getDevicesByStatus(status, limit = null) {
  let sql = `
    SELECT * FROM devices 
    WHERE status = ?
    ORDER BY id
  `;
  
  if (limit) {
    sql += ` LIMIT ${limit}`;
  }
  
  const devices = await query(sql, [status]);
  
  // 移除 sync_hash 字段
  return devices.map(d => {
    const { sync_hash, ...device } = d;
    return device;
  });
}

// 获取设备分组统计（聚合查询）
async function getGroupDeviceStats() {
  // 尝试从缓存获取
  const cachedStats = cache.get(cache.KEYS.GROUP_STATS);
  if (cachedStats) {
    return cachedStats;
  }
  
  const stats = await query(`
    SELECT 
      g.id,
      g.name,
      g.color,
      COUNT(m.device_id) as total_devices,
      SUM(CASE WHEN d.online = 1 THEN 1 ELSE 0 END) as online_devices,
      SUM(CASE WHEN d.online = 0 THEN 1 ELSE 0 END) as offline_devices
    FROM device_groups g
    LEFT JOIN device_group_mapping m ON g.id = m.group_id
    LEFT JOIN devices d ON m.device_id = d.id
    GROUP BY g.id, g.name, g.color
    ORDER BY g.sort_order, g.name
  `);
  
  // 存入缓存
  cache.set(cache.KEYS.GROUP_STATS, stats, cache.CONFIG.STATS_TTL);
  
  return stats;
}

module.exports = {
  initDatabase,
  // 设备操作
  getAllDevices,
  getDeviceById,
  syncDevices,
  getDeviceChanges,
  deleteDevice,
  getDeviceStats,
  // 分组操作
  getAllGroups,
  getGroupById,
  createGroup,
  updateGroup,
  deleteGroup,
  addDeviceToGroup,
  removeDeviceFromGroup,
  getGroupDevices,
  getDeviceGroups,
  // 批量查询优化
  getDevicesByIds,
  getGroupsByIds,
  getAllGroupsWithDevices,
  getOnlineDevices,
  getOfflineDevices,
  getDeviceGroupMappings,
  getAllDevicesWithGroups,
  getDevicesByStatus,
  getGroupDeviceStats,
  // 健康检查
  checkPoolHealth,
  getPoolStatus,
  startHealthCheck,
  stopHealthCheck,
  reconnectDatabase
};
