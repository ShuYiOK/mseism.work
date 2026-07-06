/**
 * 缓存优化模块单元测试
 */
const {
  MultiLevelCache,
  CacheKeyBuilder,
  CacheWarmer,
  CacheInvalidator
} = require('../../modules/cacheOptimizer');

describe('CacheKeyBuilder', () => {
  describe('键生成', () => {
    test('应该生成正确的设备列表键', () => {
      const key = CacheKeyBuilder.devices();
      expect(key).toBe('mseism:devices');
    });

    test('应该生成正确的单个设备键', () => {
      const key = CacheKeyBuilder.device('123');
      expect(key).toBe('mseism:device:123');
    });

    test('应该生成正确的设备统计键', () => {
      const key = CacheKeyBuilder.deviceStats();
      expect(key).toBe('mseism:devices:stats');
    });

    test('应该生成正确的在线设备键', () => {
      const key = CacheKeyBuilder.onlineDevices();
      expect(key).toBe('mseism:devices:online');
    });

    test('应该生成正确的离线设备键', () => {
      const key = CacheKeyBuilder.offlineDevices();
      expect(key).toBe('mseism:devices:offline');
    });

    test('应该生成正确的分组键', () => {
      expect(CacheKeyBuilder.groups()).toBe('mseism:groups');
      expect(CacheKeyBuilder.group('456')).toBe('mseism:group:456');
    });

    test('应该生成正确的用户键', () => {
      const key = CacheKeyBuilder.user('789');
      expect(key).toBe('mseism:user:789');
    });

    test('应该生成正确的会话键', () => {
      const key = CacheKeyBuilder.session('abc');
      expect(key).toBe('mseism:session:abc');
    });

    test('应该生成正确的模式匹配键', () => {
      const key = CacheKeyBuilder.pattern('devices');
      expect(key).toBe('mseism:devices:*');
    });
  });
});

describe('MultiLevelCache', () => {
  let cache;

  beforeEach(() => {
    cache = new MultiLevelCache();
  });

  describe('L1缓存操作', () => {
    test('应该设置和获取值', () => {
      cache.set('testKey', { value: 'testData' });
      const result = cache.get('testKey');

      expect(result).toEqual({ value: 'testData' });
    });

    test('应该在L1缓存未命中时返回null', () => {
      const result = cache.get('nonexistent');
      expect(result).toBeNull();
    });

    test('应该删除键', () => {
      cache.set('testKey', { value: 'testData' });
      cache.del('testKey');
      const result = cache.get('testKey');

      expect(result).toBeNull();
    });

    test('应该清空所有缓存', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.clear();

      expect(cache.l1Cache.size).toBe(0);
    });

    test('应该跟踪命中和未命中统计', () => {
      cache.set('key1', 'value1');
      cache.get('key1');
      cache.get('nonexistent');

      const stats = cache.getStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
    });

    test('应该计算命中率', () => {
      cache.set('key1', 'value1');
      cache.get('key1');
      cache.get('key1');
      cache.get('nonexistent');

      const stats = cache.getStats();
      expect(stats.hitRate).toBe(0.666);
    });
  });

  describe('TTL过期', () => {
    test('应该支持自定义TTL', () => {
      cache.set('shortKey', 'value', 100);
      const result = cache.get('shortKey');
      expect(result).toBe('value');
    });
  });

  describe('统计信息', () => {
    test('应该返回正确的统计信息', () => {
      cache.set('key1', 'value1');
      cache.get('key1');
      cache.get('nonexistent');

      const stats = cache.getStats();

      expect(stats).toHaveProperty('hits');
      expect(stats).toHaveProperty('misses');
      expect(stats).toHaveProperty('hitRate');
      expect(stats).toHaveProperty('l1Size');
      expect(stats.l1Size).toBe(1);
    });

    test('应该重置统计', () => {
      cache.set('key1', 'value1');
      cache.get('key1');

      cache.reset();
      const stats = cache.getStats();

      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
    });
  });
});

describe('CacheWarmer', () => {
  test('应该创建实例', () => {
    const mockCache = new MultiLevelCache();
    const mockDeviceService = {};
    const mockGroupService = {};
    const warmer = new CacheWarmer(mockCache, mockDeviceService, mockGroupService);

    expect(warmer.cache).toBe(mockCache);
    expect(warmer.deviceService).toBe(mockDeviceService);
    expect(warmer.groupService).toBe(mockGroupService);
  });
});

describe('CacheInvalidator', () => {
  let cache;
  let invalidator;

  beforeEach(() => {
    cache = new MultiLevelCache();
    invalidator = new CacheInvalidator(cache);
  });

  test('应该创庺实例', () => {
    expect(invalidator.cache).toBe(cache);
  });

  test('应该使设备缓存失效', () => {
    cache.set('mseism:devices', 'data');
    cache.set('mseism:device:123', 'data');

    invalidator.invalidateDevice();

    expect(cache.l1Cache.size).toBe(0);
  });

  test('应该使指定设备缓存失效', () => {
    cache.set('mseism:device:123', 'data');
    cache.set('mseism:device:456', 'data');
    cache.set('mseism:devices', 'data');

    invalidator.invalidateDevice('123');

    expect(cache.get('mseism:device:123')).toBeNull();
    expect(cache.get('mseism:device:456')).not.toBeNull();
    expect(cache.get('mseism:devices')).toBeNull();
  });

  test('应该使分组缓存失效', () => {
    cache.set('mseism:groups', 'data');
    cache.set('mseism:group:123', 'data');

    invalidator.invalidateGroup();

    expect(cache.l1Cache.size).toBe(0);
  });

  test('should invalidate stats cache', () => {
    cache.set('mseism:devices:stats', 'data');

    invalidator.invalidateStats();

    expect(cache.get('mseism:devices:stats')).toBeNull();
  });

  test('应该使所有缓存失效', () => {
    cache.set('mseism:devices', 'data');
    cache.set('mseism:groups', 'data');
    cache.set('mseism:users', 'data');

    invalidator.invalidateAll();

    expect(cache.l1Cache.size).toBe(0);
  });
});
