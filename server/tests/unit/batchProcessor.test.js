/**
 * 批处理模块单元测试
 */
// mock 掉服务层，避免依赖真实数据库
jest.mock('../../services/deviceService', () => ({
  getAllDevices: jest.fn().mockResolvedValue([{ id: 'd1' }]),
  getDeviceById: jest.fn().mockResolvedValue({ id: 'd1' }),
  getDeviceStats: jest.fn().mockResolvedValue({ total: 1 }),
  getOnlineDevices: jest.fn().mockResolvedValue([]),
  getOfflineDevices: jest.fn().mockResolvedValue([]),
  getDevicesByStatus: jest.fn().mockResolvedValue([]),
  getAllDevicesWithGroups: jest.fn().mockResolvedValue([]),
}));
jest.mock('../../services/groupService', () => ({
  getAllGroups: jest.fn().mockResolvedValue([{ id: 'g1', name: '组1' }]),
  getGroupById: jest.fn().mockResolvedValue({ id: 'g1' }),
  getAllGroupsWithDevices: jest.fn().mockResolvedValue([]),
}));

const { BatchProcessor, QueryOptimizer } = require('../../modules/batchProcessor');

describe('QueryOptimizer', () => {
  describe('sanitizeFields', () => {
    test('应该返回有效的字段列表', () => {
      const fields = QueryOptimizer.sanitizeFields('id,name,status');
      expect(fields).toEqual(['id', 'name', 'status']);
    });

    test('应该过滤无效字段', () => {
      const fields = QueryOptimizer.sanitizeFields('id,name,invalid_field');
      expect(fields).toEqual(['id', 'name']);
    });

    test('应该处理带空格的字段名', () => {
      const fields = QueryOptimizer.sanitizeFields(' id , name ');
      expect(fields).toEqual(['id', 'name']);
    });

    test('应该返回null当没有有效字段', () => {
      const fields = QueryOptimizer.sanitizeFields('invalid1,invalid2');
      expect(fields).toBeNull();
    });

    test('应该处理空字符串', () => {
      const fields = QueryOptimizer.sanitizeFields('');
      expect(fields).toBeNull();
    });

    test('应该处理undefined', () => {
      const fields = QueryOptimizer.sanitizeFields(undefined);
      expect(fields).toBeNull();
    });
  });

  describe('validateLimit', () => {
    test('应该返回有效的限制值', () => {
      expect(QueryOptimizer.validateLimit(50)).toBe(50);
      expect(QueryOptimizer.validateLimit('100')).toBe(100);
    });

    test('应该返回默认值当输入无效', () => {
      expect(QueryOptimizer.validateLimit(NaN)).toBe(100);
      expect(QueryOptimizer.validateLimit(-1)).toBe(100);
      expect(QueryOptimizer.validateLimit(0)).toBe(100);
    });

    test('应该限制最大返回值', () => {
      expect(QueryOptimizer.validateLimit(5000)).toBe(1000);
      expect(QueryOptimizer.validateLimit(5000, 500)).toBe(500);
    });
  });

  describe('validateOffset', () => {
    test('应该返回有效的偏移值', () => {
      expect(QueryOptimizer.validateOffset(50)).toBe(50);
      expect(QueryOptimizer.validateOffset('100')).toBe(100);
    });

    test('应该返回0当输入无效', () => {
      expect(QueryOptimizer.validateOffset(NaN)).toBe(0);
      expect(QueryOptimizer.validateOffset(-1)).toBe(0);
    });
  });
});

describe('BatchProcessor', () => {
  let batchProcessor;

  beforeEach(() => {
    batchProcessor = new BatchProcessor();
  });

  afterEach(() => {
    batchProcessor.clearCache();
  });

  describe('processBatch', () => {
    test('应该抛出错误当请求列表为空', async () => {
      await expect(batchProcessor.processBatch([])).rejects.toThrow('请求列表不能为空');
      await expect(batchProcessor.processBatch(null)).rejects.toThrow('请求列表不能为空');
    });

    test('应该抛出错误当请求数量超过限制', async () => {
      const requests = Array(15).fill({ type: 'getDevices' });
      await expect(batchProcessor.processBatch(requests)).rejects.toThrow('批量请求数量不能超过');
    });

    test('应该处理有效的批量请求', async () => {
      const requests = [
        { id: 1, type: 'getGroups' }
      ];

      const result = await batchProcessor.processBatch(requests);

      expect(result.meta.count).toBe(1);
      expect(result.meta.success).toBe(1);
      expect(result.meta.failed).toBe(0);
    });

    test('应该返回失败结果当请求类型无效', async () => {
      const requests = [
        { id: 1, type: 'invalidType' }
      ];

      const result = await batchProcessor.processBatch(requests);

      expect(result.results[0].success).toBe(false);
      expect(result.results[0].error).toContain('未知的请求类型');
    });
  });

  describe('缓存功能', () => {
    test('应该缓存结果', async () => {
      const requests1 = [{ id: 1, type: 'getGroups' }];
      const requests2 = [{ id: 2, type: 'getGroups' }];

      const result1 = await batchProcessor.processBatch(requests1);
      const result2 = await batchProcessor.processBatch(requests2);

      expect(result1.results[0].data).toEqual(result2.results[0].data);
    });

    test('应该清除缓存', () => {
      batchProcessor.cache.set('test', { data: 'test' });
      batchProcessor.clearCache();
      expect(batchProcessor.cache.size).toBe(0);
    });

    test('应该设置缓存TTL', () => {
      batchProcessor.setCacheTTL(10000);
      expect(batchProcessor.cacheTTL).toBe(10000);
    });
  });

  describe('getCacheKey', () => {
    test('应该生成正确的缓存键', () => {
      const key1 = batchProcessor.getCacheKey('getDevices', {});
      const key2 = batchProcessor.getCacheKey('getDevices', { id: 1 });
      const key3 = batchProcessor.getCacheKey('getDevice', { id: 1 });

      expect(key1).toBe('getDevices:{}');
      expect(key2).toBe('getDevices:{"id":1}');
      expect(key1).not.toBe(key3);
    });
  });
});
