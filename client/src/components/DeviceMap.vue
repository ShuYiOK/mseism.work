<template>
  <div ref="mapContainer" class="device-map-container"></div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const props = defineProps({
  devices: {
    type: Array,
    default: () => []
  }
})

const mapContainer = ref(null)
let map = null
let markersGroup = null
let markerMap = {}

const PI = Math.PI
const a = 6378245.0
const ee = 0.00669342162296594323

const outOfChina = (lat, lng) => {
  return lng < 72.004 || lng > 137.8347 || lat < 0.8293 || lat > 55.8271
}

const transformLat = (x, y) => {
  let ret = -100.0 + 2.0 * x + 3.0 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x))
  ret += (20.0 * Math.sin(6.0 * x * PI) + 20.0 * Math.sin(2.0 * x * PI)) * 2.0 / 3.0
  ret += (20.0 * Math.sin(y * PI) + 40.0 * Math.sin(y / 3.0 * PI)) * 2.0 / 3.0
  ret += (160.0 * Math.sin(y / 12.0 * PI) + 320 * Math.sin(y * PI / 30.0)) * 2.0 / 3.0
  return ret
}

const transformLng = (x, y) => {
  let ret = 300.0 + x + 2.0 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x))
  ret += (20.0 * Math.sin(6.0 * x * PI) + 20.0 * Math.sin(2.0 * x * PI)) * 2.0 / 3.0
  ret += (20.0 * Math.sin(x * PI) + 40.0 * Math.sin(x / 3.0 * PI)) * 2.0 / 3.0
  ret += (150.0 * Math.sin(x / 12.0 * PI) + 300.0 * Math.sin(x / 30.0 * PI)) * 2.0 / 3.0
  return ret
}

const wgs84ToGcj02 = (lat, lng) => {
  if (outOfChina(lat, lng)) return { lat, lng }
  let dLat = transformLat(lng - 105.0, lat - 35.0)
  let dLng = transformLng(lng - 105.0, lat - 35.0)
  const radLat = lat / 180.0 * PI
  let magic = Math.sin(radLat)
  magic = 1 - ee * magic * magic
  const sqrtMagic = Math.sqrt(magic)
  dLat = (dLat * 180.0) / ((a * (1 - ee)) / (magic * sqrtMagic) * PI)
  dLng = (dLng * 180.0) / (a / sqrtMagic * Math.cos(radLat) * PI)
  return { lat: lat + dLat, lng: lng + dLng }
}

const escapeHtml = (str) => {
  if (str == null) return ''
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const iconOnline = L.divIcon({
  className: 'custom-marker',
  html: '<div class="marker-dot marker-online"></div>',
  iconSize: [14, 14],
  iconAnchor: [7, 7],
  popupAnchor: [0, -10]
})

const iconOffline = L.divIcon({
  className: 'custom-marker',
  html: '<div class="marker-dot marker-offline"></div>',
  iconSize: [14, 14],
  iconAnchor: [7, 7],
  popupAnchor: [0, -10]
})

const initMap = () => {
  if (!mapContainer.value) return

  map = L.map(mapContainer.value, {
    center: [35.86, 104.19],
    zoom: 5,
    zoomControl: true,
    attributionControl: false,
    preferCanvas: true,
    minZoom: 3,
    maxZoom: 18
  })

  L.tileLayer('https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}', {
    subdomains: ['1', '2', '3', '4'],
    maxZoom: 18,
    attribution: '&copy; 高德地图'
  }).addTo(map)

  markersGroup = L.featureGroup().addTo(map)

  setTimeout(() => {
    if (map) {
      map.invalidateSize({ animate: false })
    }
    updateMarkers()
  }, 200)
}

const parseValidDevices = () => {
  return props.devices
    .map(d => {
      const lat = parseFloat(d.coodY)
      const lng = parseFloat(d.coodX)
      const elev = parseFloat(d.coodZ) || 0
      if (isNaN(lat) || isNaN(lng) || (lat === 0 && lng === 0)) return null
      const gcj = wgs84ToGcj02(lat, lng)
      return { ...d, _lat: gcj.lat, _lng: gcj.lng, _origLat: lat, _origLng: lng, _elev: elev }
    })
    .filter(Boolean)
}

const buildPopupContent = (device) => {
  const statusHtml = device.online
    ? '<span style="color:#4caf50">● 在线</span>'
    : '<span style="color:#f44336">● 离线</span>'
  const name = escapeHtml(device.device || device.id)
  const ip = escapeHtml(device.ip_address || device.addr || '-')
  return `<div style="font-size:13px;line-height:1.6;min-width:160px">
    <div style="font-weight:600;font-size:14px;margin-bottom:6px">${name}</div>
    <div>${statusHtml}</div>
    <div>IP: ${ip}</div>
    <div>经度: ${device._origLng.toFixed(6)}°</div>
    <div>纬度: ${device._origLat.toFixed(6)}°</div>
    <div>高程: ${device._elev.toFixed(1)}m</div>
  </div>`
}

const updateMarkers = () => {
  if (!map || !markersGroup) return

  const validDevices = parseValidDevices()
  const newDeviceIds = new Set(validDevices.map(d => d.id))

  for (const [id, marker] of Object.entries(markerMap)) {
    if (!newDeviceIds.has(id)) {
      markersGroup.removeLayer(marker)
      delete markerMap[id]
    }
  }

  validDevices.forEach(device => {
    const existing = markerMap[device.id]
    if (existing) {
      existing.setIcon(device.online ? iconOnline : iconOffline)
      existing.setPopupContent(buildPopupContent(device))
    } else {
      const marker = L.marker([device._lat, device._lng], {
        icon: device.online ? iconOnline : iconOffline
      })
      marker.bindPopup(buildPopupContent(device), { maxWidth: 280 })
      markersGroup.addLayer(marker)
      markerMap[device.id] = marker
    }
  })

  nextTick(() => {
    if (!map || !markersGroup) return
    map.invalidateSize()
    if (validDevices.length > 0) {
      if (validDevices.length === 1) {
        map.setView([validDevices[0]._lat, validDevices[0]._lng], 12)
      } else {
        map.fitBounds(markersGroup.getBounds().pad(0.1))
      }
    }
  })
}

watch(
  () => props.devices.map(d => `${d.id}:${d.coodX}:${d.coodY}:${d.online}`).join('|'),
  () => { updateMarkers() }
)

onMounted(() => {
  nextTick(() => {
    initMap()
  })
})

onUnmounted(() => {
  markerMap = {}
  if (markersGroup) {
    markersGroup.clearLayers()
    markersGroup = null
  }
  if (map) {
    map.remove()
    map = null
  }
})

defineExpose({ invalidateSize: () => map?.invalidateSize() })
</script>

<style>
.custom-marker {
  background: none !important;
  border: none !important;
}

.marker-dot {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 2px solid #fff;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.4);
  transition: transform 0.15s;
}

.marker-dot:hover {
  transform: scale(1.3);
}

.marker-online {
  background: #4caf50;
}

.marker-offline {
  background: #f44336;
}

.leaflet-popup-content-wrapper {
  border-radius: 10px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.leaflet-popup-content {
  margin: 12px 16px;
}
</style>

<style scoped>
.device-map-container {
  width: 100%;
  flex: 1;
  min-height: 0;
}
</style>
