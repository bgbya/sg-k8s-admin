<template>
  <div class="statefulsets-container">
    <div class="page-header">
      <div class="search-filters">
        <el-input
          v-model="searchQuery"
          placeholder="搜索StatefulSet名称"
          class="search-input"
          clearable
          @input="handleSearch"
          @clear="handleSearch"
        >
          <template #prefix>
            <el-icon><Search /></el-icon>
          </template>
        </el-input>
        <el-select 
          v-model="namespace" 
          placeholder="选择命名空间" 
          @change="handleNamespaceChange"
          filterable
          class="namespace-select"
        >
          <el-option
            v-for="ns in namespaces"
            :key="ns"
            :label="ns"
            :value="ns"
          />
        </el-select>
        <el-tooltip
          content="当开启自动刷新时，切换命名空间将自动加载数据；关闭后需手动刷新"
          placement="top"
        >
          <div class="refresh-switch">
            <span>自动刷新:</span>
            <el-switch
              v-model="autoRefreshOnNamespaceChange"
              class="refresh-toggle"
            />
          </div>
        </el-tooltip>
      </div>
      <div class="actions">
        <span class="last-update" v-if="lastUpdateTime">
          <el-icon><Clock /></el-icon>
          最后更新: {{ formatDateTime(lastUpdateTime) }}
        </span>
        <el-button type="primary" @click="refreshData" :loading="loading">
          <el-icon><Refresh /></el-icon>刷新
        </el-button>
      </div>
    </div>

    <div class="table-container">
      <el-table 
        :data="paginatedStatefulSets" 
        style="width: 100%"
        :max-height="tableHeight"
        v-loading="loading"
        highlight-current-row
        stripe
        border
      >
        <el-table-column prop="metadata.name" label="名称" min-width="180" show-overflow-tooltip />
        <el-table-column prop="metadata.namespace" label="命名空间" min-width="120" show-overflow-tooltip />
        <el-table-column label="副本状态" min-width="120">
          <template #default="{ row }">
            <div class="replica-status">
              <span class="replicas-text">
                {{ getReadyReplicas(row) }}/{{ getDesiredReplicas(row) }}
              </span>
              <el-progress 
                :percentage="getReplicaPercentage(row)" 
                :status="getReplicaStatus(row)"
                :stroke-width="15"
              />
            </div>
          </template>
        </el-table-column>
        <el-table-column label="镜像" min-width="200" show-overflow-tooltip>
          <template #default="{ row }">
            {{ getContainerImage(row) }}
          </template>
        </el-table-column>
        <el-table-column label="创建时间" min-width="150">
          <template #default="{ row }">
            {{ formatDateTime(row.metadata.creationTimestamp) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="240" fixed="right">
          <template #default="{ row }">
            <div class="action-buttons">
              <el-button type="primary" size="small" @click="showStatefulSetDetails(row)" plain>
                <el-icon><Document /></el-icon>详情
              </el-button>
              <el-button type="success" size="small" @click="scaleStatefulSet(row)" plain>
                <el-icon><Operation /></el-icon>伸缩
              </el-button>
              <el-button type="warning" size="small" @click="restartStatefulSet(row)" plain>
                <el-icon><Refresh /></el-icon>重启
              </el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination-container">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :page-sizes="[10, 20, 50, 100]"
          :total="filteredStatefulSets.length"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="handleSizeChange"
          @current-change="handleCurrentChange"
        />
      </div>
    </div>

    <!-- 伸缩对话框 -->
    <el-dialog
      v-model="scaleDialogVisible"
      title="伸缩StatefulSet"
      width="500px"
      destroy-on-close
    >
      <div class="scale-form">
        <el-form :model="scaleForm" label-width="140px">
          <el-form-item label="StatefulSet名称">
            <el-input v-model="scaleForm.name" disabled />
          </el-form-item>
          <el-form-item label="命名空间">
            <el-input v-model="scaleForm.namespace" disabled />
          </el-form-item>
          <el-form-item label="当前副本数">
            <el-input v-model="scaleForm.currentReplicas" disabled />
          </el-form-item>
          <el-form-item label="目标副本数">
            <el-input-number v-model="scaleForm.replicas" :min="0" :max="100" />
          </el-form-item>
        </el-form>
      </div>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="scaleDialogVisible = false">取消</el-button>
          <el-button type="primary" @click="confirmScale" :loading="scaling">确定</el-button>
        </span>
      </template>
    </el-dialog>

    <!-- 详情对话框 -->
    <el-dialog
      v-model="detailDialogVisible"
      title="StatefulSet详情"
      width="90%"
      :fullscreen="isMobile"
      destroy-on-close
    >
      <div v-if="selectedStatefulSet">
        <el-descriptions :column="isMobile ? 1 : 2" border>
          <el-descriptions-item label="名称">{{ selectedStatefulSet.metadata.name }}</el-descriptions-item>
          <el-descriptions-item label="命名空间">{{ selectedStatefulSet.metadata.namespace }}</el-descriptions-item>
          <el-descriptions-item label="副本数">{{ getDesiredReplicas(selectedStatefulSet) }}</el-descriptions-item>
          <el-descriptions-item label="就绪副本">{{ getReadyReplicas(selectedStatefulSet) }}</el-descriptions-item>
          <el-descriptions-item label="存储卷申领模板">{{ selectedStatefulSet.spec.volumeClaimTemplates?.length || 0 }}</el-descriptions-item>
          <el-descriptions-item label="创建时间">{{ formatDateTime(selectedStatefulSet.metadata.creationTimestamp) }}</el-descriptions-item>
        </el-descriptions>

        <el-divider>容器规格</el-divider>
        <el-table :data="getContainersSpec(selectedStatefulSet)" stripe border>
          <el-table-column prop="name" label="容器名称" min-width="150" />
          <el-table-column prop="image" label="镜像" min-width="250" show-overflow-tooltip />
          <el-table-column label="资源请求" min-width="150">
            <template #default="{ row }">
              <div v-if="row.resources && row.resources.requests">
                <div v-if="row.resources.requests.cpu">CPU: {{ row.resources.requests.cpu }}</div>
                <div v-if="row.resources.requests.memory">内存: {{ row.resources.requests.memory }}</div>
              </div>
              <span v-else>-</span>
            </template>
          </el-table-column>
          <el-table-column label="资源限制" min-width="150">
            <template #default="{ row }">
              <div v-if="row.resources && row.resources.limits">
                <div v-if="row.resources.limits.cpu">CPU: {{ row.resources.limits.cpu }}</div>
                <div v-if="row.resources.limits.memory">内存: {{ row.resources.limits.memory }}</div>
              </div>
              <span v-else>-</span>
            </template>
          </el-table-column>
        </el-table>

        <el-divider v-if="selectedStatefulSet.spec.volumeClaimTemplates?.length">PVC模板</el-divider>
        <el-table v-if="selectedStatefulSet.spec.volumeClaimTemplates?.length" :data="selectedStatefulSet.spec.volumeClaimTemplates" stripe border>
          <el-table-column prop="metadata.name" label="名称" min-width="150" />
          <el-table-column prop="spec.accessModes" label="访问模式" min-width="150">
            <template #default="{ row }">
              {{ row.spec.accessModes.join(', ') }}
            </template>
          </el-table-column>
          <el-table-column prop="spec.resources.requests.storage" label="存储大小" min-width="120" />
          <el-table-column prop="spec.storageClassName" label="存储类" min-width="150" />
        </el-table>

        <el-divider>标签</el-divider>
        <div class="labels-section">
          <el-tag
            v-for="(value, key) in selectedStatefulSet.metadata.labels"
            :key="key"
            class="label-tag"
          >
            {{ key }}: {{ value }}
          </el-tag>
          <div v-if="!selectedStatefulSet.metadata.labels || Object.keys(selectedStatefulSet.metadata.labels).length === 0" class="no-data">
            无标签
          </div>
        </div>
      </div>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="detailDialogVisible = false">关闭</el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, onUnmounted, watch, nextTick, defineComponent, onActivated } from 'vue'
import { Search, Refresh, Document, Operation, Clock } from '@element-plus/icons-vue'
import axios from 'axios'
import { ElMessage, ElMessageBox } from 'element-plus'
import { API_ENDPOINTS } from '@/config/api'

// 定义组件名称，供keep-alive使用
defineComponent({
  name: 'StatefulSetsView'
})

const statefulsets = ref([])
const searchQuery = ref('')
const namespace = ref('default')
const namespaces = ref(['default'])
const dialogVisible = ref(false)
const selectedStatefulSet = ref(null)
const loading = ref(false)
const isMobile = ref(window.innerWidth <= 768)
const tableHeight = ref('calc(100vh - 250px)')
const currentPage = ref(1)
const pageSize = ref(10)

// 数据是否已经加载过的标志
const dataLoaded = ref(false)

// 添加最后更新时间
const lastUpdateTime = ref(null)

// 是否在命名空间变更时自动刷新数据
const autoRefreshOnNamespaceChange = ref(true)

// 禁用选项卡切换导致的自动刷新
const disableTabSwitchRefresh = ref(true)

const filteredStatefulSets = computed(() => {
  return statefulsets.value.filter(statefulset => 
    statefulset.metadata.name.toLowerCase().includes(searchQuery.value.toLowerCase())
  )
})

const paginatedStatefulSets = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  const end = start + pageSize.value
  return filteredStatefulSets.value.slice(start, end)
})

// 监听过滤后的数据长度变化，确保当前页码有效
watch(filteredStatefulSets, (newFilteredStatefulSets) => {
  const maxPage = Math.ceil(newFilteredStatefulSets.length / pageSize.value)
  if (currentPage.value > maxPage) {
    currentPage.value = maxPage || 1
  }
}, { deep: true })

const getStatusType = (statefulset) => {
  if (!statefulset.status) return 'info'
  if (statefulset.status.availableReplicas === statefulset.spec.replicas) return 'success'
  if (statefulset.status.availableReplicas === 0) return 'danger'
  return 'warning'
}

const getStatusText = (statefulset) => {
  if (!statefulset.status) return 'Unknown'
  if (statefulset.status.availableReplicas === statefulset.spec.replicas) return 'Available'
  if (statefulset.status.availableReplicas === 0) return 'Unavailable'
  return 'Updating'
}

const filterNamespaces = (query) => {
  if (query) {
    namespaces.value = namespaces.value.filter(ns => 
      ns.toLowerCase().includes(query.toLowerCase())
    )
  }
}

const fetchStatefulSets = async () => {
  loading.value = true
  try {
    const response = await axios.get(`${API_ENDPOINTS.statefulsets}?namespace=${namespace.value}`)
    statefulsets.value = response.data.items
    currentPage.value = 1 // 重置到第一页
  } catch (error) {
    console.error('Error fetching statefulsets:', error)
    ElMessage.error('获取StatefulSet列表失败')
  } finally {
    loading.value = false
  }
}

const fetchNamespaces = async () => {
  try {
    const response = await axios.get(API_ENDPOINTS.namespaces)
    namespaces.value = response.data.items.map(ns => ns.metadata.name)
  } catch (error) {
    console.error('Error fetching namespaces:', error)
    ElMessage.error('获取命名空间列表失败')
  }
}

// 显示StatefulSet详情
const showStatefulSetDetails = (row) => {
  selectedStatefulSet.value = row
  dialogVisible.value = true
}

const handleSearch = () => {
  currentPage.value = 1 // 搜索时重置到第一页
}

const handleSizeChange = (val) => {
  pageSize.value = val
  // 计算新的最大页码
  const maxPage = Math.ceil(filteredStatefulSets.value.length / val)
  // 如果当前页码超出范围，则设置为最大页码
  if (currentPage.value > maxPage) {
    currentPage.value = maxPage || 1
  }
}

const handleCurrentChange = (val) => {
  currentPage.value = val
}

const handleResize = () => {
  isMobile.value = window.innerWidth <= 768
  // 计算表格高度，减去头部、搜索框、分页组件和边距的高度
  tableHeight.value = window.innerHeight - 280
}

// 处理命名空间变更
const handleNamespaceChange = () => {
  // 只有在开启自动刷新或首次加载时才请求数据
  if (autoRefreshOnNamespaceChange.value || !dataLoaded.value) {
    fetchStatefulSets()
  } else {
    // 不刷新数据，仅显示提示
    ElMessage.info('命名空间已切换，但数据未刷新。点击刷新按钮获取最新数据。')
  }
}

// 刷新数据并更新时间戳
const refreshData = () => {
  fetchStatefulSets()
  lastUpdateTime.value = new Date()
}

// 格式化创建时间
const formatDateTime = (timestamp) => {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  return date.toLocaleString('zh-CN', { 
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  })
}

// 获取副本数相关函数
const getReadyReplicas = (row) => {
  return row.status?.readyReplicas || 0
}

const getDesiredReplicas = (row) => {
  return row.spec?.replicas || 0
}

const getReplicaPercentage = (row) => {
  const ready = getReadyReplicas(row)
  const desired = getDesiredReplicas(row)
  return desired === 0 ? 100 : Math.round((ready / desired) * 100)
}

const getReplicaStatus = (row) => {
  const percentage = getReplicaPercentage(row)
  if (percentage < 50) return 'exception'
  if (percentage < 100) return 'warning'
  return 'success'
}

// 获取容器镜像
const getContainerImage = (row) => {
  if (!row.spec?.template?.spec?.containers || row.spec.template.spec.containers.length === 0) {
    return '未定义'
  }
  return row.spec.template.spec.containers[0].image
}

// 获取容器规格
const getContainersSpec = (statefulset) => {
  if (!statefulset.spec?.template?.spec?.containers) {
    return []
  }
  return statefulset.spec.template.spec.containers
}

// 伸缩StatefulSet
const scaleStatefulSet = (row) => {
  scaleForm.value = {
    name: row.metadata.name,
    namespace: row.metadata.namespace,
    currentReplicas: row.spec.replicas,
    replicas: row.spec.replicas
  }
  dialogVisible.value = true
}

// 确认伸缩操作
const confirmScale = async () => {
  if (scaleForm.value.replicas === scaleForm.value.currentReplicas) {
    dialogVisible.value = false
    return
  }

  try {
    scaling.value = true
    await axios.patch(
      `${API_ENDPOINTS.statefulsets}/${scaleForm.value.namespace}/${scaleForm.value.name}/scale`,
      { replicas: scaleForm.value.replicas }
    )
    ElMessage.success(`StatefulSet ${scaleForm.value.name} 已成功伸缩到 ${scaleForm.value.replicas} 个副本`)
    dialogVisible.value = false
    refreshData()
  } catch (error) {
    ElMessage.error(`伸缩操作失败: ${error.response?.data?.message || error.message}`)
  } finally {
    scaling.value = false
  }
}

// 重启StatefulSet
const restartStatefulSet = async (row) => {
  try {
    await ElMessageBox.confirm(
      `确定要重启 StatefulSet "${row.metadata.name}" 吗？这将导致所有Pod被重建。`,
      '确认重启',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    
    const loadingInstance = ElMessage({
      message: `正在重启 StatefulSet "${row.metadata.name}"...`,
      type: 'info',
      duration: 0
    })
    
    try {
      // 通过添加重启注解来重启StatefulSet
      await axios.patch(
        `${API_ENDPOINTS.statefulsets}/${row.metadata.namespace}/${row.metadata.name}/restart`,
        {}
      )
      loadingInstance.close()
      ElMessage.success(`已成功发送重启命令到 StatefulSet "${row.metadata.name}"`)
      setTimeout(() => refreshData(), 2000) // 稍后刷新以查看更新状态
    } catch (error) {
      loadingInstance.close()
      ElMessage.error(`重启操作失败: ${error.response?.data?.message || error.message}`)
    }
  } catch {
    // 用户取消操作
  }
}

// 检测屏幕尺寸变化
const checkScreenSize = () => {
  isMobile.value = window.innerWidth < 768
}

onMounted(() => {
  // 首次加载时获取数据
  if (!dataLoaded.value) {
    fetchNamespaces()
    fetchStatefulSets()
    dataLoaded.value = true
    lastUpdateTime.value = new Date()
  }
  window.addEventListener('resize', handleResize)
  checkScreenSize()
  window.addEventListener('resize', checkScreenSize)
})

// 组件被keep-alive激活时触发
onActivated(() => {
  // 只调整UI相关，不触发数据请求
  handleResize()
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  window.removeEventListener('resize', checkScreenSize)
})
</script>

<style scoped>
.statefulsets-container {
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 20px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  flex-wrap: wrap;
  gap: 16px;
}

.search-filters {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  align-items: center;
}

.search-input {
  width: 300px;
}

.namespace-select {
  width: 180px;
}

.refresh-switch {
  display: flex;
  align-items: center;
  gap: 8px;
  white-space: nowrap;
  font-size: 14px;
}

.refresh-toggle {
  margin-left: 5px;
}

.actions {
  display: flex;
  align-items: center;
  gap: 16px;
}

.last-update {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 13px;
  color: #909399;
}

.table-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.replica-status {
  display: flex;
  flex-direction: column;
  width: 100%;
}

.replicas-text {
  font-size: 14px;
  margin-bottom: 5px;
  font-weight: 500;
}

.action-buttons {
  display: flex;
  gap: 5px;
  flex-wrap: wrap;
  justify-content: center;
}

.pagination-container {
  margin-top: 16px;
  padding: 8px 0;
  display: flex;
  justify-content: flex-end;
  position: relative;
  z-index: 1;
}

.labels-section {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
}

.label-tag {
  margin-right: 5px;
}

.no-data {
  color: #909399;
  font-style: italic;
}

.scale-form {
  padding: 10px 0;
}

@media screen and (max-width: 768px) {
  .statefulsets-container {
    padding: 10px;
  }
  
  .page-header {
    flex-direction: column;
    align-items: stretch;
  }
  
  .search-filters {
    flex-direction: column;
    width: 100%;
  }
  
  .search-input, .namespace-select {
    width: 100%;
  }
  
  .actions {
    width: 100%;
    justify-content: space-between;
  }
  
  .action-buttons {
    flex-direction: column;
    width: 100%;
  }
}
</style> 