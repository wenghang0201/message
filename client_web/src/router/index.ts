import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'
import { requireAuth, requireGuest } from './guards'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    redirect: '/chats',
  },
  // 认证路由
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/auth/Login.vue'),
    meta: {
      title: '登录',
      requiresGuest: true,
    },
    beforeEnter: requireGuest,
  },
  {
    path: '/register',
    name: 'Register',
    component: () => import('@/views/auth/Register.vue'),
    meta: {
      title: '注册',
      requiresGuest: true,
    },
    beforeEnter: requireGuest,
  },
  // 受保护的路由
  {
    path: '/chats',
    name: 'ChatList',
    component: () => import('@/views/ChatList.vue'),
    meta: {
      title: 'Chats',
      requiresAuth: true,
    },
    beforeEnter: requireAuth,
  },
  {
    path: '/chats/:id',
    name: 'ChatDetail',
    component: () => import('@/views/ChatDetail.vue'),
    meta: {
      title: 'Chat',
      requiresAuth: true,
    },
    props: true,
    beforeEnter: requireAuth,
  },
  {
    path: '/create-group',
    name: 'CreateGroup',
    component: () => import('@/views/CreateGroup.vue'),
    meta: {
      title: '新建群聊',
      requiresAuth: true,
    },
    beforeEnter: requireAuth,
  },
  {
    path: '/group-settings/:id',
    name: 'GroupSettings',
    component: () => import('@/views/GroupSettings.vue'),
    meta: {
      title: '群设置',
      requiresAuth: true,
    },
    props: true,
    beforeEnter: requireAuth,
  },
  {
    path: '/edit-profile',
    name: 'EditProfile',
    component: () => import('@/views/EditProfile.vue'),
    meta: {
      title: '编辑资料',
      requiresAuth: true,
    },
    beforeEnter: requireAuth,
  },
  {
    path: '/privacy-settings',
    name: 'PrivacySettings',
    component: () => import('@/views/PrivacySettings.vue'),
    meta: {
      title: '隐私设置',
      requiresAuth: true,
    },
    beforeEnter: requireAuth,
  },
  {
    path: '/change-password',
    name: 'ChangePassword',
    component: () => import('@/views/ChangePassword.vue'),
    meta: {
      title: '修改密码',
      requiresAuth: true,
    },
    beforeEnter: requireAuth,
  },
  {
    path: '/friends',
    name: 'Friends',
    component: () => import('@/views/Friends.vue'),
    meta: {
      title: '好友',
      requiresAuth: true,
    },
    beforeEnter: requireAuth,
  },
  {
    path: '/friends/:userId',
    name: 'FriendProfile',
    component: () => import('@/views/FriendProfile.vue'),
    meta: {
      title: '好友资料',
      requiresAuth: true,
    },
    beforeEnter: requireAuth,
    props: true,
  },
  {
    path: '/profile',
    name: 'Profile',
    component: () => import('@/views/Profile.vue'),
    meta: {
      title: '我的',
      requiresAuth: true,
    },
    beforeEnter: requireAuth,
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.beforeEach((to, _from, next) => {
  const title = to.meta.title as string
  if (title) {
    document.title = title
  }
  next()
})

export default router
