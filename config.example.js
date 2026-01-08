/**
 * 天地图 API 配置文件
 *
 * 使用方法：
 * 1. 将此文件复制为 config.js
 * 2. 在 http://lbs.tianditu.gov.cn/ 申请免费密钥
 * 3. 将申请到的密钥替换下方的 YOUR_TIANDITU_KEY_HERE
 */

window.appConfig = {
  // 天地图 API 密钥
  // 申请地址: http://lbs.tianditu.gov.cn/
  tiandituApiKey: 'YOUR_TIANDITU_KEY_HERE',

  // 默认地图图层
  // 可选值: 'tdtVector', 'tdtSatellite', 'tdtTerrain', 'osm', 'satellite', 'cartoDark', 'cartoLight'
  defaultMapLayer: 'tdtVector',
};
