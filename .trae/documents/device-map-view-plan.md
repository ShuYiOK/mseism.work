# 设备位置地图展示页面实施计划

## 概述

在设备列表页面（DeviceList.vue）中新增"地图"视图模式，与现有的表格视图和卡片视图形成三选一切换。使用开源 2D 地图库 Leaflet，将设备坐标（coodX=经度, coodY=纬度, coodZ=高程）直接标注在地图上。在线设备显示绿色标记，离线设备显示红色标记。切换分组时自动更新地图标记。地图全屏显示。

## 坐标数据说明

经确认，设备数据中的坐标**已经是 WGS84 十进制度**：

* `coodX` = 经度（longitude），如 107.498665、116.914811

* `coodY` = 纬度（latitude），如 29.594946、32.779537

* `coodZ` = 高程（elevation），如 521.6、34.9

**无需坐标转换**，可直接作为 `[coodY, coodX]` 传入 Leaflet。

## 实施步骤

### 步骤1：安装 Leaflet 地图库

* 安装 `leaflet` 依赖

* Leaflet 是轻量级开源 2D 地图库，约 40KB gzip

### 步骤2：创建地图组件 DeviceMap.vue

* 新建 `client/src/components/DeviceMap.vue`

* 核心功能：

  * 接收 `devices` prop（过滤后的设备列表）

  * 初始化 Leaflet 地图，使用 OpenStreetMap 瓦片

  * 将每个设备的 `[coodY, coodX]` 作为经纬度直接添加 Marker

  * 在线设备使用绿色圆点图标，离线设备使用红色圆点图标

  * 点击 Marker 显示设备详情 Popup（设备ID、IP、状态、坐标、高程）

  * 地图容器全屏显示（填满视口剩余空间）

  * `fitBounds` 自动缩放到所有标记点的范围

  * watch `devices` prop 变化自动更新标记点

### 步骤3：修改 DeviceList.vue 集成地图视图

* 扩展 `viewMode` 类型为 `'card' | 'table' | 'map'`

* 修改视图切换按钮逻辑：三选一循环切换（表格 → 卡片 → 地图 → 表格）

* 在模板中添加地图视图的条件渲染块

* 地图视图时隐藏 `.stats-row` 统计卡片行，让地图占据全屏

* 当 `selectedGroup` 或 `filteredDevices` 变化时，地图自动更新标记

* 引入 Leaflet CSS

### 步骤4：样式优化

* 地图全屏样式：`.device-map-container` 占满 `calc(100vh - 标题栏高度)`

* 地图视图下隐藏 `.stats-row`、`.copyright`

* 移动端适配：地图控件触摸友好

* 自定义 Marker 图标（绿/红圆点 + 阴影）

## 文件变更清单

| 文件                                    | 操作 | 说明            |
| ------------------------------------- | -- | ------------- |
| `client/package.json`                 | 修改 | 添加 leaflet 依赖 |
| `client/src/components/DeviceMap.vue` | 新建 | 地图组件（Leaflet） |
| `client/src/views/DeviceList.vue`     | 修改 | 集成地图视图模式      |

## 技术要点

### Leaflet 配置

* 使用 OpenStreetMap 免费瓦片图层：`https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png`

* 自定义 `L.divIcon` 实现绿/红圆点标记（轻量，无需加载图标图片）

* Popup 展示设备详情

* `L.featureGroup` + `fitBounds` 自动适配视口

* 地图初始中心点：中国中心位置约 \[32, 108]，zoom 5

### 坐标映射

* Leaflet 使用 `[lat, lng]` 顺序

* 设备 `coodY` → lat, `coodX` → lng

* 即 `L.latLng(device.coodY, device.coodX)`

### 分组联动

* 地图组件接收 `filteredDevices` 作为 prop

* `watch(devices)` 变化时清除旧标记、添加新标记并 fitBounds

* 切换分组后自动更新地图范围

