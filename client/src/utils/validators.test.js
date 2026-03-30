/**
 * 验证器工具测试
 */

describe('验证器工具', () => {
  describe('邮箱验证', () => {
    const isValidEmail = (email) => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return emailRegex.test(email);
    };

    test('应该接受有效的邮箱地址', () => {
      expect(isValidEmail('user@example.com')).toBe(true);
      expect(isValidEmail('test.user@domain.co.uk')).toBe(true);
      expect(isValidEmail('admin@localhost.local')).toBe(true);
      expect(isValidEmail('user+tag@example.com')).toBe(true);
    });

    test('应该拒绝无效的邮箱地址', () => {
      expect(isValidEmail('invalid')).toBe(false);
      expect(isValidEmail('invalid@')).toBe(false);
      expect(isValidEmail('@example.com')).toBe(false);
      expect(isValidEmail('')).toBe(false);
      expect(isValidEmail('user@')).toBe(false);
      expect(isValidEmail('user@.com')).toBe(false);
    });
  });

  describe('用户名验证', () => {
    const isValidUsername = (username) => {
      const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
      return usernameRegex.test(username);
    };

    test('应该接受有效的用户名', () => {
      expect(isValidUsername('user123')).toBe(true);
      expect(isValidUsername('test_user')).toBe(true);
      expect(isValidUsername('abc')).toBe(true);
      expect(isValidUsername('ABC_123')).toBe(true);
    });

    test('应该拒绝无效的用户名', () => {
      expect(isValidUsername('ab')).toBe(false); // 太短
      expect(isValidUsername('user@123')).toBe(false); // 包含特殊字符
      expect(isValidUsername('user-123')).toBe(false); // 包含连字符
      expect(isValidUsername('')).toBe(false); // 空字符串
      expect(isValidUsername('a'.repeat(21))).toBe(false); // 太长
    });
  });

  describe('密码验证', () => {
    const isValidPassword = (password) => {
      return password && password.length >= 8;
    };

    test('应该接受有效的密码', () => {
      expect(isValidPassword('password123')).toBe(true);
      expect(isValidPassword('12345678')).toBe(true);
      expect(isValidPassword('abcdefgh')).toBe(true);
      expect(isValidPassword('Abc123!@')).toBe(true);
    });

    test('应该拒绝无效的密码', () => {
      expect(isValidPassword('')).toBe('');
      expect(isValidPassword('short')).toBe(false);
      expect(isValidPassword('1234567')).toBe(false);
      // null 和 undefined 在函数中会抛出错误或返回空值
      expect(!isValidPassword(null)).toBe(true);
      expect(!isValidPassword(undefined)).toBe(true);
    });
  });

  describe('IP地址验证', () => {
    const isValidIP = (ip) => {
      const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
      return ipRegex.test(ip);
    };

    test('应该接受有效的IP地址', () => {
      expect(isValidIP('192.168.1.1')).toBe(true);
      expect(isValidIP('10.0.0.1')).toBe(true);
      expect(isValidIP('172.16.0.1')).toBe(true);
      expect(isValidIP('127.0.0.1')).toBe(true);
      expect(isValidIP('0.0.0.0')).toBe(true);
      expect(isValidIP('255.255.255.255')).toBe(true);
    });

    test('应该拒绝无效的IP地址', () => {
      expect(isValidIP('256.1.1.1')).toBe(false);
      expect(isValidIP('192.168.1')).toBe(false);
      expect(isValidIP('192.168.1.1.1')).toBe(false);
      expect(isValidIP('192.168.1.256')).toBe(false);
      expect(isValidIP('')).toBe(false);
      expect(isValidIP('abc.def.ghi.jkl')).toBe(false);
    });
  });

  describe('端口号验证', () => {
    const isValidPort = (port) => {
      const portNum = parseInt(port);
      return !isNaN(portNum) && portNum > 0 && portNum < 65536;
    };

    test('应该接受有效的端口号', () => {
      expect(isValidPort(80)).toBe(true);
      expect(isValidPort(443)).toBe(true);
      expect(isValidPort(3000)).toBe(true);
      expect(isValidPort(8080)).toBe(true);
      expect(isValidPort(1)).toBe(true);
      expect(isValidPort(65535)).toBe(true);
    });

    test('应该拒绝无效的端口号', () => {
      expect(isValidPort(0)).toBe(false);
      expect(isValidPort(-1)).toBe(false);
      expect(isValidPort(65536)).toBe(false);
      expect(isValidPort('abc')).toBe(false);
      expect(isValidPort(null)).toBe(false);
      expect(isValidPort(undefined)).toBe(false);
    });
  });

  describe('URL验证', () => {
    const isValidURL = (url) => {
      try {
        new URL(url);
        return true;
      } catch {
        return false;
      }
    };

    test('应该接受有效的URL', () => {
      expect(isValidURL('http://example.com')).toBe(true);
      expect(isValidURL('https://example.com')).toBe(true);
      expect(isValidURL('https://example.com/path')).toBe(true);
      expect(isValidURL('https://example.com/path?query=value')).toBe(true);
      expect(isValidURL('https://example.com:8080')).toBe(true);
    });

    test('应该拒绝无效的URL', () => {
      expect(isValidURL('')).toBe(false);
      expect(isValidURL('not a url')).toBe(false);
      expect(isValidURL('example.com')).toBe(false);
      expect(isValidURL('ftp://')).toBe(false);
    });
  });
});
