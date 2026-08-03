<template>
  <div class="downloads-page">
    <div class="card header-card">
      <div class="header-row">
        <div class="header-info">
          <h2>📥 记录下载</h2>
          <p class="subtitle">
            自动记录自定义分组的变化（名称 / 设备成员 / 设备坐标），每日 0 点检测并打包「设备位置 CSV + 地图截图」。
            文件保留 1 年。
          </p>
        </div>
        <div class="header-actions">
          <button @click="loadList" class="btn btn-secondary" :disabled="loading">
            {{ loading ? '刷新中...' : '🔄 刷新' }}
          </button>
          <button
            v-if="authStore.isSuperAdmin"
            @click="confirmTriggerCheck"
            class="btn btn-primary"
            :disabled="triggering"
          >
            {{ triggering ? '触发中...' : '⚡ 手动检测' }}
          </button>
        </div>
      </div>
    </div>

    <div class="card table-card">
      <div v-if="loading" class="loading-state">
        <Skeleton type="table" />
      </div>

      <div v-else-if="records.length === 0" class="empty-state">
        <div class="empty-icon">📂</div>
        <p class="empty-title">暂无记录</p>
        <p class="empty-desc">
          当自定义分组发生名称、设备成员或设备坐标变化时，系统会在每日 0 点自动生成记录。
          <template v-if="authStore.isSuperAdmin">
            <br />如需立即生成，可点击右上角「手动检测」。
          </template>
        </p>
      </div>

      <div v-else class="table-wrapper">
        <table class="records-table">
          <thead>
            <tr>
              <th class="col-date">日期</th>
              <th class="col-group">分组</th>
              <th class="col-change">变化摘要</th>
              <th class="col-count">设备数</th>
              <th class="col-size">文件大小</th>
              <th class="col-map">截图</th>
              <th class="col-actions">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in records" :key="r.id">
              <td class="col-date">{{ formatDate(r.snapshot_date) }}</td>
              <td class="col-group">
                <span class="group-name">{{ r.group_name }}</span>
              </td>
              <td class="col-change">
                <span class="change-tag" :class="changeClass(r.change_summary)">
                  {{ r.change_summary }}
                </span>
              </td>
              <td class="col-count">{{ r.device_count }}</td>
              <td class="col-size">{{ formatFileSize(r.file_size) }}</td>
              <td class="col-map">
                <span class="map-badge" :class="mapStatusClass(r.map_status)" :title="mapStatusTitle(r.map_status)">
                  {{ mapStatusText(r.map_status) }}
                </span>
              </td>
              <td class="col-actions">
                <button
                  @click="downloadRecord(r)"
                  class="btn btn-sm btn-primary"
                  :disabled="downloadingId === r.id"
                >
                  {{ downloadingId === r.id ? '下载中...' : '⬇️ 下载' }}
                </button>
                <button
                  v-if="authStore.isSuperAdmin"
                  @click="confirmDelete(r)"
                  class="btn btn-sm btn-danger"
                >
                  🗑️ 删除
                </button>
              </td>
            </tr>
          </tbody>
        </table>

        <div class="pagination" v-if="total > pageSize">
          <button
            class="btn btn-sm"
            :disabled="page === 1"
            @click="changePage(page - 1)"
          >上一页</button>
          <span class="page-info">第 {{ page }} / {{ totalPages }} 页（共 {{ total }} 条）</span>
          <button
            class="btn btn-sm"
            :disabled="page >= totalPages"
            @click="changePage(page + 1)"
          >下一页</button>
        </div>
      </div>
    </div>

    <!-- 删除确认弹窗 -->
    <div v-if="deletingRecord" class="modal-overlay" @click="deletingRecord = null">
      <div class="modal" @click.stop>
        <div class="modal-header">
          <h2>⚠️ 确认删除</h2>
          <button class="btn-icon" @click="deletingRecord = null">✕</button>
        </div>
        <div class="modal-body">
          <p>确定要删除记录 <strong>{{ deletingRecord.group_name }}</strong>（{{ formatDate(deletingRecord.snapshot_date) }}）吗？</p>
          <p class="modal-warn">删除后文件将无法恢复。</p>
        </div>
        <div class="modal-footer">
          <button class="btn" @click="deletingRecord = null">取消</button>
          <button class="btn btn-danger" @click="doDelete">确认删除</button>
        </div>
      </div>
    </div>

    <!-- 手动检测确认弹窗 -->
    <div v-if="showCheckModal" class="modal-overlay" @click="showCheckModal = false">
      <div class="modal" @click.stop>
        <div class="modal-header">
          <h2>⚡ 手动触发检测</h2>
          <button class="btn-icon" @click="showCheckModal = false">✕</button>
        </div>
        <div class="modal-body">
          <p>将立即对所有自定义分组执行一次变化检测，对发生变化的分组生成记录。</p>
          <div class="form-group">
            <label>检测日期（可选，留空=今天）</label>
            <input v-model="checkDate" type="date" class="input-field" />
          </div>
          <label class="checkbox-row">
            <input v-model="checkForceAll" type="checkbox" />
            <span>强制全部导出（忽略是否变化）</span>
          </label>
          <p class="modal-warn">检测为后台异步执行，触发后请稍后刷新列表查看结果。</p>
        </div>
        <div class="modal-footer">
          <button class="btn" @click="showCheckModal = false">取消</button>
          <button class="btn btn-primary" @click="doTriggerCheck">触发检测</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { downloadApi } from '../api'
import { useAuthStore } from '../stores/auth'
import { saveBlobAsFile, formatFileSize } from '../utils/download'
import Skeleton from '../components/Skeleton.vue'

const authStore = useAuthStore()

const records = ref([])
const loading = ref(false)
const total = ref(0)
const page = ref(1)
const pageSize = 20
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize)))

const downloadingId = ref(null)
const deletingRecord = ref(null)
const deleting = ref(false)

const triggering = ref(false)
const showCheckModal = ref(false)
const checkDate = ref('')
const checkForceAll = ref(false)

async function loadList() {
  loading.value = true
  try {
    const resp = await downloadApi.getList({
      limit: pageSize,
      offset: (page.value - 1) * pageSize
    })
    records.value = resp.data?.data || []
    total.value = resp.data?.meta?.total || 0
  } catch (e) {
    // 错误提示已由 axios 拦截器统一处理
  } finally {
    loading.value = false
  }
}

function changePage(p) {
  if (p < 1 || p > totalPages.value) return
  page.value = p
  loadList()
}

async function downloadRecord(r) {
  downloadingId.value = r.id
  try {
    const { blob, fileName } = await downloadApi.downloadBlob(r.id)
    saveBlobAsFile(blob, fileName)
    if (window.toast) window.toast.success('下载已开始')
  } catch (e) {
    if (window.toast) window.toast.error('下载失败')
  } finally {
    downloadingId.value = null
  }
}

function confirmDelete(r) {
  deletingRecord.value = r
}

async function doDelete() {
  if (!deletingRecord.value) return
  deleting.value = true
  try {
    await downloadApi.delete(deletingRecord.value.id)
    if (window.toast) window.toast.success('记录已删除')
    deletingRecord.value = null
    // 处理删除后当前页可能越界
    if (records.value.length === 1 && page.value > 1) {
      page.value--
    }
    await loadList()
  } catch (e) {
    if (window.toast) window.toast.error('删除失败')
  } finally {
    deleting.value = false
  }
}

function confirmTriggerCheck() {
  checkDate.value = ''
  checkForceAll.value = false
  showCheckModal.value = true
}

async function doTriggerCheck() {
  triggering.value = true
  try {
    await downloadApi.triggerCheck({
      date: checkDate.value || undefined,
      forceAll: checkForceAll.value
    })
    if (window.toast) window.toast.success('检测已触发，请稍后刷新查看')
    showCheckModal.value = false
    // 给后台一点时间处理后自动刷新一次
    setTimeout(() => loadList(), 3000)
  } catch (e) {
    if (window.toast) window.toast.error('触发失败')
  } finally {
    triggering.value = false
  }
}

function formatDate(d) {
  if (!d) return '-'
  // snapshot_date 为 YYYY-MM-DD
  return String(d).slice(0, 10)
}

function changeClass(summary) {
  if (!summary) return ''
  if (summary.includes('首次')) return 'change-first'
  if (summary.includes('坐标')) return 'change-coord'
  if (summary.includes('成员') || summary.includes('设备')) return 'change-member'
  if (summary.includes('名称')) return 'change-name'
  return ''
}

function mapStatusClass(status) {
  return {
    ok: 'map-ok',
    fallback: 'map-fallback',
    none: 'map-none'
  }[status] || 'map-ok'
}

function mapStatusText(status) {
  return { ok: '地形图', fallback: '示意图', none: '无坐标' }[status] || status
}

function mapStatusTitle(status) {
  return {
    ok: '含真实地形底图',
    fallback: '瓦片获取失败，已降级为网格示意图',
    none: '该分组无有效坐标设备'
  }[status] || status
}

onMounted(() => {
  loadList()
})
</script>

<style scoped>
.downloads-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.card {
  background: #fff;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.header-card {
  padding: 18px 24px;
}

.header-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.header-info h2 {
  margin: 0 0 6px 0;
  font-size: 20px;
}

.subtitle {
  margin: 0;
  color: #666;
  font-size: 13px;
  line-height: 1.6;
  max-width: 640px;
}

.header-actions {
  display: flex;
  gap: 10px;
  flex-shrink: 0;
}

.btn {
  padding: 8px 16px;
  border: 1px solid #d0d5dd;
  background: #fff;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
  color: #333;
}

.btn:hover:not(:disabled) {
  border-color: #5a6fd8;
  color: #5a6fd8;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
  border: none;
}

.btn-primary:hover:not(:disabled) {
  opacity: 0.92;
  color: #fff;
}

.btn-secondary {
  background: #f0f2f8;
  border-color: #d0d5dd;
}

.btn-danger {
  background: #fee;
  border-color: #fcc;
  color: #d32f2f;
}

.btn-danger:hover:not(:disabled) {
  background: #fdd;
  border-color: #f99;
  color: #b71c1c;
}

.btn-sm {
  padding: 5px 10px;
  font-size: 12px;
}

.loading-state,
.empty-state {
  padding: 40px 20px;
  text-align: center;
  color: #888;
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 12px;
}

.empty-title {
  font-size: 16px;
  margin: 0 0 6px 0;
  color: #555;
}

.empty-desc {
  font-size: 13px;
  color: #999;
  line-height: 1.7;
  margin: 0 auto;
  max-width: 420px;
}

.table-wrapper {
  overflow-x: auto;
}

.records-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

.records-table th {
  text-align: left;
  padding: 12px 14px;
  background: #f7f8fc;
  color: #555;
  font-weight: 600;
  font-size: 13px;
  border-bottom: 1px solid #eee;
  white-space: nowrap;
}

.records-table td {
  padding: 12px 14px;
  border-bottom: 1px solid #f0f0f0;
  color: #333;
  vertical-align: middle;
}

.records-table tbody tr:hover {
  background: #fafbff;
}

.col-date,
.col-count,
.col-size {
  white-space: nowrap;
}

.group-name {
  font-weight: 500;
}

.change-tag {
  display: inline-block;
  padding: 2px 10px;
  border-radius: 12px;
  font-size: 12px;
  background: #eef2f8;
  color: #555;
}

.change-name {
  background: #fff4e5;
  color: #b06a00;
}

.change-member {
  background: #e5f0ff;
  color: #1a6fd6;
}

.change-coord {
  background: #ffe5e5;
  color: #c62828;
}

.change-first {
  background: #e8f5e9;
  color: #2e7d32;
}

.map-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 12px;
}

.map-ok {
  background: #e8f5e9;
  color: #2e7d32;
}

.map-fallback {
  background: #fff4e5;
  color: #b06a00;
}

.map-none {
  background: #f0f0f0;
  color: #888;
}

.col-actions {
  white-space: nowrap;
}

.col-actions .btn + .btn {
  margin-left: 6px;
}

.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 16px 0 4px 0;
}

.page-info {
  font-size: 13px;
  color: #666;
}

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal {
  background: #fff;
  border-radius: 12px;
  width: 90%;
  max-width: 440px;
  max-height: 85vh;
  overflow-y: auto;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid #eee;
}

.modal-header h2 {
  margin: 0;
  font-size: 17px;
}

.btn-icon {
  background: none;
  border: none;
  font-size: 18px;
  cursor: pointer;
  color: #888;
  padding: 4px 8px;
  border-radius: 6px;
}

.btn-icon:hover {
  background: #f0f0f0;
}

.modal-body {
  padding: 20px;
}

.modal-body p {
  margin: 0 0 8px 0;
  color: #444;
  line-height: 1.6;
}

.modal-warn {
  color: #d32f2f !important;
  font-size: 13px;
}

.form-group {
  margin-bottom: 14px;
}

.form-group label {
  display: block;
  margin-bottom: 6px;
  font-size: 13px;
  color: #555;
}

.input-field {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #d0d5dd;
  border-radius: 8px;
  font-size: 14px;
  box-sizing: border-box;
}

.checkbox-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #555;
  margin-bottom: 8px;
  cursor: pointer;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 12px 20px;
  border-top: 1px solid #eee;
}

@media (max-width: 768px) {
  .header-row {
    flex-direction: column;
  }
  .header-actions {
    width: 100%;
  }
  .header-actions .btn {
    flex: 1;
  }
  .records-table {
    font-size: 12px;
  }
  .records-table th,
  .records-table td {
    padding: 8px;
  }
}
</style>
