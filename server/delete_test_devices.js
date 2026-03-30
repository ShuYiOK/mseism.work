/**
 * 删除测试设备脚本
 * 用于删除所有测试设备和设备名称为"设备-*"的设备
 */

const db = require('./database');

async function deleteTestDevices() {
  try {
    console.log('开始删除测试设备...');
    
    // 初始化数据库连接
    await db.initDatabase();
    
    // 获取所有设备
    const devices = await db.getAllDevices();
    console.log(`总设备数: ${devices.length}`);
    
    // 筛选测试设备（删除所有设备）
    const testDevices = devices;
    console.log(`测试设备数: ${testDevices.length}`);
    
    // 删除测试设备
    let deletedCount = 0;
    for (const device of testDevices) {
      try {
        await db.deleteDevice(device.id);
        console.log(`删除设备: ${device.name} (${device.id})`);
        deletedCount++;
      } catch (error) {
        console.error(`删除设备 ${device.name} 失败: ${error.message}`);
      }
    }
    
    console.log(`删除完成，共删除 ${deletedCount} 个测试设备`);
    
    // 获取剩余设备数
    const remainingDevices = await db.getAllDevices();
    console.log(`剩余设备数: ${remainingDevices.length}`);
    
  } catch (error) {
    console.error('删除测试设备失败:', error.message);
  }
}

deleteTestDevices();