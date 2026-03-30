-- 修复数据库表结构

-- 检查并添加 sync_hash 字段
SET @exist := (SELECT COUNT(*) FROM information_schema.columns 
               WHERE table_schema = 'mseism' AND table_name = 'devices' AND column_name = 'sync_hash');
SET @sql := IF(@exist = 0, 'ALTER TABLE devices ADD COLUMN sync_hash VARCHAR(32)', 'SELECT "sync_hash字段已存在"');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 检查并添加 created_at 字段（INT类型）
SET @exist := (SELECT COUNT(*) FROM information_schema.columns 
               WHERE table_schema = 'mseism' AND table_name = 'devices' AND column_name = 'created_at');
SET @sql := IF(@exist = 0, 'ALTER TABLE devices ADD COLUMN created_at INT DEFAULT 0', 'SELECT "created_at字段已存在"');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 检查并添加 updated_at 字段（INT类型）
SET @exist := (SELECT COUNT(*) FROM information_schema.columns 
               WHERE table_schema = 'mseism' AND table_name = 'devices' AND column_name = 'updated_at');
SET @sql := IF(@exist = 0, 'ALTER TABLE devices ADD COLUMN updated_at INT DEFAULT 0', 'SELECT "updated_at字段已存在"');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 检查并修改 device_groups 表的 created_at 和 updated_at 字段
SET @exist := (SELECT COUNT(*) FROM information_schema.columns 
               WHERE table_schema = 'mseism' AND table_name = 'device_groups' AND column_name = 'created_at');
SET @sql := IF(@exist = 0, 'ALTER TABLE device_groups ADD COLUMN created_at INT DEFAULT 0', 'SELECT "device_groups.created_at字段已存在"');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @exist := (SELECT COUNT(*) FROM information_schema.columns 
               WHERE table_schema = 'mseism' AND table_name = 'device_groups' AND column_name = 'updated_at');
SET @sql := IF(@exist = 0, 'ALTER TABLE device_groups ADD COLUMN updated_at INT DEFAULT 0', 'SELECT "device_groups.updated_at字段已存在"');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 检查并修改 device_group_mapping 表的 created_at 字段
SET @exist := (SELECT COUNT(*) FROM information_schema.columns 
               WHERE table_schema = 'mseism' AND table_name = 'device_group_mapping' AND column_name = 'created_at');
SET @sql := IF(@exist = 0, 'ALTER TABLE device_group_mapping ADD COLUMN created_at INT DEFAULT 0', 'SELECT "device_group_mapping.created_at字段已存在"');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_devices_status ON devices(status);
CREATE INDEX IF NOT EXISTS idx_devices_online ON devices(online);
CREATE INDEX IF NOT EXISTS idx_devices_online_status ON devices(online, status);
CREATE INDEX IF NOT EXISTS idx_devices_last_heartbeat ON devices(last_heartbeat);
CREATE INDEX IF NOT EXISTS idx_devices_hash ON devices(sync_hash);
CREATE INDEX IF NOT EXISTS idx_mapping_device ON device_group_mapping(device_id);
CREATE INDEX IF NOT EXISTS idx_mapping_group ON device_group_mapping(group_id);
CREATE INDEX IF NOT EXISTS idx_mapping_group_device ON device_group_mapping(group_id, device_id);
CREATE INDEX IF NOT EXISTS idx_groups_sort ON device_groups(sort_order, name);

-- 查看当前设备数量
SELECT COUNT(*) as total_devices FROM devices;
