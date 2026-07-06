/**
 * 认证中间件单元测试
 */

const jwt = require('jsonwebtoken');
const {
  authenticateToken,
  requireAdmin,
  requirePermission,
  requireOwner
} = require('../../middlewares/authMiddleware');
const { ErrorCodes, createErrorResponse } = require('../../utils/errorCodes');

jest.mock('../../config', () => ({
  jwt: {
    secret: 'test-secret-key',
    expiresIn: '1h',
    refreshExpiresIn: '7d'
  }
}));

describe('authenticateToken', () => {
  let mockReq, mockRes, mockNext;

  beforeEach(() => {
    mockReq = {
      headers: {}
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    mockNext = jest.fn();
  });

  test('should reject request without authorization header', () => {
    authenticateToken(mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          code: 'AUTH_TOKEN_MISSING'
        })
      })
    );
    expect(mockNext).not.toHaveBeenCalled();
  });

  test('should reject request with invalid token format', () => {
    mockReq.headers['authorization'] = 'InvalidFormat';

    authenticateToken(mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          code: 'AUTH_TOKEN_INVALID_FORMAT'
        })
      })
    );
  });

  test('should reject request with invalid Bearer format', () => {
    mockReq.headers['authorization'] = 'Basic sometoken';

    authenticateToken(mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({
          code: 'AUTH_TOKEN_INVALID_FORMAT'
        })
      })
    );
  });

  test('should accept valid token', () => {
    const token = jwt.sign({ userId: '123', role: 'user' }, 'test-secret-key');
    mockReq.headers['authorization'] = `Bearer ${token}`;

    authenticateToken(mockReq, mockRes, mockNext);

    expect(mockReq.user).toBeDefined();
    expect(mockReq.user.userId).toBe('123');
    expect(mockNext).toHaveBeenCalled();
  });

  test('should reject expired token', () => {
    const token = jwt.sign(
      { userId: '123', role: 'user' },
      'test-secret-key',
      { expiresIn: '-1s' }
    );
    mockReq.headers['authorization'] = `Bearer ${token}`;

    authenticateToken(mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({
          code: 'AUTH_TOKEN_EXPIRED'
        })
      })
    );
  });

  test('should reject invalid token', () => {
    mockReq.headers['authorization'] = 'Bearer invalid.token.here';

    authenticateToken(mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({
          code: 'AUTH_TOKEN_INVALID'
        })
      })
    );
  });
});

describe('requireAdmin', () => {
  let mockReq, mockRes, mockNext;

  beforeEach(() => {
    mockReq = {
      user: null
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    mockNext = jest.fn();
  });

  test('should reject request without user', () => {
    requireAdmin(mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(403);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({
          code: 'AUTH_PERMISSION_DENIED'
        })
      })
    );
    expect(mockNext).not.toHaveBeenCalled();
  });

  test('should reject non-admin user', () => {
    mockReq.user = { userId: '123', role: 'user' };

    requireAdmin(mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(403);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({
          code: 'AUTH_PERMISSION_DENIED'
        })
      })
    );
  });

  test('should allow admin user', () => {
    mockReq.user = { userId: '123', role: 'admin' };

    requireAdmin(mockReq, mockRes, mockNext);

    expect(mockNext).toHaveBeenCalled();
    expect(mockRes.status).not.toHaveBeenCalled();
  });
});

describe('requirePermission', () => {
  let mockReq, mockRes, mockNext;

  beforeEach(() => {
    mockReq = {
      user: null
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    mockNext = jest.fn();
  });

  test('should reject request without user', () => {
    const middleware = requirePermission('device:write');

    middleware(mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({
          code: 'AUTH_TOKEN_MISSING'
        })
      })
    );
  });

  test('should reject user without required permission', () => {
    mockReq.user = { userId: '123', role: 'user', permissions: ['device:read'] };
    const middleware = requirePermission('device:write');

    middleware(mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(403);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({
          code: 'AUTH_PERMISSION_DENIED'
        })
      })
    );
  });

  test('should allow user with required permission', () => {
    mockReq.user = { userId: '123', role: 'user', permissions: ['device:read', 'device:write'] };
    const middleware = requirePermission('device:write');

    middleware(mockReq, mockRes, mockNext);

    expect(mockNext).toHaveBeenCalled();
  });
});

describe('requireOwner', () => {
  let mockReq, mockRes, mockNext;

  beforeEach(() => {
    mockReq = {
      user: null,
      params: {},
      body: {}
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    mockNext = jest.fn();
  });

  test('should reject request without user', () => {
    const middleware = requireOwner();

    middleware(mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(401);
  });

  test('should allow admin to access any resource', () => {
    mockReq.user = { userId: '123', role: 'admin' };
    mockReq.params = { userId: '456' };
    const middleware = requireOwner();

    middleware(mockReq, mockRes, mockNext);

    expect(mockNext).toHaveBeenCalled();
  });

  test('should allow owner to access their own resource', () => {
    mockReq.user = { userId: '123', role: 'user' };
    mockReq.params = { userId: '123' };
    const middleware = requireOwner();

    middleware(mockReq, mockRes, mockNext);

    expect(mockNext).toHaveBeenCalled();
  });

  test('should reject non-owner access to resource', () => {
    mockReq.user = { id: '123', role: 'user' };
    mockReq.params = { userId: '456' };
    const middleware = requireOwner();

    middleware(mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(403);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({
          code: 'AUTH_PERMISSION_DENIED'
        })
      })
    );
  });
});
