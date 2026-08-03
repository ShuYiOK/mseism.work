/**
 * 坐标系转换工具
 * WGS84 <-> GCJ02（火星坐标系）
 *
 * 高德瓦片底图为 GCJ02 坐标系，而设备入库的 coodX(经度)/coodY(纬度) 为 WGS84，
 * 因此服务端绘制截图前需做与前端 DeviceMap.vue 一致的 WGS84→GCJ02 转换。
 * 算法移植自 client/src/components/DeviceMap.vue，保持前后端一致。
 */

const PI = Math.PI;
const a = 6378245.0;
const ee = 0.00669342162296594323;

/**
 * 判断坐标是否在中国境外（境外不做偏移，直接返回原值）
 */
function outOfChina(lng, lat) {
  return lng < 72.004 || lng > 137.8347 || lat < 0.8293 || lat > 55.8271;
}

function transformLat(x, y) {
  let ret = -100.0 + 2.0 * x + 3.0 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x));
  ret += (20.0 * Math.sin(6.0 * x * PI) + 20.0 * Math.sin(2.0 * x * PI)) * 2.0 / 3.0;
  ret += (20.0 * Math.sin(y * PI) + 40.0 * Math.sin(y / 3.0 * PI)) * 2.0 / 3.0;
  ret += (160.0 * Math.sin(y / 12.0 * PI) + 320 * Math.sin(y * PI / 30.0)) * 2.0 / 3.0;
  return ret;
}

function transformLng(x, y) {
  let ret = 300.0 + x + 2.0 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x));
  ret += (20.0 * Math.sin(6.0 * x * PI) + 20.0 * Math.sin(2.0 * x * PI)) * 2.0 / 3.0;
  ret += (20.0 * Math.sin(x * PI) + 40.0 * Math.sin(x / 3.0 * PI)) * 2.0 / 3.0;
  ret += (150.0 * Math.sin(x / 12.0 * PI) + 300.0 * Math.sin(x / 30.0 * PI)) * 2.0 / 3.0;
  return ret;
}

/**
 * WGS84 转 GCJ02
 * @param {number} lat 纬度
 * @param {number} lng 经度
 * @returns {{lat: number, lng: number}}
 */
function wgs84ToGcj02(lat, lng) {
  if (outOfChina(lng, lat)) {
    return { lat, lng };
  }
  let dLat = transformLat(lng - 105.0, lat - 35.0);
  let dLng = transformLng(lng - 105.0, lat - 35.0);
  const radLat = (lat / 180.0) * PI;
  let magic = Math.sin(radLat);
  magic = 1 - ee * magic * magic;
  const sqrtMagic = Math.sqrt(magic);
  dLat = (dLat * 180.0) / ((a * (1 - ee)) / (magic * sqrtMagic) * PI);
  dLng = (dLng * 180.0) / (a / sqrtMagic * Math.cos(radLat) * PI);
  const mgLat = lat + dLat;
  const mgLng = lng + dLng;
  return { lat: mgLat, lng: mgLng };
}

module.exports = {
  PI,
  a,
  ee,
  outOfChina,
  transformLat,
  transformLng,
  wgs84ToGcj02,
};
