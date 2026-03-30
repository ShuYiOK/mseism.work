/**
 * 配置模块测试
 */

const config = require('../config');

describe('配置模块', () => {
  test('应该有服务器配置', () => {
    expect(config.server).toBeDefined();
    expect(typeof config.server.port).toBe('number');
    expect(config.server.port).toBeGreaterThan(0);
    expect(config.server.port).toBeLessThan(65536);
  });

  test('应该有数据库配置', () => {
    expect(config.database).toBeDefined();
    expect(config.database.host).toBeDefined();
    expect(config.database.port).toBeDefined();
    expect(config.database.user).toBeDefined();
    expect(config.database.database).toBeDefined();
  });

  test('数据库配置应该包含有效端口号', () => {
    expect(typeof config.database.port).toBe('number');
    expect(config.database.port).toBeGreaterThan(0);
    expect(config.database.port).toBeLessThan(65536);
  });

  test('应该有JWT配置', () => {
    expect(config.jwt).toBeDefined();
    expect(typeof config.jwt.secret).toBe('string');
    expect(config.jwt.secret.length).toBeGreaterThan(0);

    expect(config.jwt.accessTokenExpiresIn).toBeDefined();
    expect(config.jwt.refreshTokenExpiresIn).toBeDefined();
  });

  test('应该有安全配置', () => {
    expect(config.security).toBeDefined();
    expect(typeof config.security.bcryptRounds).toBe('number');
    expect(config.security.bcryptRounds).toBeGreaterThan(0);

    expect(config.security.maxLoginAttempts).toBeDefined();
    expect(typeof config.security.maxLoginAttempts).toBe('number');

    expect(config.security.loginLockoutTime).toBeDefined();
    expect(typeof config.security.loginLockoutTime).toBe('number');
  });

  test('应该有设备API配置', () => {
    expect(config.deviceApi).toBeDefined();
    expect(config.deviceApi.url).toBeDefined();
  });

  test('设备API URL应该是有效的HTTP地址', () => {
    const url = config.deviceApi.url;
    expect(url).toMatch(/^https?:\/\//);
  });

  test('应该有WebSocket配置', () => {
    expect(config.websocket).toBeDefined();
    expect(typeof config.websocket.pingInterval).toBe('number');
    expect(typeof config.websocket.pingTimeout).toBe('number');
  });

  test('应该有性能监控配置', () => {
    expect(config.performance).toBeDefined();
    expect(typeof config.performance.enabled).toBe('boolean');
    expect(typeof config.performance.alertThreshold).toBe('number');
  });

  test('应该有日志配置', () => {
    expect(config.logging).toBeDefined();
    expect(typeof config.logging.level).toBe('string');
  });

  test('应该有同步配置', () => {
    expect(config.sync).toBeDefined();
    expect(typeof config.sync.interval).toBe('number');
    expect(typeof config.sync.offlineThreshold).toBe('number');
  });
});
