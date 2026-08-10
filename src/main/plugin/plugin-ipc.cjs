/**
 * plugin-ipc.cjs —— 插件能力白名单 IPC 通道
 *
 * 将 PluginManager 的受控能力暴露为白名单通道（agent-plugins:*），
 * 渲染进程经 preload 的 window.loAgent.plugins 调用。
 *
 * 边界：
 *   - 只绑定具体方法（listCommands / executeCommand），不透传任意调用
 *   - 渲染进程接触不到 PluginManager 实例
 *   - 与 lo-core:* 通道同构
 */
const CHANNELS = {
  LIST_COMMANDS: 'agent-plugins:list-commands',
  EXECUTE_COMMAND: 'agent-plugins:execute-command',
  LIST_VIEWS: 'agent-plugins:list-views',
  RENDER_VIEW: 'agent-plugins:render-view',
  INSTALL: 'agent-plugins:install',
};

/**
 * @param {object} ipcMain — electron ipcMain
 * @param {import('./plugin-manager.cjs')} pluginManager
 */
function registerPluginIpc(ipcMain, pluginManager) {
  // 列出已注册命令（供命令面板渲染：id / title / pluginId）
  ipcMain.handle(CHANNELS.LIST_COMMANDS, () => {
    if (!pluginManager || !pluginManager.extensionRegistry) return { ok: true, commands: [] };
    const commands = pluginManager.extensionRegistry
      .listCommands()
      .map((c) => ({ id: c.id, title: c.title, pluginId: c.pluginId }));
    return { ok: true, commands };
  });

  // 执行插件命令
  ipcMain.handle(CHANNELS.EXECUTE_COMMAND, async (_event, commandId, args) => {
    try {
      if (!pluginManager) throw new Error('插件系统未初始化');
      const result = await pluginManager.executeCommand(commandId, Array.isArray(args) ? args : []);
      return { ok: true, result };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });

  // 列出已注册视图（供视图面板：id / title / type / pluginId）
  ipcMain.handle(CHANNELS.LIST_VIEWS, () => {
    if (!pluginManager || !pluginManager.extensionRegistry) return { ok: true, views: [] };
    const views = pluginManager.extensionRegistry
      .listViews()
      .map((v) => ({ id: v.id, title: v.title, type: v.type, pluginId: v.pluginId }));
    return { ok: true, views };
  });

  // 渲染视图 → HTML（交付渲染进程承载）
  ipcMain.handle(CHANNELS.RENDER_VIEW, async (_event, viewId, context) => {
    try {
      if (!pluginManager) throw new Error('插件系统未初始化');
      const result = await pluginManager.renderView(viewId, context || {});
      return { ok: true, view: result };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });

  // 安装插件（registryUrl + 可选 force）
  ipcMain.handle(CHANNELS.INSTALL, async (_event, id, registryUrl, options) => {
    try {
      if (!pluginManager) throw new Error('插件系统未初始化');
      const result = await pluginManager.install(id, registryUrl, options || {});
      return { ok: true, result };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });
}

module.exports = { registerPluginIpc, CHANNELS };
