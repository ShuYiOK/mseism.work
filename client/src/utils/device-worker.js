/**
 * Web Worker 用于处理大量设备数据的计算
 * 避免阻塞主线程，提升页面性能
 */

// 处理设备数据统计
const calculateStats = (devices) => {
  const total = devices.length
  const online = devices.filter(d => d.online).length
  const offline = total - online
  
  // 计算平均指标
  let totalTemp = 0
  let totalStorage = 0
  let totalCpu = 0
  let totalMemory = 0
  let validCount = 0
  
  devices.forEach(d => {
    if (d.temperature !== undefined) {
      totalTemp += d.temperature
      validCount++
    }
    if (d.storage_usage !== undefined) {
      totalStorage += d.storage_usage
      validCount++
    }
    if (d.cpu_usage !== undefined) {
      totalCpu += d.cpu_usage
      validCount++
    }
    if (d.memory_usage !== undefined) {
      totalMemory += d.memory_usage
      validCount++
    }
  })
  
  const avgTemp = validCount > 0 ? totalTemp / validCount : 0
  const avgStorage = validCount > 0 ? totalStorage / validCount : 0
  const avgCpu = validCount > 0 ? totalCpu / validCount : 0
  const avgMemory = validCount > 0 ? totalMemory / validCount : 0
  
  return {
    total,
    online,
    offline,
    averages: {
      temperature: avgTemp,
      storage: avgStorage,
      cpu: avgCpu,
      memory: avgMemory
    }
  }
}

// 按条件过滤设备
const filterDevices = (devices, filters) => {
  let result = [...devices]
  
  if (filters.status !== undefined) {
    result = result.filter(d => d.online === filters.status)
  }
  
  if (filters.groupId) {
    result = result.filter(d => d.groupId === filters.groupId)
  }
  
  if (filters.search) {
    const searchLower = filters.search.toLowerCase()
    result = result.filter(d => 
      d.id.toLowerCase().includes(searchLower) ||
      d.name.toLowerCase().includes(searchLower)
    )
  }
  
  if (filters.minTemp !== undefined) {
    result = result.filter(d => d.temperature >= filters.minTemp)
  }
  
  if (filters.maxTemp !== undefined) {
    result = result.filter(d => d.temperature <= filters.maxTemp)
  }
  
  return result
}

// 排序设备
const sortDevices = (devices, sortBy, order = 'asc') => {
  return [...devices].sort((a, b) => {
    let aVal = a[sortBy]
    let bVal = b[sortBy]
    
    if (aVal === undefined || aVal === null) aVal = 0
    if (bVal === undefined || bVal === null) bVal = 0
    
    if (typeof aVal === 'string') {
      aVal = aVal.toLowerCase()
      bVal = bVal.toLowerCase()
    }
    
    const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0
    return order === 'asc' ? comparison : -comparison
  })
}

// 分组统计
const groupByStatus = (devices) => {
  const groups = {
    online: [],
    offline: []
  }
  
  devices.forEach(d => {
    if (d.online) {
      groups.online.push(d)
    } else {
      groups.offline.push(d)
    }
  })
  
  return groups
}

// 分组统计（按自定义字段）
const groupByField = (devices, field) => {
  const groups = {}
  
  devices.forEach(d => {
    const key = d[field] ?? 'unknown'
    if (!groups[key]) {
      groups[key] = []
    }
    groups[key].push(d)
  })
  
  return groups
}

// 批量处理设备数据
const processBatchDevices = (devices, operations) => {
  let result = [...devices]
  
  operations.forEach(op => {
    switch (op.type) {
      case 'filter':
        result = filterDevices(result, op.params)
        break
      case 'sort':
        result = sortDevices(result, op.params.sortBy, op.params.order)
        break
      case 'transform':
        result = result.map(d => ({
          ...d,
          ...op.params.transform(d)
        }))
        break
    }
  })
  
  return result
}

// 计算设备健康度
const calculateHealthScore = (devices) => {
  return devices.map(d => {
    let score = 100
    const penalties = []
    
    // 离线设备扣分
    if (!d.online) {
      score -= 50
      penalties.push({ type: 'offline', penalty: 50 })
    }
    
    // 高温扣分
    if (d.temperature > 80) {
      score -= 20
      penalties.push({ type: 'high_temp', penalty: 20 })
    } else if (d.temperature > 60) {
      score -= 10
      penalties.push({ type: 'warm', penalty: 10 })
    }
    
    // 高存储使用率扣分
    if (d.storage_usage > 90) {
      score -= 20
      penalties.push({ type: 'storage_critical', penalty: 20 })
    } else if (d.storage_usage > 70) {
      score -= 10
      penalties.push({ type: 'storage_warning', penalty: 10 })
    }
    
    // 高延迟扣分（delay 才是延迟字段，单位 ms；cpu_usage 是 CPU 百分比 0-100）
    if (d.delay > 500) {
      score -= 15
      penalties.push({ type: 'high_latency', penalty: 15 })
    } else if (d.delay > 200) {
      score -= 5
      penalties.push({ type: 'moderate_latency', penalty: 5 })
    }
    
    return {
      deviceId: d.id,
      score: Math.max(0, score),
      level: score >= 80 ? 'healthy' : score >= 50 ? 'warning' : 'critical',
      penalties
    }
  })
}

// 检测设备异常
const detectAnomalies = (devices, thresholds = {}) => {
  const defaultThresholds = {
    maxTemp: 80,
    maxStorage: 90,
    maxLatency: 500,
    maxMemory: 90
  }
  
  const config = { ...defaultThresholds, ...thresholds }
  const anomalies = []
  
  devices.forEach(d => {
    const deviceAnomalies = []
    
    if (!d.online) {
      deviceAnomalies.push({ type: 'offline', severity: 'critical', value: false })
    }
    
    if (d.temperature > config.maxTemp) {
      deviceAnomalies.push({ 
        type: 'high_temperature', 
        severity: 'critical',
        value: d.temperature,
        threshold: config.maxTemp
      })
    }
    
    if (d.storage_usage > config.maxStorage) {
      deviceAnomalies.push({ 
        type: 'high_storage', 
        severity: 'warning',
        value: d.storage_usage,
        threshold: config.maxStorage
      })
    }
    
    if (d.delay > config.maxLatency) {
      deviceAnomalies.push({
        type: 'high_latency',
        severity: 'warning',
        value: d.delay,
        threshold: config.maxLatency
      })
    }
    
    if (d.memory_usage > config.maxMemory) {
      deviceAnomalies.push({ 
        type: 'high_memory', 
        severity: 'warning',
        value: d.memory_usage,
        threshold: config.maxMemory
      })
    }
    
    if (deviceAnomalies.length > 0) {
      anomalies.push({
        deviceId: d.id,
        deviceName: d.name,
        anomalies: deviceAnomalies
      })
    }
  })
  
  return anomalies
}

// 监听消息
self.onmessage = function(e) {
  const { type, payload } = e.data
  
  try {
    let result
    
    switch (type) {
      case 'calculateStats':
        result = calculateStats(payload.devices)
        break
        
      case 'filterDevices':
        result = filterDevices(payload.devices, payload.filters)
        break
        
      case 'sortDevices':
        result = sortDevices(payload.devices, payload.sortBy, payload.order)
        break
        
      case 'groupByStatus':
        result = groupByStatus(payload.devices)
        break
        
      case 'groupByField':
        result = groupByField(payload.devices, payload.field)
        break
        
      case 'processBatch':
        result = processBatchDevices(payload.devices, payload.operations)
        break
        
      case 'calculateHealthScore':
        result = calculateHealthScore(payload.devices)
        break
        
      case 'detectAnomalies':
        result = detectAnomalies(payload.devices, payload.thresholds)
        break
        
      default:
        throw new Error(`Unknown operation type: ${type}`)
    }
    
    self.postMessage({ 
      type, 
      result, 
      success: true,
      timestamp: Date.now()
    })
  } catch (error) {
    self.postMessage({ 
      type, 
      error: error.message, 
      success: false,
      timestamp: Date.now()
    })
  }
}
