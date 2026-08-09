/**
 * lo-agent preload 脚本
 *
 * 通过 contextBridge 向渲染进程暴露受控 API。
 * 基础架子：暂无业务 API，仅预留命名空间。
 */
const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('loAgent', {
  version: '0.1.0',
});