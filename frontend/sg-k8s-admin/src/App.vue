<script setup>
import { Monitor, Connection, Grid, Expand, Fold, Menu as MenuIcon, Monitor as Dashboard } from '@element-plus/icons-vue'
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const isCollapse = ref(false)
const route = useRoute()
const router = useRouter()
const isMobile = ref(false)

// 监听窗口大小变化
const handleResize = () => {
  isMobile.value = window.innerWidth <= 768
  if (isMobile.value && !isCollapse.value) {
    isCollapse.value = true
  }
}

onMounted(() => {
  handleResize()
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
})

// 菜单配置
const menuItems = [
  { 
    group: '工作负载',
    key: 'workloads',
    icon: 'MenuIcon',
    children: [
      { path: '/pods', name: 'Pods', icon: 'Monitor' },
      { path: '/deployments', name: 'Deployments', icon: 'Connection' },
      { path: '/statefulsets', name: 'StatefulSets', icon: 'Grid' }
    ]
  }
]

// 展开的子菜单
const openedMenus = computed(() => {
  const currentPath = route.path
  if (['/pods', '/deployments', '/statefulsets'].includes(currentPath)) {
    return ['workloads']
  }
  return []
})

// 获取需要缓存的组件名称
const cachedViews = computed(() => {
  const components = [];
  
  if (route.meta && route.meta.keepAlive) {
    const componentName = getComponentName(route.path);
    if (componentName) {
      components.push(componentName);
    }
  }
  
  return components;
});

// 获取当前页面标题
const currentPageTitle = computed(() => {
  const pathMap = {
    '/pods': 'Pods',
    '/deployments': 'Deployments',
    '/statefulsets': 'StatefulSets',
    '/terminal': 'Terminal'
  };
  
  return pathMap[route.path] || 'Dashboard';
});

// 根据路径获取组件名称
function getComponentName(path) {
  const pathMap = {
    '/pods': 'PodsView',
    '/deployments': 'DeploymentsView',
    '/statefulsets': 'StatefulSetsView'
  };
  
  return pathMap[path] || '';
}

// 处理移动端侧边栏关闭
const handleClickOutside = () => {
  if (isMobile.value && !isCollapse.value) {
    isCollapse.value = true
  }
}
</script>

<template>
  <el-container class="layout-container">
    <!-- 侧边栏遮罩 - 移动端使用 -->
    <div v-if="isMobile && !isCollapse" class="sidebar-overlay" @click="handleClickOutside"></div>
    
    <el-aside :width="isCollapse ? '64px' : '220px'" class="aside" :class="{'mobile-aside': isMobile}">
      <div class="logo-container" :class="{ 'collapsed': isCollapse }">
        <el-icon class="logo-icon" :size="24"><Dashboard /></el-icon>
        <h2 class="logo-title" v-show="!isCollapse">K8s应用管理系统</h2>
      </div>
      <el-scrollbar>
        <el-menu
          router
          :default-active="$route.path"
          class="el-menu-vertical"
          :collapse="isCollapse"
          :default-openeds="openedMenus"
          background-color="#001529"
          text-color="#b7bdc3"
          active-text-color="#ffffff"
        >
          <el-sub-menu index="workloads">
            <template #title>
              <el-icon><MenuIcon /></el-icon>
              <span>工作负载</span>
            </template>
            <el-menu-item index="/pods">
              <el-icon><Monitor /></el-icon>
              <span>Pods</span>
            </el-menu-item>
            <el-menu-item index="/deployments">
              <el-icon><Connection /></el-icon>
              <span>Deployments</span>
            </el-menu-item>
            <el-menu-item index="/statefulsets">
              <el-icon><Grid /></el-icon>
              <span>StatefulSets</span>
            </el-menu-item>
          </el-sub-menu>
        </el-menu>
      </el-scrollbar>
    </el-aside>
    
    <el-container class="main-container" :class="{'collapsed-main': isCollapse, 'mobile-main': isMobile}">
      <!-- 顶部导航栏 -->
      <el-header class="header" height="60px">
        <div class="header-left">
          <el-button type="text" @click="isCollapse = !isCollapse" class="toggle-button">
            <el-icon :size="20" color="#fff">
              <component :is="isCollapse ? 'Expand' : 'Fold'" />
            </el-icon>
          </el-button>
          <div class="page-title">
            <component :is="currentPageTitle === 'Pods' ? 'Monitor' : 
                          currentPageTitle === 'Deployments' ? 'Connection' : 
                          currentPageTitle === 'StatefulSets' ? 'Grid' : 'Dashboard'" 
                      class="page-icon" />
            <h2>{{ currentPageTitle }}</h2>
          </div>
        </div>
        <div class="header-right">
          <!-- 这里可以放置用户头像或其他控件 -->
    </div>
      </el-header>

      <!-- 主内容区域 -->
      <el-main class="main">
        <el-card class="main-card">
          <keep-alive :include="cachedViews">
            <router-view />
          </keep-alive>
        </el-card>
      </el-main>
    </el-container>
  </el-container>
</template>

<style>
:root {
  --primary-color: #1890ff;
  --primary-bg: #001529;
  --secondary-bg: #ffffff;
  --menu-active-bg: #1890ff;
  --header-bg: #1890ff;
  --text-primary: #333333;
  --text-secondary: #b7bdc3;
  --text-light: #ffffff;
  --border-color: #f0f0f0;
  --content-bg: #f5f7fa;
}

/* 暗色主题变量 */
@media (prefers-color-scheme: dark) {
  :root {
    --primary-color: #1890ff;
    --primary-bg: #001529;
    --secondary-bg: #1f1f1f;
    --menu-active-bg: #1890ff;
    --header-bg: #141414;
    --text-primary: #ffffff;
    --text-secondary: #b7bdc3;
    --text-light: #ffffff;
    --border-color: #303030;
    --content-bg: #141414;
  }
}

.layout-container {
  height: 100vh;
  width: 100vw;
  position: absolute;
  left: 0;
  top: 0;
  overflow: hidden;
  background-color: var(--primary-bg);
}

.sidebar-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  z-index: 998;
}

.aside {
  transition: width 0.3s;
  background-color: var(--primary-bg);
  box-shadow: none;
  display: flex;
  flex-direction: column;
  z-index: 999;
  position: fixed;
  height: 100vh;
  left: 0;
  top: 0;
}

.mobile-aside {
  position: fixed;
  height: 100vh;
  z-index: 999;
}

.logo-container {
  height: 60px;
  display: flex;
  align-items: center;
  padding: 0 16px;
  overflow: hidden;
  transition: all 0.3s;
  background-color: var(--primary-bg);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  gap: 10px;
}

.logo-container.collapsed {
  justify-content: center;
  padding: 0;
}

.logo-icon {
  color: var(--primary-color);
  min-width: 24px;
}

.logo-title {
  color: var(--text-light);
  margin: 0;
  font-size: 16px;
  white-space: nowrap;
  transition: all 0.3s;
  font-weight: 500;
}

.header {
  background-color: var(--header-bg);
  color: var(--text-light);
  padding: 0 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  box-shadow: 0 1px 4px rgba(0,21,41,0.08);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 20px;
}

.toggle-button {
  color: var(--text-light) !important;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 20px;
}

.page-title {
  display: flex;
  align-items: center;
  gap: 10px;
}

.page-title h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 500;
  color: var(--text-light);
}

.page-icon {
  font-size: 20px;
  color: var(--text-light);
}

.main-container {
  transition: margin-left 0.3s;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background-color: var(--content-bg);
  margin-left: 220px;
  height: 100vh;
}

.main-container::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 1px;
  background-color: var(--primary-bg);
  z-index: 10;
}

.aside::after {
  content: '';
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  width: 1px;
  background-color: var(--primary-bg);
  z-index: 10;
}

.collapsed-main {
  margin-left: 64px !important;
}

.mobile-main {
  margin-left: 0 !important;
}

.main {
  padding: 20px;
  overflow-y: auto;
  height: calc(100vh - 60px);
}

.main-card {
  border-radius: 8px;
  border: none;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
  background-color: var(--secondary-bg);
  height: 100%;
  overflow: hidden;
}

.main-card :deep(.el-card__body) {
  padding: 0;
  height: 100%;
}

/* 菜单样式 */
.el-menu {
  border-right: none !important;
  overflow-y: auto;
}

.el-menu--collapse {
  width: 64px !important;
}

.el-scrollbar {
  height: calc(100vh - 60px);
  border-right: none;
}

.el-menu-vertical:not(.el-menu--collapse) {
  width: 220px;
}

/* 移除可能的边框 */
.el-sub-menu, .el-menu-item {
  border-right: none !important;
}

/* 重置全局样式 */
html, body {
  margin: 0;
  padding: 0;
  height: 100%;
  width: 100%;
  overflow: hidden;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  color: var(--text-primary);
  background-color: var(--content-bg);
  overflow-y: scroll;
  position: relative;
}

#app {
  height: 100%;
  width: 100%;
  position: absolute;
  left: 0;
  top: 0;
}

/* Element Plus 组件风格优化 */
.el-button {
  border-radius: 4px;
}

.el-card {
  border-radius: 8px;
  border: 1px solid var(--border-color);
  overflow: hidden;
}

.el-table {
  --el-table-border-color: var(--border-color);
  --el-table-header-bg-color: var(--content-bg);
}

/* 响应式布局优化 */
@media screen and (max-width: 768px) {
  .main {
    padding: 10px;
  }
  
  .header {
    padding: 0 10px;
  }
  
  .page-title h2 {
    font-size: 16px;
  }
}

.el-menu-item.is-active {
  background-color: var(--menu-active-bg) !important;
  color: var(--text-light) !important;
  }

.el-sub-menu__title {
  padding-left: 20px !important;
  }

.el-sub-menu .el-menu-item {
  padding-left: 40px !important;
  min-width: auto;
}

/* 确保子菜单内容可见性 */
.el-menu--popup {
  min-width: 160px;
  background-color: var(--primary-bg) !important;
}

/* 移除所有边框 */
.el-menu, .el-menu-item, .el-sub-menu, .el-sub-menu__title {
  border: none !important;
  }

/* 覆盖Element Plus边框 */
:deep(.el-menu) {
  border-right: none !important;
}

:deep(.el-aside) {
  overflow: hidden !important;
  box-shadow: none !important;
}

:deep(.el-menu--collapse) {
  width: 64px !important;
  border-right: none !important;
}

:deep(.el-sub-menu) {
  border-right: none !important;
}

:deep(.el-menu-item) {
  border-right: none !important;
}

/* 全局样式 */
.ns-select-dropdown {
  max-height: 400px !important; 
  overflow: visible !important;
  min-width: 180px !important;
  width: auto !important;
  z-index: 9999 !important;
}

/* 修复双滚动条问题 */
.ns-select-dropdown .el-scrollbar {
  height: auto !important;
  overflow: visible !important;
}

.ns-select-dropdown .el-scrollbar__wrap {
  max-height: 400px !important;
  overflow-y: auto !important;
  overflow-x: hidden !important;
  scrollbar-width: thin;
}

/* 隐藏外层滚动条但保持功能 */
.ns-select-dropdown .el-select-dropdown__wrap {
  overflow-y: auto !important;
  max-height: 400px !important;
}

.ns-select-dropdown .el-scrollbar__view {
  overflow: visible !important;
}

.ns-select-dropdown .el-select-dropdown__list {
  padding: 0 !important;
}

.ns-select-dropdown .el-select-dropdown__item {
  height: 34px !important;
  line-height: 34px !important;
  padding: 0 10px !important;
}

/* 修改滚动条样式而不是隐藏它 */
.el-select-dropdown::-webkit-scrollbar {
  width: 6px !important;
  display: block !important;
}

.el-select-dropdown::-webkit-scrollbar-thumb {
  background-color: rgba(144, 147, 153, 0.3) !important;
  border-radius: 3px !important;
}

.el-select-dropdown::-webkit-scrollbar-track {
  background-color: transparent !important;
}

/* 确保弹出菜单正确显示 */
.el-popper.is-pure {
  z-index: 9999 !important;
}

.el-overlay {
  z-index: 9000 !important;
}

/* 应用相同的样式到分页下拉框 */
.el-pagination .el-select .el-popper,
.el-pagination__sizes .el-select .el-popper,
.el-pagination .el-select-dropdown 。more-actions-dropdown{
  max-height: 400px !important; 
  overflow: visible !important;
  min-width: 100px !important;
  width: auto !important;
  z-index: 9999 !important;
}

.el-pagination .el-select .el-scrollbar,
.el-pagination__sizes .el-select .el-scrollbar {
  height: auto !important;
  overflow: visible !important;
}

.el-pagination .el-select .el-scrollbar__wrap,
.el-pagination__sizes .el-select .el-scrollbar__wrap {
  max-height: 400px !important;
  overflow-y: auto !important;
  overflow-x: hidden !important;
  scrollbar-width: thin;
}

.el-pagination .el-select-dropdown__wrap,
.el-pagination__sizes .el-select-dropdown__wrap {
  overflow-y: auto !important;
  max-height: 400px !important;
}

.el-pagination .el-select .el-scrollbar__view,
.el-pagination__sizes .el-select .el-scrollbar__view {
  overflow: visible !important;
}

.el-pagination .el-select-dropdown__list,
.el-pagination__sizes .el-select-dropdown__list {
  padding: 0 !important;
}

.el-pagination .el-select-dropdown__item,
.el-pagination__sizes .el-select-dropdown__item .more-actions-dropdown{
  height: 34px !important;
  line-height: 34px !important;
  padding: 0 10px !important;
}

/* 确保弹出菜单正确显示 */
.el-popper.is-pure {
  z-index: 9999 !important;
}

.el-overlay {
  z-index: 9000 !important;
}

/* 全局样式修复 - 分页下拉框 */
.pagination-dropdown,
.el-pagination .el-select .el-popper,
.el-pagination__sizes .el-select .el-popper .more-actions-dropdown {
  min-width: 120px !important;
  max-width: 160px !important;
  width: auto !important;
  height: auto !important;
  background-color: #fff !important;
  overflow: hidden !important;
  padding: 0 !important;
  margin: 0 !important;
}

.pagination-dropdown .el-select-dropdown__list,
.el-pagination .el-select-dropdown__list {
  padding: 0 !important;
  margin: 0 !important;
}

.pagination-dropdown .el-scrollbar,
.el-pagination .el-select .el-scrollbar {
  height: auto !important;
  overflow: hidden !important;
}

.pagination-dropdown .el-scrollbar__wrap,
.el-pagination .el-select .el-scrollbar__wrap {
  max-height: 200px !important;
  overflow-y: auto !important;
  overflow-x: hidden !important;
}

.pagination-dropdown .el-select-dropdown__item,
.el-pagination .el-select .el-select-dropdown__item {
  height: 32px !important;
  line-height: 32px !important;
  padding: 0 8px !important;
  text-align: center !important;
}

/* 修复分页器组件布局 */
.el-pagination {
  display: flex !important;
  align-items: center !important;
  padding: 0 !important;
  margin: 0 !important;
  height: 32px !important;
}

.el-pagination .el-select {
  margin: 0 8px 0 0 !important;
  min-width: 90px !important;
}

.el-pagination .el-input__wrapper {
  padding: 0 8px !important;
  height: 32px !important;
  box-shadow: none !important;
  min-width: 80px !important;
}

.el-pagination .el-input .el-input__inner {
  text-align: center !important;
  min-width: 50px !important;
}

.el-pagination .el-select .el-input {
  margin: 0 !important;
  width: auto !important;
  min-width: 80px !important;
}
</style>
