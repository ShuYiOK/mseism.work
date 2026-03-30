// Jest 测试环境设置

// 设置测试环境变量
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key-for-testing-only';
process.env.JWT_ACCESS_TOKEN_EXPIRES_IN = '1h';
process.env.JWT_REFRESH_TOKEN_EXPIRES_IN = '7d';

// 全局测试钩子
beforeAll(async () => {
  console.log('测试环境初始化完成');
});

afterAll(async () => {
  console.log('测试环境清理完成');
});
