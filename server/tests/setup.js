/**
 * Jest 测试设置文件
 */

// 设置测试环境变量
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error';

// 全局超时设置
jest.setTimeout(10000);

// 全局清理函数
afterAll(async () => {
  // 清理测试数据
  await new Promise(resolve => setTimeout(resolve, 100));
});

// 模拟 console.log 在测试时减少输出
const originalConsole = { ...console };

beforeAll(() => {
  console.log = jest.fn();
  console.info = jest.fn();
  console.warn = jest.fn();
});

afterAll(() => {
  console.log = originalConsole.log;
  console.info = originalConsole.info;
  console.warn = originalConsole.warn;
});
