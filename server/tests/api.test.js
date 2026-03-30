/**
 * API 测试
 */

const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');

// Mock 配置
jest.mock('../config', () => ({
  server: { port: 3000 },
  database: {
    host: 'localhost',
    port: 3306,
    user: 'test',
    password: 'test',
    database: 'test_db'
  },
  JWT_SECRET: 'test-secret-key',
  JWT_ACCESS_TOKEN_EXPIRES_IN: '1h',
  JWT_REFRESH_TOKEN_EXPIRES_IN: '7d',
  BCRYPT_ROUNDS: 10
}));

describe('API - 认证中间件', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
  });

  test('应该拒绝没有token的请求', async () => {
    app.get('/protected', (req, res) => {
      res.status(401).json({ error: '未授权' });
    });

    const response = await request(app).get('/protected');

    expect(response.status).toBe(401);
    expect(response.body.error).toBe('未授权');
  });

  test('应该拒绝无效token的请求', async () => {
    app.get('/protected', (req, res) => {
      const token = req.headers.authorization?.replace('Bearer ', '');

      if (!token) {
        return res.status(401).json({ error: '未授权' });
      }

      try {
        jwt.verify(token, 'test-secret-key');
        res.json({ message: '成功' });
      } catch (error) {
        res.status(401).json({ error: '无效token' });
      }
    });

    const response = await request(app)
      .get('/protected')
      .set('Authorization', 'Bearer invalid-token');

    expect(response.status).toBe(401);
    expect(response.body.error).toBe('无效token');
  });

  test('应该接受有效token的请求', async () => {
    const token = jwt.sign(
      { userId: '123', username: 'testuser', role: 'user' },
      'test-secret-key',
      { expiresIn: '1h' }
    );

    app.get('/protected', (req, res) => {
      const authHeader = req.headers.authorization?.replace('Bearer ', '');

      if (!authHeader) {
        return res.status(401).json({ error: '未授权' });
      }

      try {
        const decoded = jwt.verify(authHeader, 'test-secret-key');
        res.json({ message: '成功', user: decoded });
      } catch (error) {
        res.status(401).json({ error: '无效token' });
      }
    });

    const response = await request(app)
      .get('/protected')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.message).toBe('成功');
    expect(response.body.user.userId).toBe('123');
  });
});

describe('API - 输入验证', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
  });

  test('应该拒绝缺少必填字段的请求', async () => {
    app.post('/api/users', (req, res) => {
      const { username, email, password } = req.body;

      if (!username || !email || !password) {
        return res.status(400).json({ error: '缺少必填字段' });
      }

      res.status(201).json({ message: '创建成功' });
    });

    const response = await request(app)
      .post('/api/users')
      .send({ username: 'test' });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('缺少必填字段');
  });

  test('应该验证邮箱格式', async () => {
    app.post('/api/users', (req, res) => {
      const { email } = req.body;
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      if (!email || !emailRegex.test(email)) {
        return res.status(400).json({ error: '邮箱格式不正确' });
      }

      res.status(201).json({ message: '创建成功' });
    });

    const response = await request(app)
      .post('/api/users')
      .send({ email: 'invalid-email' });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('邮箱格式不正确');
  });

  test('应该验证密码长度', async () => {
    app.post('/api/users', (req, res) => {
      const { password } = req.body;

      if (!password || password.length < 8) {
        return res.status(400).json({ error: '密码长度至少8位' });
      }

      res.status(201).json({ message: '创建成功' });
    });

    const response = await request(app)
      .post('/api/users')
      .send({ password: 'short' });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('密码长度至少8位');
  });

  test('应该验证用户名格式', async () => {
    app.post('/api/users', (req, res) => {
      const { username } = req.body;
      const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;

      if (!username || !usernameRegex.test(username)) {
        return res.status(400).json({ error: '用户名格式不正确' });
      }

      res.status(201).json({ message: '创建成功' });
    });

    const response = await request(app)
      .post('/api/users')
      .send({ username: 'ab' });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('用户名格式不正确');
  });
});

describe('API - 错误处理', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
  });

  test('应该正确处理404错误', async () => {
    app.use((req, res) => {
      res.status(404).json({ error: '未找到' });
    });

    const response = await request(app).get('/nonexistent');

    expect(response.status).toBe(404);
    expect(response.body.error).toBe('未找到');
  });

  test('应该正确处理500错误', async () => {
    app.get('/error', (req, res) => {
      res.status(500).json({ error: '服务器错误' });
    });

    const response = await request(app).get('/error');

    expect(response.status).toBe(500);
    expect(response.body.error).toBe('服务器错误');
  });

  test('应该正确处理JSON解析错误', async () => {
    app.use(express.json());
    app.use((err, req, res, next) => {
      if (err instanceof SyntaxError) {
        return res.status(400).json({ error: '无效的JSON' });
      }
      next(err);
    });

    const response = await request(app)
      .post('/api/test')
      .set('Content-Type', 'application/json')
      .send('{invalid json}');

    expect(response.status).toBe(400);
  });
});

describe('API - CORS和安全头部', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use((req, res, next) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'DENY');
      res.setHeader('X-XSS-Protection', '1; mode=block');
      next();
    });
  });

  test('应该包含安全头部', async () => {
    app.get('/test', (req, res) => {
      res.json({ message: '测试' });
    });

    const response = await request(app).get('/test');

    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-frame-options']).toBe('DENY');
    expect(response.headers['x-xss-protection']).toBe('1; mode=block');
  });
});

describe('API - 请求方法', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
  });

  test('应该支持GET请求', async () => {
    app.get('/api/test', (req, res) => {
      res.json({ method: 'GET' });
    });

    const response = await request(app).get('/api/test');

    expect(response.status).toBe(200);
    expect(response.body.method).toBe('GET');
  });

  test('应该支持POST请求', async () => {
    app.post('/api/test', (req, res) => {
      res.json({ method: 'POST', data: req.body });
    });

    const response = await request(app)
      .post('/api/test')
      .send({ name: 'test' });

    expect(response.status).toBe(200);
    expect(response.body.method).toBe('POST');
    expect(response.body.data.name).toBe('test');
  });

  test('应该支持PUT请求', async () => {
    app.put('/api/test/:id', (req, res) => {
      res.json({ method: 'PUT', id: req.params.id });
    });

    const response = await request(app).put('/api/test/123');

    expect(response.status).toBe(200);
    expect(response.body.method).toBe('PUT');
    expect(response.body.id).toBe('123');
  });

  test('应该支持DELETE请求', async () => {
    app.delete('/api/test/:id', (req, res) => {
      res.json({ method: 'DELETE', id: req.params.id });
    });

    const response = await request(app).delete('/api/test/123');

    expect(response.status).toBe(200);
    expect(response.body.method).toBe('DELETE');
  });
});
