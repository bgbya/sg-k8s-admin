<template>
  <div class="terminal-container">
    <div class="terminal-header">
      <div class="terminal-info">
        <span class="label">Pod:</span> <span class="value">{{ podName }}</span>
        <span class="label">Namespace:</span> <span class="value">{{ namespace }}</span>
        <span class="label">Container:</span> <span class="value">{{ container }}</span>
      </div>
      <el-button type="danger" @click="closeTerminal">关闭终端</el-button>
    </div>
    <div ref="terminal" class="terminal"></div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, defineComponent } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Terminal } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import 'xterm/css/xterm.css'
import { API_ENDPOINTS, API_BASE_URL } from '@/config/api'

// 定义组件名称
defineComponent({
  name: 'TerminalView'
})

const route = useRoute()
const router = useRouter()

const sessionId = ref(route.query.sessionId || '')
const podName = ref(route.query.podName || '')
const namespace = ref(route.query.namespace || '')
const container = ref(route.query.container || '')

const terminal = ref(null)
let term = null
let fitAddon = null
let socket = null

const closeTerminal = () => {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.close()
  }
  router.push('/pods')
}

const initTerminal = () => {
  if (!terminal.value) return

  // 创建XTerm实例
  term = new Terminal({
    cursorBlink: true,
    theme: {
      background: '#1e1e1e',
      foreground: '#f8f8f2',
      cursor: '#f8f8f2'
    },
    fontFamily: 'monospace',
    fontSize: 14,
    lineHeight: 1.2,
    scrollback: 1000
  })

  // 添加自适应大小插件
  fitAddon = new FitAddon()
  term.loadAddon(fitAddon)

  // 挂载到DOM
  term.open(terminal.value)
  fitAddon.fit()

  // 连接WebSocket
  connectWebSocket()

  // 监听窗口大小变化，自适应终端大小
  window.addEventListener('resize', () => {
    if (fitAddon) {
      fitAddon.fit()
      if (socket && socket.readyState === WebSocket.OPEN) {
        // 发送调整大小消息
        const dimensions = { cols: term.cols, rows: term.rows }
        socket.send(JSON.stringify({
          type: 'resize',
          cols: dimensions.cols,
          rows: dimensions.rows
        }))
      }
    }
  })
}

const connectWebSocket = () => {
  if (!sessionId.value) {
    term.writeln('Error: No session ID provided')
    return
  }

  // 创建WebSocket连接
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  // 使用API_ENDPOINTS中定义的基础URL
  const apiBaseUrl = API_BASE_URL
  const host = new URL(apiBaseUrl).host
  const wsUrl = `${protocol}//${host}/api/terminal?sessionId=${sessionId.value}`
  
  console.log('Connecting to WebSocket:', wsUrl)
  socket = new WebSocket(wsUrl)

  socket.onopen = () => {
    term.writeln('Connected to container...')
    term.writeln('')

    // 将终端输入发送到WebSocket
    term.onData((data) => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({
          type: 'stdin',
          data: data
        }))
      }
    })

    // 发送初始化窗口大小
    if (fitAddon) {
      fitAddon.fit()
      socket.send(JSON.stringify({
        type: 'resize',
        cols: term.cols,
        rows: term.rows
      }))
    }
  }

  socket.onmessage = (event) => {
    try {
      // 尝试解析为JSON
      const data = event.data;
      
      // 检查是否是JSON格式的数据
      if (data.startsWith('{') && data.endsWith('}')) {
        const msg = JSON.parse(data);
        if (msg.type === 'stdout') {
          term.write(msg.data);
        }
      } else {
        // 如果不是JSON格式，直接显示文本内容
        console.log('Non-JSON message received:', data);
        term.writeln('\r\n' + data);
      }
    } catch (err) {
      console.error('Error handling message:', err);
      term.writeln(`\r\nError: ${err.message}`);
    }
  }

  socket.onclose = () => {
    term.writeln('\r\nConnection closed')
  }

  socket.onerror = (error) => {
    console.error('WebSocket error:', error)
    term.writeln(`\r\nError: ${error.message || 'WebSocket connection error'}`)
  }
}

onMounted(() => {
  initTerminal()
})

onUnmounted(() => {
  if (socket) {
    socket.close()
  }
  if (term) {
    term.dispose()
  }
  window.removeEventListener('resize', fitAddon?.fit)
})
</script>

<style scoped>
.terminal-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100%;
  background-color: #1e1e1e;
}

.terminal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 16px;
  background-color: #2d2d2d;
  color: #f8f8f2;
}

.terminal-info {
  display: flex;
  gap: 16px;
}

.label {
  font-weight: bold;
  color: #8be9fd;
}

.value {
  color: #f8f8f2;
}

.terminal {
  flex: 1;
  width: 100%;
  height: calc(100vh - 50px);
  padding: 4px;
}

.terminal :deep(.xterm-viewport) {
  background-color: #1e1e1e !important;
}
</style> 