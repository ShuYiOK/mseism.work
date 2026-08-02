/**
 * 输入验证器单元测试
 */

const {
  authSchemas,
  deviceSchemas,
  groupSchemas,
  configSchemas,
  validateBody,
  validateQuery
} = require('../../utils/validators');

describe('Auth Schemas', () => {
  describe('login', () => {
    test('should accept valid login credentials', () => {
      const { error } = authSchemas.login.validate({
        username: 'testuser',
        password: 'password123'
      });
      expect(error).toBeUndefined();
    });

    test('should reject short username', () => {
      const { error } = authSchemas.login.validate({
        username: 'ab',
        password: 'password123'
      });
      expect(error).toBeDefined();
      expect(error.details[0].message).toContain('至少 3');
    });

    test('should reject long username', () => {
      const { error } = authSchemas.login.validate({
        username: 'a'.repeat(33),
        password: 'password123'
      });
      expect(error).toBeDefined();
      expect(error.details[0].message).toContain('最多 32');
    });

    test('should reject short password', () => {
      const { error } = authSchemas.login.validate({
        username: 'testuser',
        password: '12345'
      });
      expect(error).toBeDefined();
      expect(error.details[0].message).toContain('至少 6');
    });

    test('should reject missing username', () => {
      const { error } = authSchemas.login.validate({
        password: 'password123'
      });
      expect(error).toBeDefined();
    });

    test('should reject missing password', () => {
      const { error } = authSchemas.login.validate({
        username: 'testuser'
      });
      expect(error).toBeDefined();
    });
  });

  describe('refresh', () => {
    test('should accept valid refresh token', () => {
      const { error } = authSchemas.refresh.validate({
        refresh_token: 'some-refresh-token'
      });
      expect(error).toBeUndefined();
    });

    test('should reject missing refresh token', () => {
      const { error } = authSchemas.refresh.validate({});
      expect(error).toBeDefined();
    });
  });
});

describe('Device Schemas', () => {
  describe('create', () => {
    test('should accept valid device', () => {
      const { error } = deviceSchemas.create.validate({
        name: 'Temperature Sensor',
        type: 'sensor',
        location: 'Building A'
      });
      expect(error).toBeUndefined();
    });

    test('should accept valid device types', () => {
      for (const type of ['sensor', 'gateway', 'station']) {
        const { error } = deviceSchemas.create.validate({
          name: 'Test Device',
          type
        });
        expect(error).toBeUndefined();
      }
    });

    test('should reject invalid device type', () => {
      const { error } = deviceSchemas.create.validate({
        name: 'Test Device',
        type: 'invalid'
      });
      expect(error).toBeDefined();
      expect(error.details[0].message).toContain('sensor');
    });

    test('should reject empty device name', () => {
      const { error } = deviceSchemas.create.validate({
        name: '',
        type: 'sensor'
      });
      expect(error).toBeDefined();
    });

    test('should reject missing type', () => {
      const { error } = deviceSchemas.create.validate({
        name: 'Test Device'
      });
      expect(error).toBeDefined();
    });
  });

  describe('update', () => {
    test('should accept partial update', () => {
      const { error } = deviceSchemas.update.validate({
        name: 'Updated Device'
      });
      expect(error).toBeUndefined();
    });

    test('should accept empty object', () => {
      const { error } = deviceSchemas.update.validate({});
      expect(error).toBeUndefined();
    });
  });

  describe('query', () => {
    test('should accept valid query params', () => {
      const { error } = deviceSchemas.query.validate({
        fields: 'id,name,status',
        limit: 50,
        offset: 10,
        sort: '-created_at'
      });
      expect(error).toBeUndefined();
    });

    test('should reject invalid fields format', () => {
      const { error } = deviceSchemas.query.validate({
        fields: 'id; DROP TABLE devices;--'
      });
      expect(error).toBeDefined();
    });

    test('should reject limit exceeding max', () => {
      const { error } = deviceSchemas.query.validate({
        limit: 2000
      });
      expect(error).toBeDefined();
      expect(error.details[0].message).toContain('1000');
    });

    test('should reject negative offset', () => {
      const { error } = deviceSchemas.query.validate({
        offset: -10
      });
      expect(error).toBeDefined();
    });
  });

  describe('batch', () => {
    test('should accept valid batch request', () => {
      const { error } = deviceSchemas.batch.validate({
        requests: [
          { method: 'GET', path: '/devices' },
          { method: 'POST', path: '/devices', data: { name: 'Test' } }
        ]
      });
      expect(error).toBeUndefined();
    });

    test('should reject empty requests', () => {
      const { error } = deviceSchemas.batch.validate({
        requests: []
      });
      expect(error).toBeDefined();
    });

    test('should reject too many requests', () => {
      const { error } = deviceSchemas.batch.validate({
        requests: Array(11).fill({ method: 'GET', path: '/devices' })
      });
      expect(error).toBeDefined();
      expect(error.details[0].message).toContain('10');
    });

    test('should reject invalid method', () => {
      const { error } = deviceSchemas.batch.validate({
        requests: [
          { method: 'INVALID', path: '/devices' }
        ]
      });
      expect(error).toBeDefined();
    });
  });
});

describe('Group Schemas', () => {
  describe('create', () => {
    test('should accept valid group', () => {
      const { error } = groupSchemas.create.validate({
        name: 'Test Group',
        description: 'A test group',
        color: '#FF5733'
      });
      expect(error).toBeUndefined();
    });

    test('should accept valid color format', () => {
      const { error } = groupSchemas.create.validate({
        name: 'Test Group',
        color: '#A1B2C3'
      });
      expect(error).toBeUndefined();
    });

    test('should reject invalid color format', () => {
      const { error } = groupSchemas.create.validate({
        name: 'Test Group',
        color: 'red'
      });
      expect(error).toBeDefined();
      expect(error.details[0].message).toContain('十六进制');
    });

    test('should reject empty name', () => {
      const { error } = groupSchemas.create.validate({
        name: ''
      });
      expect(error).toBeDefined();
    });
  });

  describe('update', () => {
    test('should accept partial update', () => {
      const { error } = groupSchemas.update.validate({
        color: '#00FF00'
      });
      expect(error).toBeUndefined();
    });
  });

  describe('addDevice', () => {
    test('should accept valid device ID (UUID string)', () => {
      const { error } = groupSchemas.addDevice.validate({
        deviceId: '550e8400-e29b-41d4-a716-446655440000'
      });
      expect(error).toBeUndefined();
    });

    test('should accept simple string device ID', () => {
      const { error } = groupSchemas.addDevice.validate({
        deviceId: 'device-001'
      });
      expect(error).toBeUndefined();
    });

    test('should reject empty device ID', () => {
      const { error } = groupSchemas.addDevice.validate({
        deviceId: ''
      });
      expect(error).toBeDefined();
    });

    test('should reject missing device ID', () => {
      const { error } = groupSchemas.addDevice.validate({});
      expect(error).toBeDefined();
    });
  });
});

describe('Config Schemas', () => {
  describe('update', () => {
    test('should accept valid config', () => {
      const { error } = configSchemas.update.validate({
        key: 'MAX_CONNECTIONS',
        value: 100
      });
      expect(error).toBeUndefined();
    });

    test('should reject missing key', () => {
      const { error } = configSchemas.update.validate({
        value: 100
      });
      expect(error).toBeDefined();
    });

    test('should reject missing value', () => {
      const { error } = configSchemas.update.validate({
        key: 'MAX_CONNECTIONS'
      });
      expect(error).toBeDefined();
    });
  });
});

describe('validateBody middleware', () => {
  let mockReq, mockRes, mockNext;

  beforeEach(() => {
    mockReq = { body: {} };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    mockNext = jest.fn();
  });

  test('should call next for valid body', () => {
    mockReq.body = { username: 'testuser', password: 'password123' };
    const middleware = validateBody(authSchemas.login);

    middleware(mockReq, mockRes, mockNext);

    expect(mockNext).toHaveBeenCalled();
    expect(mockRes.status).not.toHaveBeenCalled();
  });

  test('should return 400 for invalid body', () => {
    mockReq.body = { username: 'ab', password: '123' };
    const middleware = validateBody(authSchemas.login);

    middleware(mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          code: 'INPUT_VALIDATION_ERROR'
        })
      })
    );
  });

  test('should strip unknown fields', () => {
    mockReq.body = {
      username: 'testuser',
      password: 'password123',
      unknownField: 'should be removed'
    };
    const middleware = validateBody(authSchemas.login);

    middleware(mockReq, mockRes, mockNext);

    expect(mockReq.body).not.toHaveProperty('unknownField');
  });
});

describe('validateQuery middleware', () => {
  let mockReq, mockRes, mockNext;

  beforeEach(() => {
    mockReq = { query: {} };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    mockNext = jest.fn();
  });

  test('should call next for valid query', () => {
    mockReq.query = { limit: 50, offset: 10 };
    const middleware = validateQuery(deviceSchemas.query);

    middleware(mockReq, mockRes, mockNext);

    expect(mockNext).toHaveBeenCalled();
  });

  test('should return 400 for invalid query', () => {
    mockReq.query = { limit: 5000 };
    const middleware = validateQuery(deviceSchemas.query);

    middleware(mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(400);
  });
});
