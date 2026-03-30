/**
 * 认证模块测试
 */

const auth = require('../auth');
const bcrypt = require('bcryptjs');

// Mock 数据库
jest.mock('../config', () => ({
  JWT_SECRET: 'test-secret-key',
  JWT_ACCESS_TOKEN_EXPIRES_IN: '1h',
  JWT_REFRESH_TOKEN_EXPIRES_IN: '7d',
  JWT_ALGORITHM: 'HS256',
  BCRYPT_ROUNDS: 10,
  MAX_LOGIN_ATTEMPTS: 5,
  LOGIN_LOCKOUT_TIME: 30,
  database: {
    host: 'localhost',
    port: 3306,
    user: 'test',
    password: 'test',
    database: 'test_db'
  }
}));

describe('认证模块 - 密码加密', () => {
  describe('bcrypt 密码哈希', () => {
    test('应该成功哈希密码', () => {
      const password = 'testPassword123';
      const hash = bcrypt.hashSync(password, 10);

      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);
      expect(hash.length).toBeGreaterThan(20);
    });

    test('应该正确验证密码', async () => {
      const password = 'testPassword123';
      const hash = bcrypt.hashSync(password, 10);

      const isValid = await bcrypt.compare(password, hash);
      expect(isValid).toBe(true);
    });

    test('应该拒绝错误密码', async () => {
      const password = 'testPassword123';
      const wrongPassword = 'wrongPassword';
      const hash = bcrypt.hashSync(password, 10);

      const isValid = await bcrypt.compare(wrongPassword, hash);
      expect(isValid).toBe(false);
    });

    test('相同密码应该产生不同哈希值', () => {
      const password = 'testPassword123';
      const hash1 = bcrypt.hashSync(password, 10);
      const hash2 = bcrypt.hashSync(password, 10);

      expect(hash1).not.toBe(hash2);
    });
  });
});

describe('认证模块 - JWT Token', () => {
  const jwt = require('jsonwebtoken');
  const CONFIG = {
    JWT_SECRET: 'test-secret-key',
    JWT_ACCESS_TOKEN_EXPIRES_IN: '1h'
  };

  test('应该成功生成访问token', () => {
    const user = {
      id: '123',
      username: 'testuser',
      role: 'user',
      permissions: JSON.stringify(['device:read'])
    };

    const token = jwt.sign(
      {
        userId: user.id,
        username: user.username,
        role: user.role,
        permissions: JSON.parse(user.permissions)
      },
      CONFIG.JWT_SECRET,
      { expiresIn: CONFIG.JWT_ACCESS_TOKEN_EXPIRES_IN }
    );

    expect(token).toBeDefined();
    expect(typeof token).toBe('string');
    expect(token.split('.').length).toBe(3); // JWT 格式: header.payload.signature
  });

  test('应该成功验证有效token', () => {
    const user = {
      id: '123',
      username: 'testuser',
      role: 'user',
      permissions: ['device:read']
    };

    const token = jwt.sign(
      { userId: user.id, username: user.username, role: user.role, permissions: user.permissions },
      CONFIG.JWT_SECRET,
      { expiresIn: '1h' }
    );

    const decoded = jwt.verify(token, CONFIG.JWT_SECRET);

    expect(decoded.userId).toBe(user.id);
    expect(decoded.username).toBe(user.username);
    expect(decoded.role).toBe(user.role);
  });

  test('应该拒绝过期token', () => {
    const user = { id: '123', username: 'testuser' };

    const token = jwt.sign(
      { userId: user.id, username: user.username },
      CONFIG.JWT_SECRET,
      { expiresIn: '0s' } // 立即过期
    );

    // 等待一小段时间确保token过期
    setTimeout(() => {
      expect(() => {
        jwt.verify(token, CONFIG.JWT_SECRET);
      }).toThrow(jwt.TokenExpiredError);
    }, 100);
  });

  test('应该拒绝无效token', () => {
    const invalidToken = 'invalid.token.string';

    expect(() => {
      jwt.verify(invalidToken, CONFIG.JWT_SECRET);
    }).toThrow(jwt.JsonWebTokenError);
  });

  test('应该拒绝错误密钥签名的token', () => {
    const user = { id: '123', username: 'testuser' };

    const token = jwt.sign(
      { userId: user.id, username: user.username },
      'wrong-secret',
      { expiresIn: '1h' }
    );

    expect(() => {
      jwt.verify(token, CONFIG.JWT_SECRET);
    }).toThrow(jwt.JsonWebTokenError);
  });
});

describe('认证模块 - 权限检查', () => {
  const { Role, Permission, RolePermissions, hasPermission, hasRole } = require('../auth');

  test('管理员应该拥有所有权限', () => {
    const adminUser = {
      role: Role.ADMIN,
      permissions: []
    };

    expect(hasPermission(adminUser, Permission.DEVICE_READ)).toBe(true);
    expect(hasPermission(adminUser, Permission.DEVICE_DELETE)).toBe(true);
    expect(hasPermission(adminUser, Permission.SYSTEM_MANAGE)).toBe(true);
  });

  test('普通用户应该只拥有部分权限', () => {
    const normalUser = {
      role: Role.USER,
      permissions: RolePermissions[Role.USER]
    };

    expect(hasPermission(normalUser, Permission.DEVICE_READ)).toBe(true);
    expect(hasPermission(normalUser, Permission.DEVICE_WRITE)).toBe(false);
    expect(hasPermission(normalUser, Permission.DEVICE_DELETE)).toBe(false);
  });

  test('访客应该只有只读权限', () => {
    const viewerUser = {
      role: Role.VIEWER,
      permissions: RolePermissions[Role.VIEWER]
    };

    expect(hasPermission(viewerUser, Permission.DEVICE_READ)).toBe(true);
    expect(hasPermission(viewerUser, Permission.GROUP_WRITE)).toBe(false);
    expect(hasPermission(viewerUser, Permission.SYSTEM_MANAGE)).toBe(false);
  });

  test('应该正确检查用户角色', () => {
    const adminUser = { role: Role.ADMIN };
    const normalUser = { role: Role.USER };

    expect(hasRole(adminUser, Role.ADMIN)).toBe(true);
    expect(hasRole(adminUser, Role.USER)).toBe(false);
    expect(hasRole(normalUser, Role.USER)).toBe(true);
    expect(hasRole(normalUser, Role.ADMIN)).toBe(false);
  });

  test('空用户应该没有任何权限', () => {
    expect(hasPermission(null, Permission.DEVICE_READ)).toBe(false);
    expect(hasRole(null, Role.ADMIN)).toBe(false);
  });

  test('没有permissions字段的用户应该没有任何权限', () => {
    const user = { role: Role.USER };
    expect(hasPermission(user, Permission.DEVICE_READ)).toBe(false);
  });
});

describe('认证模块 - 输入验证', () => {
  const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  test('应该接受有效的用户名', () => {
    expect(usernameRegex.test('user123')).toBe(true);
    expect(usernameRegex.test('test_user')).toBe(true);
    expect(usernameRegex.test('abc')).toBe(true);
  });

  test('应该拒绝无效的用户名', () => {
    expect(usernameRegex.test('ab')).toBe(false); // 太短
    expect(usernameRegex.test('user@123')).toBe(false); // 包含特殊字符
    expect(usernameRegex.test('user-123')).toBe(false); // 包含连字符
    expect(usernameRegex.test('')).toBe(false); // 空字符串
  });

  test('应该接受有效的邮箱', () => {
    expect(emailRegex.test('user@example.com')).toBe(true);
    expect(emailRegex.test('test.user@domain.co.uk')).toBe(true);
    expect(emailRegex.test('admin@localhost.local')).toBe(true);
  });

  test('应该拒绝无效的邮箱', () => {
    expect(emailRegex.test('invalid')).toBe(false);
    expect(emailRegex.test('invalid@')).toBe(false);
    expect(emailRegex.test('@example.com')).toBe(false);
    expect(emailRegex.test('')).toBe(false);
  });

  test('应该验证密码长度', () => {
    const shortPassword = 'short';
    const validPassword = 'longEnough123';

    expect(shortPassword.length).toBeLessThan(8);
    expect(validPassword.length).toBeGreaterThanOrEqual(8);
  });
});

describe('认证模块 - 角色和权限常量', () => {
  const { Role, Permission, RolePermissions } = require('../auth');

  test('角色常量应该正确定义', () => {
    expect(Role.ADMIN).toBe('admin');
    expect(Role.USER).toBe('user');
    expect(Role.VIEWER).toBe('viewer');
  });

  test('权限常量应该正确定义', () => {
    expect(Permission.DEVICE_READ).toBe('device:read');
    expect(Permission.DEVICE_WRITE).toBe('device:write');
    expect(Permission.DEVICE_DELETE).toBe('device:delete');
    expect(Permission.GROUP_READ).toBe('group:read');
    expect(Permission.GROUP_WRITE).toBe('group:write');
    expect(Permission.GROUP_DELETE).toBe('group:delete');
    expect(Permission.SYSTEM_MANAGE).toBe('system:manage');
    expect(Permission.SYSTEM_MONITOR).toBe('system:monitor');
    expect(Permission.USER_MANAGE).toBe('user:manage');
  });

  test('角色权限映射应该正确', () => {
    expect(RolePermissions[Role.ADMIN]).toContain(Permission.DEVICE_READ);
    expect(RolePermissions[Role.ADMIN]).toContain(Permission.DEVICE_WRITE);
    expect(RolePermissions[Role.ADMIN]).toContain(Permission.DEVICE_DELETE);
    expect(RolePermissions[Role.ADMIN]).toContain(Permission.SYSTEM_MANAGE);

    expect(RolePermissions[Role.USER]).toContain(Permission.DEVICE_READ);
    expect(RolePermissions[Role.USER]).not.toContain(Permission.DEVICE_DELETE);
    expect(RolePermissions[Role.USER]).not.toContain(Permission.SYSTEM_MANAGE);

    expect(RolePermissions[Role.VIEWER]).toContain(Permission.DEVICE_READ);
    expect(RolePermissions[Role.VIEWER]).not.toContain(Permission.DEVICE_WRITE);
    expect(RolePermissions[Role.VIEWER]).not.toContain(Permission.DEVICE_DELETE);
  });
});
