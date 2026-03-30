/**
 * 查看剩余设备脚本
 * 用于查看剩余设备的详细信息
 */

const db = require('./database');

async function checkRemainingDevices() {
  try {
    console.log('开始查看剩余设备...');
    
    // 初始化数据库连接
    await db.initDatabase();
    
    // 获取所有设备
    const devices = await db.getAllDevices();
    console.log(`总设备数: ${devices.length}`);
    
    // 显示每个设备的详细信息
    devices.forEach((device, index) => {
      console.log(`\n设备 ${index + 1}:`);
      console.log(`  ID: ${device.id}`);
      console.log(`  名称: ${device.name}`);
      console.log(`  IP地址: ${device.ip_address}`);
      console.log(`  状态: ${device.status}`);
      console.log(`  在线: ${device.online}`);
    });
    
  } catch (error) {
    console.error('查看剩余设备失败:', error.message);
  }
}

checkRemainingDevices();