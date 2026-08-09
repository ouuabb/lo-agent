/**
 * lo-agent preload 脚本
 *
 * 通过 contextBridge 向渲染进程暴露受控 API。
 * loCore 子命名空间经由 ipcRenderer.invoke 调用主进程白名单通道。
 */
const { contextBridge, ipcRenderer } = require('electron');

const CHANNEL = {
  CONFIG: 'lo-core:config',
  CONFIGURE: 'lo-core:configure',
  LOGIN: 'lo-core:login',
  STATUS: 'lo-core:status',
  LIST_NOTES: 'lo-core:list-notes',
  LOGOUT: 'lo-core:logout',
};

contextBridge.exposeInMainWorld('loAgent', {
  version: '0.1.0',
  loCore: {
    getConfig: () => ipcRenderer.invoke(CHANNEL.CONFIG),
    configure: (config) => ipcRenderer.invoke(CHANNEL.CONFIGURE, config),
    login: (params) => ipcRenderer.invoke(CHANNEL.LOGIN, params),
    getStatus: () => ipcRenderer.invoke(CHANNEL.STATUS),
    listNotes: (query) => ipcRenderer.invoke(CHANNEL.LIST_NOTES, query),
    logout: () => ipcRenderer.invoke(CHANNEL.LOGOUT),
  },
});
