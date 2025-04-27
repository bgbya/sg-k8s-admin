<template>
  <div class="pods-container">
    <div class="page-header">
      <div class="search-filters">
        <el-input
          v-model="searchQuery"
          placeholder="搜索Pod名称"
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
          @visible-change="handleDropdownVisible"
          filterable
          :filter-method="filterNamespaces"
          clearable
          class="namespace-select"
          popper-class="ns-select-dropdown"
          :teleported="true"
        >
          <el-option
            v-for="ns in filteredNamespaces"
            :key="ns"
            :label="ns"
            :value="ns"
          />
        </el-select>
        <el-select
          v-model="statusFilter"
          placeholder="筛选状态"
          @change="handleStatusFilterChange"
          clearable
          class="status-select"
          popper-class="ns-select-dropdown"
          :teleported="true"
        >
          <el-option
            v-for="status in podStatuses"
            :key="status"
            :label="status"
            :value="status"
          />
        </el-select>
      </div>
      <div class="actions">
        <span class="last-update" v-if="lastUpdateTime">
          <el-icon><Clock /></el-icon>
          最后更新: {{ formatUpdateTime(lastUpdateTime) }}
        </span>
        <el-button type="primary" @click="refreshData" :loading="loading">
          <el-icon><Refresh /></el-icon>刷新
        </el-button>
      </div>
    </div>

    <div class="table-container">
      <el-table 
        :data="paginatedPods" 
        style="width: 100%"
        :max-height="tableHeight"
        v-loading="loading"
        :highlight-current-row="true"
        stripe
        border
      >
        <el-table-column prop="metadata.name" label="名称" min-width="180" show-overflow-tooltip />
        <el-table-column prop="metadata.namespace" label="命名空间" min-width="120" show-overflow-tooltip />
        <el-table-column label="状态" min-width="100">
          <template #default="{ row }">
            <el-tag :type="getStatusType(getPodStatusText(row))" effect="light">
              {{ getPodStatusText(row) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="IP地址" min-width="120" prop="status.podIP" />
        <el-table-column label="节点" min-width="150" prop="spec.nodeName" show-overflow-tooltip />
        <el-table-column label="创建时间" min-width="150">
          <template #default="{ row }">
            {{ formatDateTime(row.metadata.creationTimestamp) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="180" fixed="right">
          <template #default="{ row }">
            <div class="action-buttons">
              <el-button type="primary" size="small" @click="showPodDetails(row)" plain>
                <el-icon><Document /></el-icon>详情
              </el-button>
              <el-popover
                placement="bottom-start"
                :width="140"
                trigger="click"
                :persistent="false"
                popper-class="action-popover"
              >
                <template #reference>
                  <el-button size="small" type="info" plain>
                    更多<el-icon class="el-icon--right"><ArrowDown /></el-icon>
                  </el-button>
                </template>
                <div class="popover-content" style="height: auto; overflow-y: auto; padding: 0;">
                  <div class="popover-item" @click="openTerminal(row)">
                    <el-icon><VideoCamera /></el-icon>
                    <span>进入终端</span>
                  </div>
                  <div class="popover-item" @click="showPodLogs(row)">
                    <el-icon><Reading /></el-icon>
                    <span>查看日志</span>
                  </div>
                  <div class="popover-item" @click="restartPod(row)">
                    <el-icon><Refresh /></el-icon>
                    <span>重启Pod</span>
                  </div>
                </div>
              </el-popover>
            </div>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination-container">
        <div class="pagination-info">Total {{ filteredPods.length }}</div>
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :page-sizes="[10, 20, 50, 100]"
          :total="filteredPods.length"
          layout="sizes, prev, pager, next, jumper"
          @size-change="handleSizeChange"
          @current-change="handleCurrentChange"
          background
          class="custom-pagination"
          popper-class="pagination-dropdown"
          small
        />
      </div>
    </div>

    <!-- Pod详情对话框 -->
    <el-dialog
      v-model="dialogVisible"
      title="Pod详情"
      width="90%"
      :fullscreen="isMobile"
      destroy-on-close
    >
      <el-descriptions :column="isMobile ? 1 : 2" border>
        <el-descriptions-item label="名称">{{ selectedPod?.metadata?.name }}</el-descriptions-item>
        <el-descriptions-item label="命名空间">{{ selectedPod?.metadata?.namespace }}</el-descriptions-item>
        <el-descriptions-item label="节点">{{ selectedPod?.spec?.nodeName }}</el-descriptions-item>
        <el-descriptions-item label="Pod IP">{{ selectedPod?.status?.podIP || '暂无' }}</el-descriptions-item>
        <el-descriptions-item label="主机IP">{{ selectedPod?.status?.hostIP || '暂无' }}</el-descriptions-item>
        <el-descriptions-item label="QoS">{{ selectedPod?.status?.qosClass || '暂无' }}</el-descriptions-item>
        <el-descriptions-item label="创建时间">{{ formatDateTime(selectedPod?.metadata?.creationTimestamp) }}</el-descriptions-item>
        <el-descriptions-item label="状态">{{ getPodStatusText(selectedPod) }}</el-descriptions-item>
      </el-descriptions>

      <el-divider>容器列表</el-divider>
      <el-table :data="selectedPod?.spec?.containers || []" stripe border>
        <el-table-column prop="name" label="容器名称" />
        <el-table-column prop="image" label="镜像" show-overflow-tooltip />
        <el-table-column label="状态" width="120">
          <template #default="{ row }">
            {{ getContainerStatus(row.name) }}
          </template>
        </el-table-column>
      </el-table>

      <el-divider>事件列表</el-divider>
      <el-table 
        :data="sortedPodEvents" 
        stripe 
        border
        v-loading="eventsLoading"
        empty-text="暂无事件"
      >
        <el-table-column label="类型" width="80">
          <template #default="{ row }">
            <el-tag 
              :type="row.type === 'Normal' ? 'success' : 'warning'" 
              size="small"
            >
              {{ row.type }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="reason" label="原因" min-width="120" />
        <el-table-column prop="message" label="消息" min-width="250" show-overflow-tooltip />
        <el-table-column label="来源" min-width="150" show-overflow-tooltip>
          <template #default="{ row }">
            {{ row.source?.component || '' }}{{ row.source?.host ? ' on ' + row.source.host : '' }}
          </template>
        </el-table-column>
        <el-table-column label="计数" width="80" prop="count" />
        <el-table-column label="最近出现时间" min-width="150">
          <template #default="{ row }">
            {{ formatDateTime(row.lastTimestamp || row.eventTime) }}
          </template>
        </el-table-column>
      </el-table>

      <template #footer>
        <span class="dialog-footer">
          <el-button @click="dialogVisible = false">关闭</el-button>
        </span>
      </template>
    </el-dialog>

    <!-- Pod日志对话框 -->
    <el-dialog
      v-model="logsDialogVisible"
      title="Pod日志"
      width="90%"
      :fullscreen="isMobile"
      destroy-on-close
      class="logs-dialog"
      :top="'50px'"
    >
      <div class="logs-container">
        <div class="logs-header">
          <el-select 
            v-model="selectedContainer" 
            placeholder="选择容器" 
            class="container-select"
            popper-class="ns-select-dropdown"
            :teleported="true"
            clearable
          >
            <el-option
              v-for="container in podContainers"
              :key="container"
              :label="container"
              :value="container"
            />
          </el-select>
          
          <el-input-number
            v-model="tailLines"
            :min="10"
            :max="5000"
            :step="100"
            controls-position="right"
            class="tail-lines-input"
          />
          
          <div class="logs-control-group">
            <el-switch
              v-model="wrapLines"
              active-text="自动换行"
              @change="toggleLineWrap"
              class="wrap-switch"
            />
            
            <el-switch
              v-model="followLogs"
              active-text="实时日志"
              @change="handleFollowChange"
              class="follow-switch"
            />
          </div>
          
          <el-button type="primary" @click="fetchPodLogs" :loading="logsLoading">
            <el-icon><Refresh /></el-icon>刷新
          </el-button>
        </div>
        
        <div class="logs-content">
          <el-scrollbar ref="logsContent" :height="logContentHeight">
            <div class="logs-wrapper">
              <pre v-if="podLogs" class="logs-text" :class="{ 'wrap-lines': wrapLines }">{{ podLogs }}</pre>
              <div v-else class="logs-empty">{{ logsLoading ? '正在加载日志...' : '无日志数据' }}</div>
              <div class="logs-end-space"></div>
            </div>
          </el-scrollbar>
        </div>
      </div>
      
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="logsDialogVisible = false">关闭</el-button>
          <el-button type="primary" @click="copyLogsToClipboard">
            <el-icon><CopyDocument /></el-icon>复制日志
          </el-button>
          <el-button type="success" @click="downloadLogs">
            <el-icon><Download /></el-icon>下载日志
          </el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, onUnmounted, watch, nextTick, defineComponent, onActivated } from 'vue'
import { Search, Refresh, Document, VideoCamera, Clock, Reading, CopyDocument, Download, ArrowDown } from '@element-plus/icons-vue'
import axios from 'axios'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useRouter } from 'vue-router'
import { API_ENDPOINTS } from '@/config/api'

// 定义组件名称，供keep-alive使用
defineComponent({
  name: 'PodsView'
})

const pods = ref([])
const searchQuery = ref('')
const namespace = ref('ALL')
const namespaces = ref(['ALL', 'default'])
const filteredNamespaces = ref(['ALL', 'default'])
const dialogVisible = ref(false)
const selectedPod = ref(null)
const loading = ref(false)
const eventsLoading = ref(false)
const podEvents = ref([])
const isMobile = ref(window.innerWidth <= 768)
const tableHeight = ref(window.innerHeight - 280)
const currentPage = ref(1)
const pageSize = ref(10)
const total = ref(0)

// 日志相关
const logsDialogVisible = ref(false)
const logsLoading = ref(false)
const podLogs = ref('')
const selectedContainer = ref('')
const podContainers = ref([])
const tailLines = ref(100)
const followLogs = ref(false)
const logsContent = ref(null)
let logsInterval = null

// 容器进入相关
const containerSelectVisible = ref(false)
const selectedContainerForExec = ref('')

// 数据是否已经加载过的标志
const dataLoaded = ref(false)

// 添加最后更新时间
const lastUpdateTime = ref(null)

// 禁用选项卡切换导致的自动刷新
const disableTabSwitchRefresh = ref(true)

const statusFilter = ref('')
const podStatuses = ref(['Running', 'Pending', 'Succeeded', 'Failed', 'Unknown', 'Terminating'])

// 控制日志自动换行
const wrapLines = ref(true)

const filteredPods = computed(() => {
  return pods.value.filter(pod => {
    // 名称筛选
    const nameMatch = pod.metadata.name.toLowerCase().includes(searchQuery.value.toLowerCase());
    
    // 状态筛选
    let statusMatch = true;
    if (statusFilter.value) {
      const podStatus = getPodStatusText(pod);
      
      // 处理特殊情况 - "Running (Not Ready)" 状态也算作 "Running"
      if (statusFilter.value === 'Running' && podStatus.startsWith('Running')) {
        statusMatch = true;
      } else if (statusFilter.value === 'Not Ready' && podStatus.includes('Not Ready')) {
        statusMatch = true;
      } else {
        statusMatch = podStatus === statusFilter.value;
      }
    }
    
    return nameMatch && statusMatch;
  });
})

const paginatedPods = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  const end = start + pageSize.value
  return filteredPods.value.slice(start, end)
})

// 监听过滤后的数据长度变化，确保当前页码有效
watch(filteredPods, (newFilteredPods) => {
  const maxPage = Math.ceil(newFilteredPods.length / pageSize.value)
  if (currentPage.value > maxPage) {
    currentPage.value = maxPage || 1
  }
}, { deep: true })

// 添加计算属性对事件进行倒序排序
const sortedPodEvents = computed(() => {
  return [...podEvents.value].sort((a, b) => {
    return new Date(b.eventTime) - new Date(a.eventTime)
  })
})

const getStatusType = (status) => {
  const statusMap = {
    'Running': 'success',
    'Pending': 'warning',
    'Failed': 'danger',
    'Succeeded': 'success',
    'Unknown': 'danger',
    'Terminating': 'danger'
  }
  
  // 处理特殊情况
  if (status.includes('Not Ready')) {
    return 'warning';
  }
  
  return statusMap[status] || 'info';
}

// 添加获取Pod状态文本的函数
const getPodStatusText = (pod) => {
  if (!pod || !pod.status) return 'Unknown'
  
  // 检查Pod是否处于终止状态
  if (pod.metadata?.deletionTimestamp) {
    return 'Terminating'
  }
  
  const containerStatuses = pod.status.containerStatuses || []
  const phase = pod.status.phase || 'Unknown'
  
  // 检查容器状态
  if (phase === 'Running') {
    // 检查所有容器是否就绪
    const allReady = containerStatuses.every(status => status.ready)
    if (!allReady) {
      return 'Running (Not Ready)'
    }
  }
  
  return phase
}

// 获取容器状态
const getContainerStatus = (containerName) => {
  if (!selectedPod.value || !selectedPod.value.status) return 'Unknown'
  
  const containerStatuses = selectedPod.value.status.containerStatuses || []
  const status = containerStatuses.find(s => s.name === containerName)
  
  if (!status) return 'Unknown'
  
  if (status.state?.running) return 'Running'
  if (status.state?.waiting) return `Waiting: ${status.state.waiting.reason || 'Unknown'}`
  if (status.state?.terminated) return `Terminated: ${status.state.terminated.reason || 'Unknown'}`
  
  return status.ready ? 'Ready' : 'Not Ready'
}

const filterNamespaces = (query) => {
  if (!query) {
    filteredNamespaces.value = [...namespaces.value];
    return;
  }
  
  const lowerQuery = query.toLowerCase();
  filteredNamespaces.value = namespaces.value.filter(ns => {
    if (!ns) return false;
    return ns.toLowerCase().includes(lowerQuery);
  });
}

const fetchPods = async () => {
  loading.value = true
  try {
    const response = await axios.get(API_ENDPOINTS.pods, {
      params: {
        namespace: namespace.value,
        page: currentPage.value,
        pageSize: pageSize.value,
        search: searchQuery.value
      }
    })
    pods.value = response.data.items || []
    total.value = response.data.total || 0
    
    // 在获取数据后刷新状态列表
    refreshPodStatuses();
  } catch (error) {
    console.error('Error fetching pods:', error)
    ElMessage.error('获取Pod列表失败')
    pods.value = []
    total.value = 0
  } finally {
    loading.value = false
  }
}

const fetchNamespaces = async () => {
  try {
    const response = await axios.get(API_ENDPOINTS.namespaces)
      namespaces.value = ['ALL', ...response.data.items.map(ns => ns.metadata.name)]
      filteredNamespaces.value = namespaces.value
  } catch (error) {
    console.error('Error fetching namespaces:', error)
    ElMessage.error('获取命名空间列表失败')
  }
}

const showPodDetails = async (pod) => {
  selectedPod.value = pod
  dialogVisible.value = true
  // 直接加载事件数据
  await fetchPodEvents(pod)
}

const fetchPodEvents = async (pod) => {
  if (!pod) return
  
  eventsLoading.value = true
  try {
    const response = await axios.get(`${API_ENDPOINTS.pods}/${pod.metadata.name}/events?namespace=${pod.metadata.namespace}`)
    console.log('Pod events response:', response.data) // 添加日志
    podEvents.value = response.data.items || []
  } catch (error) {
    console.error('Error fetching pod events:', error)
    ElMessage.error('获取Pod事件失败')
    podEvents.value = [] // 确保在出错时重置为空数组
  } finally {
    eventsLoading.value = false
  }
}

const showPodLogs = async (pod) => {
  selectedPod.value = pod
  logsDialogVisible.value = true
  
  // 获取容器列表
  podContainers.value = pod.spec.containers.map(c => c.name)
  
  // 如果有容器，选择第一个
  if (podContainers.value.length > 0) {
    selectedContainer.value = podContainers.value[0]
    await fetchPodLogs()
  } else {
    ElMessage.warning('该Pod没有可用的容器')
    podLogs.value = ''
  }
}

const fetchPodLogs = async () => {
  if (!selectedPod.value || !selectedContainer.value) return
  
  logsLoading.value = true
  podLogs.value = ''
  
  try {
    if (followLogs.value) {
      // 实时日志模式
      const response = await fetch(`${API_ENDPOINTS.pods}/${selectedPod.value.metadata.name}/logs?namespace=${selectedPod.value.metadata.namespace}&container=${selectedContainer.value}&tailLines=${tailLines.value}&follow=true`)
      const reader = response.body.getReader()
      const decoder = new TextDecoder('utf-8')
      
      logsLoading.value = false
      
      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        
        const text = decoder.decode(value, { stream: true })
        podLogs.value += text
        
        // 滚动到底部
        await nextTick()
        if (logsContent.value && document.contains(logsContent.value.$el)) {
          logsContent.value.setScrollTop(logsContent.value.wrapRef.scrollHeight)
        }
      }
    } else {
      // 普通模式
      const response = await axios.get(`${API_ENDPOINTS.pods}/${selectedPod.value.metadata.name}/logs`, {
        params: {
          namespace: selectedPod.value.metadata.namespace,
          container: selectedContainer.value,
          tailLines: tailLines.value,
          follow: false
        }
      })
      
      podLogs.value = response.data || '无日志数据'
      
      // 滚动到底部
      await nextTick()
      if (logsContent.value && document.contains(logsContent.value.$el)) {
        logsContent.value.setScrollTop(logsContent.value.wrapRef.scrollHeight)
      }
    }
  } catch (error) {
    console.error('Error fetching pod logs:', error)
    ElMessage.error('获取Pod日志失败')
    podLogs.value = '获取日志出错: ' + error.message
  } finally {
    logsLoading.value = false
  }
}

const handleSearch = () => {
  currentPage.value = 1 // 搜索时重置到第一页
}

const handleSizeChange = (val) => {
  pageSize.value = val
  // 计算新的最大页码
  const maxPage = Math.ceil(filteredPods.value.length / val)
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

// 格式化时间为东八区时间
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

// 处理实时日志开关
const handleFollowChange = async (val) => {
  if (val) {
    // 清空现有日志
    podLogs.value = ''
    // 开始获取实时日志
    await fetchPodLogs()
  } else {
    // 获取普通日志
    await fetchPodLogs()
  }
}

// 监听对话框关闭
watch(logsDialogVisible, (val) => {
  if (!val) {
    followLogs.value = false
    // 如果有正在进行的日志获取，可能需要清理
    if (logsInterval) {
      clearInterval(logsInterval)
    }
  }
})

// 显示进入容器选择对话框
const showEnterContainer = (pod) => {
  selectedPod.value = pod
  podContainers.value = pod.spec.containers.map(c => c.name)
  
  if (podContainers.value.length === 1) {
    // 如果只有一个容器，直接进入
    selectedContainerForExec.value = podContainers.value[0]
    enterContainer()
  } else if (podContainers.value.length > 1) {
    // 如果有多个容器，显示选择对话框
    containerSelectVisible.value = true
    selectedContainerForExec.value = podContainers.value[0]
  } else {
    ElMessage.warning('该Pod没有可用的容器')
  }
}

// 进入容器
const enterContainer = async () => {
  if (!selectedPod.value || !selectedContainerForExec.value) {
    ElMessage.warning('请选择容器')
    return
  }
  
  try {
    const podName = selectedPod.value.metadata.name
    const namespace = selectedPod.value.metadata.namespace
    const containerName = selectedContainerForExec.value
    
    // 这里调用后端API，创建终端会话
    const response = await axios.post(`${API_ENDPOINTS.pods}/${podName}/exec`, {
      namespace,
      container: containerName
    })
    
    // 根据后端返回的会话ID跳转到终端页面
    if (response.data && response.data.sessionId) {
      const sessionId = response.data.sessionId
      // 打开新窗口或跳转到终端页面
      window.open(`/terminal?sessionId=${sessionId}&podName=${podName}&namespace=${namespace}&container=${containerName}`, '_blank')
      containerSelectVisible.value = false
    } else {
      ElMessage.error('创建终端会话失败')
    }
  } catch (error) {
    console.error('Error creating exec session:', error)
    ElMessage.error('无法连接到容器')
  }
}

// 处理命名空间变更
const handleNamespaceChange = () => {
  // 切换命名空间时默认请求数据
  fetchPods()
}

// 刷新数据并更新时间戳
const refreshData = () => {
  fetchPods()
  lastUpdateTime.value = new Date()
}

// 格式化更新时间
const formatUpdateTime = (time) => {
  if (!time) return ''
  return new Date(time).toLocaleString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

// 添加一个函数来处理下拉框展开事件
const handleDropdownVisible = (visible) => {
  if (visible) {
    // 下拉框展开时，确保命名空间列表是最新的
    if (namespaces.value.length <= 2) {
      fetchNamespaces();
    }
  }
}

// 处理状态筛选变更
const handleStatusFilterChange = () => {
  currentPage.value = 1; // 重置到第一页
  console.log('状态筛选变更为:', statusFilter.value);
}

// 初始化时收集所有可能的状态
const refreshPodStatuses = () => {
  // 预定义的基本状态
  const basicStatuses = ['Running', 'Pending', 'Succeeded', 'Failed', 'Unknown', 'Terminating'];
  
  // 从实际数据中收集状态
  const currentStatuses = new Set();
  pods.value.forEach(pod => {
    const status = getPodStatusText(pod);
    if (status) currentStatuses.add(status);
  });
  
  // 合并状态列表
  podStatuses.value = Array.from(new Set([...basicStatuses, ...currentStatuses])).sort();
}

// 动态计算日志内容区域高度
const logContentHeight = ref('500px')

// 监听日志对话框打开状态，调整高度
watch(logsDialogVisible, (visible) => {
  if (visible) {
    calculateLogContentHeight()
    window.addEventListener('resize', calculateLogContentHeight)
  } else {
    window.removeEventListener('resize', calculateLogContentHeight)
  }
})

// 计算日志内容区域高度
const calculateLogContentHeight = () => {
  nextTick(() => {
    // 计算可用高度 (视窗高度 - 对话框头部和底部 - 页眉 - 边距)
    const availableHeight = window.innerHeight - 200
    logContentHeight.value = `${Math.max(400, availableHeight)}px`
  })
}

// 复制日志到剪贴板
const copyLogsToClipboard = () => {
  if (!podLogs.value) {
    ElMessage.warning('暂无日志可复制');
    return;
  }
  
  try {
    navigator.clipboard.writeText(podLogs.value);
    ElMessage.success('日志已复制到剪贴板');
  } catch (error) {
    console.error('复制失败:', error);
    ElMessage.error('复制日志失败');
  }
}

// 下载日志
const downloadLogs = () => {
  if (!podLogs.value) {
    ElMessage.warning('暂无日志可下载');
    return;
  }
  
  try {
    const blob = new Blob([podLogs.value], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const podName = selectedPod.value?.metadata?.name || 'pod';
    const containerName = selectedContainer.value || 'container';
    
    a.href = url;
    a.download = `${podName}-${containerName}-${timestamp}.log`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    ElMessage.success('日志已下载');
  } catch (error) {
    console.error('下载失败:', error);
    ElMessage.error('下载日志失败');
  }
}

// 切换日志行换行
const toggleLineWrap = () => {
  nextTick(() => {
    if (logsContent.value) {
      logsContent.value.update()
    }
  })
}

onMounted(() => {
  // 首次加载时获取数据
  if (!dataLoaded.value) {
    fetchNamespaces();
    fetchPods();
    dataLoaded.value = true;
    lastUpdateTime.value = new Date();
    
    // 添加一个延迟获取命名空间的操作，以防首次加载失败
    setTimeout(() => {
      if (namespaces.value.length <= 2) {
        fetchNamespaces();
      }
    }, 2000);
  }
  window.addEventListener('resize', handleResize);
})

// 组件被keep-alive激活时触发
onActivated(() => {
  // 只调整UI相关，不触发数据请求
  handleResize()
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  if (logsInterval) {
    clearInterval(logsInterval)
  }
})

// 添加openTerminal函数，似乎在模板中使用但未定义
const openTerminal = (pod) => {
  showEnterContainer(pod)
}

const restartPod = (pod) => {
  ElMessageBox.confirm(
    `确定要重启Pod "${pod.metadata.name}"吗？`,
    '重启确认',
    {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning',
    }
  )
    .then(async () => {
      try {
        const response = await axios.post(`${API_ENDPOINTS.pods}/${pod.metadata.name}/restart`, {
          namespace: pod.metadata.namespace
        });
        
        if (response.data && response.data.success) {
          ElMessage.success(`Pod "${pod.metadata.name}" 正在重启`);
          // 刷新Pod列表
          setTimeout(() => {
            refreshData();
          }, 1000);
        } else {
          throw new Error(response.data?.message || '重启失败');
        }
      } catch (error) {
        console.error('重启Pod失败:', error);
        ElMessage.error(`重启失败: ${error.message || '未知错误'}`);
      }
    })
    .catch(() => {
      // 用户取消操作
    });
}
</script>

<style>
/* 全局样式 - 不受scoped限制 */
:global(.el-dropdown-menu.more-actions-dropdown .el-dropdown-menu__item) {
  padding: 5px 12px !important;
  line-height: 1.4 !important;
  font-size: 13px !important;
  display: flex !important;
  align-items: center !important;
  gap: 5px !important;
  height: auto !important;
  min-height: 32px !important;
  white-space: nowrap !important;
}

:global(.el-dropdown-menu.more-actions-dropdown .el-dropdown-menu__item .el-icon) {
  margin-right: 3px !important;
}
.pagination-dropdown {
  --el-select-height: 32px;
  min-width: 80px !important;
  max-width: 120px !important;
  width: auto !important;
  height: auto !important;
  padding: 0 !important;
  margin: 0 !important;
  background-color: #fff !important;
  border-radius: 4px !important;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1) !important;
}

.pagination-dropdown .el-scrollbar__wrap {
  max-height: 200px !important;
  overflow-x: hidden !important;
  overflow-y: auto !important;
}

.pagination-dropdown .el-select-dropdown__list {
  padding: 0 !important;
  margin: 0 !important;
}

.pagination-dropdown .el-select-dropdown__item {
  height: 32px !important;
  line-height: 32px !important;
  padding: 0 8px !important;
  text-align: center !important;
}

/* 修复下拉箭头区域多余空白 */
.el-pagination .el-select .el-input {
  width: auto !important;
  margin: 0 !important;
}

.el-pagination .el-select .el-input__wrapper {
  padding-right: 25px !important;
}

.el-pagination .el-select .el-input__suffix {
  right: 5px !important;
}
</style>

<style scoped>
.pods-container {
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

.namespace-select, .status-select {
  width: 180px;
  margin-right: 5px;
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

.action-buttons {
  display: flex;
  gap: 5px;
  justify-content: center;
}

.pagination-container {
  margin-top: 16px;
  padding: 8px 0;
  display: flex;
  justify-content: flex-end;
  position: relative;
  z-index: 1;
  align-items: center;
  gap: 16px;
}

.pagination-info {
  color: #909399;
  font-size: 14px;
}

:deep(.custom-pagination) {
  margin: 0;
  padding: 0;
}

:deep(.custom-pagination .el-pagination__sizes) {
  margin-right: 16px;
}

/* 隐藏不必要的空白区域 */
:deep(.el-pagination__total) {
  display: none;
}

/* 确保表格占满容器 */
:deep(.el-table) {
  width: 100% !important;
}

:deep(.el-table__body) {
  table-layout: fixed !important;
  width: 100% !important;
}

/* 确保列宽合理分配 */
:deep(.el-table__header) {
  table-layout: fixed !important;
  width: 100% !important;
}

@media screen and (max-width: 768px) {
  .pods-container {
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
  
  .search-input, .namespace-select, .status-select {
    width: 100%;
  }
  
  .actions {
    width: 100%;
    justify-content: space-between;
  }
}

/* 使用全局样式修复下拉菜单问题 */
:global(.ns-select-dropdown) {
  min-width: 180px !important;
  width: auto !important;
}

:global(.ns-select-dropdown .el-select-dropdown__wrap) {
  max-height: 300px !important;
}

:global(.ns-select-dropdown .el-select-dropdown__list) {
  padding: 0 !important;
}

:global(.ns-select-dropdown .el-select-dropdown__item) {
  height: 34px !important;
  line-height: 34px !important;
  padding: 0 10px !important;
}

:global(.el-popper.is-light) {
  border: 1px solid #e4e7ed !important;
}

:deep(.el-pagination) {
  margin: 0;
  padding: 0;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
}

:deep(.el-pagination__sizes) {
  margin: 0 16px 0 0 !important;
  min-width: 110px !important;
}

:deep(.el-pagination .el-select) {
  width: auto !important;
  min-width: 100px !important;
}

:deep(.el-pagination .el-select .el-input .el-input__inner) {
  padding-right: 25px !important;
  text-align: center !important;
  min-width: 60px !important;
}

:deep(.el-pagination button) {
  min-width: 32px !important;
  height: 32px !important;
}

:deep(.el-pagination .el-input__wrapper) {
  padding: 0 10px !important;
  min-width: 90px !important;
}

:deep(.el-pagination .el-select .el-select__tags) {
  width: auto !important;
  max-width: none !important;
}

/* 提高页面大小显示的宽度 */
:deep(.el-pagination .el-select-dropdown__item) {
  padding: 0 10px !important;
  text-align: center !important;
}

/* 日志对话框样式 */
:deep(.logs-dialog) {
  display: flex;
  flex-direction: column;
  max-height: 90vh;
}

:deep(.logs-dialog .el-dialog__body) {
  padding: 10px;
  flex: 1;
  overflow: hidden;
  max-width: 100%;
  position: relative;
}

:deep(.logs-dialog .el-dialog__header) {
  padding: 15px;
  margin-bottom: 0;
  border-bottom: 1px solid #e4e7ed;
}

:deep(.logs-dialog .el-dialog__footer) {
  padding: 10px 15px;
  border-top: 1px solid #e4e7ed;
}

.logs-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
}

.logs-header {
  display: flex;
  gap: 8px;
  margin-bottom: 10px;
  flex-wrap: wrap;
  align-items: center;
}

.container-select {
  width: 180px;
  margin-right: 5px;
}

.tail-lines-input {
  width: 140px;
}

.logs-control-group {
  display: flex;
  gap: 16px;
  align-items: center;
  margin-left: auto;
}

.wrap-switch {
  margin-left: auto;
}

.follow-switch {
  margin-left: auto;
}

.logs-content {
  background-color: #1e1e1e;
  border-radius: 4px;
  padding: 0;
  margin-bottom: 10px;
  flex: 1;
  overflow: hidden;
  width: 100%;
}

.logs-wrapper {
  min-height: 100%;
  position: relative;
  display: flex;
  flex-direction: column;
}

.logs-end-space {
  height: 150px; /* 增加底部空间高度 */
  width: 100%;
  flex-shrink: 0;
}

.logs-text {
  margin: 0;
  padding: 10px 12px;
  color: #fffefe;
  font-family: 'Courier New', Courier, monospace;
  white-space: pre;
  font-size: 13px;
  line-height: 1.4;
  width: 100%;
  overflow-x: auto;
  tab-size: 4;
  flex: 1;
}

.logs-text.wrap-lines {
  white-space: pre-wrap;
  word-break: break-all;
  overflow-wrap: break-word;
}

.logs-empty {
  padding: 16px;
  text-align: center;
  color: #aaa;
  font-style: italic;
}

@media screen and (max-width: 768px) {
  .logs-header {
    flex-direction: column;
    align-items: stretch;
  }
  
  .container-select, .tail-lines-input {
    width: 100%;
  }
  
  .wrap-switch, .follow-switch {
    margin: 12px 0;
    align-self: flex-start;
  }
  
  :deep(.logs-dialog) {
    margin: 0 !important;
  }
}

/* 压缩下拉菜单样式 */
:global(.compact-dropdown) {
  max-height: 100px !important;
  overflow-y: auto !important;
  padding: 0 !important;
  margin: 0 !important;
}

:global(.compact-dropdown .el-dropdown-menu) {
  padding: 0 !important;
  margin: 0 !important;
}

:global(.compact-dropdown .el-dropdown-menu__item) {
  padding: 4px 10px !important;
  margin: 0 !important;
  height: 28px !important;
  line-height: 1.4 !important;
  min-height: 0 !important;
}

.popover-content {
  display: flex;
  flex-direction: column;
}

.popover-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.popover-item:hover {
  background-color: #f5f7fa;
}

.popover-item .el-icon {
  font-size: 16px;
  color: #409EFF;
}

/* 修改弹出层样式 */
:global(.action-popover) {
  padding: 0 !important;
}

@media screen and (max-width: 768px) {
  .pods-container {
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
  
  .search-input, .namespace-select, .status-select {
    width: 100%;
  }
  
  .actions {
    width: 100%;
    justify-content: space-between;
  }
}
</style>