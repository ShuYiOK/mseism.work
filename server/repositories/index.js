/**
 * 数据访问层抽象 (Repository Pattern)
 * 提供统一的数据访问接口，实现业务逻辑与数据存储的解耦
 */

class Repository {
  constructor(model) {
    this.model = model;
    this.db = require('../database');
    this.cache = require('../cache');
  }

  async findAll(options = {}) {
    const { fields, limit, offset, sort, where } = options;

    let sql = 'SELECT';
    sql += fields ? ` ${fields}` : ' *';
    sql += ` FROM ${this.model.tableName}`;

    const params = [];

    if (where) {
      sql += ' WHERE';
      const conditions = [];
      for (const [key, value] of Object.entries(where)) {
        conditions.push(` ${key} = ?`);
        params.push(value);
      }
      sql += conditions.join(' AND');
    }

    if (sort) {
      sql += ` ORDER BY ${sort}`;
    }

    if (limit) {
      sql += ' LIMIT ?';
      params.push(parseInt(limit));
    }

    if (offset) {
      sql += ' OFFSET ?';
      params.push(parseInt(offset));
    }

    return await this.db.query(sql, params);
  }

  async findById(id) {
    const sql = `SELECT * FROM ${this.model.tableName} WHERE id = ?`;
    const results = await this.db.query(sql, [id]);
    return results[0] || null;
  }

  async findOne(where) {
    const conditions = [];
    const params = [];

    for (const [key, value] of Object.entries(where)) {
      conditions.push(`${key} = ?`);
      params.push(value);
    }

    const sql = `SELECT * FROM ${this.model.tableName} WHERE ${conditions.join(' AND')} LIMIT 1`;
    const results = await this.db.query(sql, params);
    return results[0] || null;
  }

  async create(data) {
    const fields = Object.keys(data);
    const values = Object.values(data);
    const placeholders = fields.map(() => '?').join(', ');

    const sql = `INSERT INTO ${this.model.tableName} (${fields.join(', ')}) VALUES (${placeholders})`;
    const result = await this.db.query(sql, values);

    return {
      id: result.insertId,
      ...data
    };
  }

  async update(id, data) {
    const fields = Object.keys(data);
    const values = Object.values(data);
    const setClause = fields.map(f => `${f} = ?`).join(', ');

    const sql = `UPDATE ${this.model.tableName} SET ${setClause} WHERE id = ?`;
    const result = await this.db.query(sql, [...values, id]);

    return result.affectedRows > 0;
  }

  async delete(id) {
    const sql = `DELETE FROM ${this.model.tableName} WHERE id = ?`;
    const result = await this.db.query(sql, [id]);
    return result.affectedRows > 0;
  }

  async count(where = {}) {
    const conditions = [];
    const params = [];

    for (const [key, value] of Object.entries(where)) {
      conditions.push(`${key} = ?`);
      params.push(value);
    }

    let sql = `SELECT COUNT(*) as count FROM ${this.model.tableName}`;
    if (conditions.length > 0) {
      sql += ` WHERE ${conditions.join(' AND')}`;
    }

    const results = await this.db.query(sql, params);
    return results[0].count;
  }

  async exists(id) {
    const sql = `SELECT 1 FROM ${this.model.tableName} WHERE id = ? LIMIT 1`;
    const results = await this.db.query(sql, [id]);
    return results.length > 0;
  }
}

class DeviceRepository extends Repository {
  constructor() {
    super({ tableName: 'devices' });
  }

  async findByStatus(status) {
    const sql = `SELECT * FROM ${this.model.tableName} WHERE status = ? ORDER BY name`;
    return await this.db.query(sql, [status]);
  }

  async findOnline(limit = null) {
    let sql = `SELECT * FROM ${this.model.tableName} WHERE online = 1 ORDER BY name`;
    if (limit) {
      sql += ` LIMIT ${parseInt(limit)}`;
    }
    return await this.db.query(sql);
  }

  async findOffline(limit = null) {
    let sql = `SELECT * FROM ${this.model.tableName} WHERE online = 0 ORDER BY name`;
    if (limit) {
      sql += ` LIMIT ${parseInt(limit)}`;
    }
    return await this.db.query(sql);
  }

  async findByIpAddress(ipAddress) {
    return await this.findOne({ ip_address: ipAddress });
  }

  async findByMacAddress(macAddress) {
    return await this.findOne({ mac_address: macAddress });
  }

  async updateStatus(id, status, online) {
    const sql = `UPDATE ${this.model.tableName} SET status = ?, online = ?, updated_at = NOW() WHERE id = ?`;
    const result = await this.db.query(sql, [status, online ? 1 : 0, id]);
    return result.affectedRows > 0;
  }

  async updateMetrics(id, metrics) {
    const { cpu_usage, memory_usage, storage_usage, temperature, volt, delay, delay2 } = metrics;
    const sql = `
      UPDATE ${this.model.tableName}
      SET cpu_usage = ?, memory_usage = ?, storage_usage = ?,
          temperature = ?, volt = ?, delay = ?, delay2 = ?, updated_at = NOW()
      WHERE id = ?
    `;
    const result = await this.db.query(sql, [cpu_usage, memory_usage, storage_usage, temperature, volt, delay, delay2, id]);
    return result.affectedRows > 0;
  }

  async getStats() {
    const sql = `
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN online = 1 THEN 1 ELSE 0 END) as online,
        SUM(CASE WHEN online = 0 THEN 1 ELSE 0 END) as offline,
        AVG(cpu_usage) as avg_cpu,
        AVG(memory_usage) as avg_memory,
        AVG(storage_usage) as avg_storage
      FROM ${this.model.tableName}
    `;
    const results = await this.db.query(sql);
    return results[0];
  }

  async batchUpdateStatus(updates) {
    const sql = `
      UPDATE ${this.model.tableName}
      SET status = CASE id
        ${updates.map(u => `WHEN ? THEN ?`).join(' ')}
      END,
      online = CASE id
        ${updates.map(u => `WHEN ? THEN ?`).join(' ')}
      END,
      updated_at = NOW()
      WHERE id IN (${updates.map(() => '?').join(', ')})
    `;

    const params = [];
    updates.forEach(u => {
      params.push(u.id, u.status, u.id, u.online ? 1 : 0);
    });
    updates.forEach(u => params.push(u.id));

    const result = await this.db.query(sql, params);
    return result.affectedRows;
  }
}

class GroupRepository extends Repository {
  constructor() {
    super({ tableName: 'groups' });
  }

  async findWithDeviceCount() {
    const sql = `
      SELECT g.*, COUNT(dg.device_id) as device_count
      FROM ${this.model.tableName} g
      LEFT JOIN device_groups dg ON g.id = dg.group_id
      GROUP BY g.id
      ORDER BY g.name
    `;
    return await this.db.query(sql);
  }

  async addDevice(groupId, deviceId) {
    const sql = `INSERT INTO device_groups (group_id, device_id) VALUES (?, ?)`;
    try {
      await this.db.query(sql, [groupId, deviceId]);
      return true;
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') {
        return false;
      }
      throw error;
    }
  }

  async removeDevice(groupId, deviceId) {
    const sql = `DELETE FROM device_groups WHERE group_id = ? AND device_id = ?`;
    const result = await this.db.query(sql, [groupId, deviceId]);
    return result.affectedRows > 0;
  }

  async getDeviceIds(groupId) {
    const sql = `SELECT device_id FROM device_groups WHERE group_id = ?`;
    const results = await this.db.query(sql, [groupId]);
    return results.map(r => r.device_id);
  }

  async getDevices(groupId) {
    const sql = `
      SELECT d.*
      FROM devices d
      INNER JOIN device_groups dg ON d.id = dg.device_id
      WHERE dg.group_id = ?
      ORDER BY d.name
    `;
    return await this.db.query(sql, [groupId]);
  }
}

class UserRepository extends Repository {
  constructor() {
    super({ tableName: 'users' });
  }

  async findByUsername(username) {
    return await this.findOne({ username });
  }

  async findByEmail(email) {
    return await this.findOne({ email });
  }

  async updatePassword(id, hashedPassword) {
    return await this.update(id, { password: hashedPassword });
  }

  async updateLastLogin(id) {
    const sql = `UPDATE ${this.model.tableName} SET last_login = NOW() WHERE id = ?`;
    const result = await this.db.query(sql, [id]);
    return result.affectedRows > 0;
  }
}

const deviceRepository = new DeviceRepository();
const groupRepository = new GroupRepository();
const userRepository = new UserRepository();

module.exports = {
  Repository,
  DeviceRepository,
  GroupRepository,
  UserRepository,
  deviceRepository,
  groupRepository,
  userRepository
};
