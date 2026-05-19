import { createRouter, createWebHistory } from 'vue-router'

const RouteStub = { template: '<span />' }

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/platforms' },
    { path: '/login', name: 'login', component: RouteStub },
    { path: '/platforms', name: 'platform-list', component: RouteStub },
    { path: '/platforms/new', name: 'platform-new', component: RouteStub },
    { path: '/platforms/:platformId', name: 'platform-detail', component: RouteStub },
    { path: '/managed-platforms', name: 'managed-platforms', component: RouteStub },
    { path: '/managed-platforms/:platformId', name: 'managed-platform-detail', component: RouteStub },
    { path: '/used-platforms', name: 'used-platforms', component: RouteStub },
    { path: '/used-platforms/:platformId', name: 'used-platform-detail', component: RouteStub },
    { path: '/api-keys', name: 'my-api-keys', component: RouteStub },
    { path: '/api-keys/apply', name: 'api-key-apply', component: RouteStub },
    { path: '/key-applies', name: 'my-key-applies', component: RouteStub },
    { path: '/approvals', name: 'my-approvals', component: RouteStub },
    { path: '/platforms/:platformId/key-apply', name: 'platform-key-apply', component: RouteStub },
    { path: '/platforms/:platformId/tools/new', name: 'tool-new', component: RouteStub },
    { path: '/platforms/:platformId/tools/openapi-import', name: 'tool-openapi', component: RouteStub },
    { path: '/platforms/:platformId/tools/:toolId', name: 'tool-editor', component: RouteStub },
    { path: '/:pathMatch(.*)*', redirect: '/platforms' },
  ],
})
