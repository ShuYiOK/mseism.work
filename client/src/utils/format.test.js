/**
 * 格式化工具测试
 */

describe('格式化工具', () => {
  describe('日期时间格式化', () => {
    const formatDateTime = (timestamp) => {
      if (!timestamp) return '-';
      const date = new Date(timestamp * 1000);
      return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    };

    test('应该正确格式化时间戳', () => {
      const timestamp = 1614556800; // 2021-03-01 00:00:00
      const formatted = formatDateTime(timestamp);

      expect(formatted).toBeDefined();
      expect(typeof formatted).toBe('string');
      expect(formatted).not.toBe('-');
    });

    test('应该处理空值', () => {
      expect(formatDateTime(null)).toBe('-');
      expect(formatDateTime(0)).toBeDefined();
      expect(formatDateTime(undefined)).toBe('-');
    });

    test('应该处理当前时间', () => {
      const now = Math.floor(Date.now() / 1000);
      const formatted = formatDateTime(now);

      expect(formatted).toBeDefined();
      expect(typeof formatted).toBe('string');
    });
  });

  describe('文件大小格式化', () => {
    const formatBytes = (bytes) => {
      if (bytes === 0) return '0 B';
      const k = 1024;
      const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    test('应该正确格式化字节', () => {
      expect(formatBytes(0)).toBe('0 B');
      expect(formatBytes(1024)).toBe('1 KB');
      expect(formatBytes(1024 * 1024)).toBe('1 MB');
      expect(formatBytes(1024 * 1024 * 1024)).toBe('1 GB');
    });

    test('应该处理小数值', () => {
      const result = formatBytes(1536);
      expect(result).toContain('KB');
      expect(parseFloat(result)).toBeGreaterThan(1);
    });
  });

  describe('数字格式化', () => {
    const formatNumber = (num) => {
      if (num === null || num === undefined) return '-';
      return num.toLocaleString('zh-CN');
    };

    test('应该正确格式化数字', () => {
      expect(formatNumber(1000)).toBe('1,000');
      expect(formatNumber(1000000)).toBe('1,000,000');
      expect(formatNumber(1234.56)).toContain('1,234');
    });

    test('应该处理空值', () => {
      expect(formatNumber(null)).toBe('-');
      expect(formatNumber(undefined)).toBe('-');
    });

    test('应该处理零', () => {
      expect(formatNumber(0)).toBe('0');
    });
  });

  describe('字符串截断', () => {
    const truncate = (str, maxLength = 50) => {
      if (!str) return '';
      if (str.length <= maxLength) return str;
      return str.substring(0, maxLength) + '...';
    };

    test('应该截断长字符串', () => {
      const longStr = 'a'.repeat(100);
      const truncated = truncate(longStr, 50);

      expect(truncated.length).toBe(53); // 50 + '...'
      expect(truncated.endsWith('...')).toBe(true);
    });

    test('不应该截断短字符串', () => {
      const shortStr = 'short';
      const truncated = truncate(shortStr, 50);

      expect(truncated).toBe('short');
      expect(truncated.length).toBe(5);
    });

    test('应该处理空字符串', () => {
      expect(truncate('')).toBe('');
      expect(truncate(null)).toBe('');
    });
  });

  describe('状态文本格式化', () => {
    const formatStatus = (status) => {
      const statusMap = {
        online: '在线',
        offline: '离线',
        unknown: '未知',
        warning: '警告',
        error: '错误'
      };
      return statusMap[status] || status;
    };

    test('应该正确映射状态', () => {
      expect(formatStatus('online')).toBe('在线');
      expect(formatStatus('offline')).toBe('离线');
      expect(formatStatus('unknown')).toBe('未知');
      expect(formatStatus('warning')).toBe('警告');
      expect(formatStatus('error')).toBe('错误');
    });

    test('应该返回未知状态的原文', () => {
      expect(formatStatus('custom')).toBe('custom');
    });
  });
});
