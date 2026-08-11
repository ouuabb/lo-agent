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
  RELATIONS: 'lo-core:relations',
  OPERATIONS: 'lo-core:operations',
  OPERATION_UNDO: 'lo-core:operation-undo',
  EVENTS_SUBSCRIBE: 'lo-core:events-subscribe',
  EVENTS_UNSUBSCRIBE: 'lo-core:events-unsubscribe',
  EVENTS_PUSH: 'lo-core:event',
  PLUGINS_LIST: 'agent-plugins:list-commands',
  PLUGINS_EXECUTE: 'agent-plugins:execute-command',
  PLUGINS_VIEWS: 'agent-plugins:list-views',
  PLUGINS_RENDER_VIEW: 'agent-plugins:render-view',
  PLUGINS_INSTALL: 'agent-plugins:install',
  PLUGINS_MANAGE_LIST: 'agent-plugins:list-plugins',
  PLUGINS_MANAGE_ENABLE: 'agent-plugins:enable',
  PLUGINS_MANAGE_DISABLE: 'agent-plugins:disable',
  PLUGINS_MANAGE_UNINSTALL: 'agent-plugins:uninstall',
  PLUGINS_MANAGE_GET_CONFIG: 'agent-plugins:get-plugin-config',
  PLUGINS_MANAGE_SET_CONFIG: 'agent-plugins:set-plugin-config',
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
    relations: {
      list: (rid) => ipcRenderer.invoke(CHANNEL.RELATIONS, rid),
    },
    operations: {
      list: (query) => ipcRenderer.invoke(CHANNEL.OPERATIONS, query),
      undo: (id) => ipcRenderer.invoke(CHANNEL.OPERATION_UNDO, id),
    },
    events: {
      subscribe: (types) => ipcRenderer.invoke(CHANNEL.EVENTS_SUBSCRIBE, types),
      unsubscribe: () => ipcRenderer.invoke(CHANNEL.EVENTS_UNSUBSCRIBE),
      onEvent: (cb) => {
        const listener = (_e, event) => cb(event);
        ipcRenderer.on(CHANNEL.EVENTS_PUSH, listener);
        return () => ipcRenderer.removeListener(CHANNEL.EVENTS_PUSH, listener);
      },
    },
  },
  plugins: {
    list: () => ipcRenderer.invoke(CHANNEL.PLUGINS_LIST),
    execute: (commandId, args) =>
      ipcRenderer.invoke(CHANNEL.PLUGINS_EXECUTE, commandId, args),
    views: {
      list: () => ipcRenderer.invoke(CHANNEL.PLUGINS_VIEWS),
      render: (viewId, context) =>
        ipcRenderer.invoke(CHANNEL.PLUGINS_RENDER_VIEW, viewId, context),
    },
    install: (id, registryUrl, options) =>
      ipcRenderer.invoke(CHANNEL.PLUGINS_INSTALL, id, registryUrl, options),
    manage: {
      list: () => ipcRenderer.invoke(CHANNEL.PLUGINS_MANAGE_LIST),
      enable: (id) => ipcRenderer.invoke(CHANNEL.PLUGINS_MANAGE_ENABLE, id),
      disable: (id) => ipcRenderer.invoke(CHANNEL.PLUGINS_MANAGE_DISABLE, id),
      uninstall: (id) => ipcRenderer.invoke(CHANNEL.PLUGINS_MANAGE_UNINSTALL, id),
      getConfig: (id) => ipcRenderer.invoke(CHANNEL.PLUGINS_MANAGE_GET_CONFIG, id),
      setConfig: (id, key, value) =>
        ipcRenderer.invoke(CHANNEL.PLUGINS_MANAGE_SET_CONFIG, id, key, value),
    },
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
