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
  GET_NOTE: 'lo-core:get-note',
  UPDATE_NOTE: 'lo-core:update-note',
  LOGOUT: 'lo-core:logout',
  WIN_MINIMIZE: 'window:minimize',
  WIN_TOGGLE_MAXIMIZE: 'window:toggle-maximize',
  WIN_CLOSE: 'window:close',
  WIN_IS_MAXIMIZED: 'window:is-maximized',
  WIN_ON_MAXIMIZE_CHANGE: 'window:maximized-change',
};

contextBridge.exposeInMainWorld('loAgent', {
  version: '0.1.0',
  loCore: {
    getConfig: () => ipcRenderer.invoke(CHANNEL.CONFIG),
    configure: (config) => ipcRenderer.invoke(CHANNEL.CONFIGURE, config),
    login: (params) => ipcRenderer.invoke(CHANNEL.LOGIN, params),
    getStatus: () => ipcRenderer.invoke(CHANNEL.STATUS),
    listNotes: (query) => ipcRenderer.invoke(CHANNEL.LIST_NOTES, query),
    getNote: (rid) => ipcRenderer.invoke(CHANNEL.GET_NOTE, rid),
    updateNote: (rid, body) => ipcRenderer.invoke(CHANNEL.UPDATE_NOTE, rid, body),
    logout: () => ipcRenderer.invoke(CHANNEL.LOGOUT),
  },
  windowControls: {
    minimize: () => ipcRenderer.invoke(CHANNEL.WIN_MINIMIZE),
    toggleMaximize: () => ipcRenderer.invoke(CHANNEL.WIN_TOGGLE_MAXIMIZE),
    close: () => ipcRenderer.invoke(CHANNEL.WIN_CLOSE),
    isMaximized: () => ipcRenderer.invoke(CHANNEL.WIN_IS_MAXIMIZED),
    onMaximizeChange: (cb) => {
      const listener = (_e, val) => cb(val);
      ipcRenderer.on(CHANNEL.WIN_ON_MAXIMIZE_CHANGE, listener);
      return () => ipcRenderer.removeListener(CHANNEL.WIN_ON_MAXIMIZE_CHANGE, listener);
    },
  },
});
