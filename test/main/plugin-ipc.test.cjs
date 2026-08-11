const { registerPluginIpc, CHANNELS } = require('../../src/main/plugin/plugin-ipc.cjs');

function makeRegistry(commands, views = []) {
  return {
    listCommands: jest.fn(() => commands),
    listViews: jest.fn(() => views),
  };
}

function makePluginManager(commands = [], views = []) {
  const pm = {
    extensionRegistry: makeRegistry(commands, views),
    executeCommand: jest.fn(),
    renderView: jest.fn(),
    listForUi: jest.fn(() => []),
    enable: jest.fn(async () => ({})),
    disable: jest.fn(async () => ({})),
    uninstall: jest.fn(async () => ({ ok: true, id: 'demo' })),
    getConfig: jest.fn(() => ({})),
    setConfig: jest.fn(() => ({})),
  };
  pm.executeCommand.mockImplementation(async (id, args) => ({
    pluginId: 'demo',
    commandId: id,
    result: { ok: true, args },
  }));
  pm.renderView.mockImplementation(async (viewId) => ({
    pluginId: 'demo',
    viewId,
    title: 'View',
    type: 'panel',
    html: '<p>hi</p>',
  }));
  return pm;
}

describe('registerPluginIpc', () => {
  it('为每个通道注册 handle', () => {
    const ipcMain = { handle: jest.fn() };
    registerPluginIpc(ipcMain, makePluginManager());
    expect(ipcMain.handle).toHaveBeenCalledWith(CHANNELS.LIST_COMMANDS, expect.any(Function));
    expect(ipcMain.handle).toHaveBeenCalledWith(CHANNELS.EXECUTE_COMMAND, expect.any(Function));
  });

  it('LIST_COMMANDS 返回命令清单（id/title/pluginId，无 handler）', async () => {
    const ipcMain = { handle: jest.fn() };
    const pm = makePluginManager([
      { id: 'demo.hello', title: 'Hello', pluginId: 'demo', handler: () => {} },
      { id: 'demo.touch', title: 'Touch', pluginId: 'demo', handler: () => {} },
    ]);
    registerPluginIpc(ipcMain, pm);
    const handler = ipcMain.handle.mock.calls.find(([c]) => c === CHANNELS.LIST_COMMANDS)[1];

    const res = await handler();
    expect(res.ok).toBe(true);
    expect(res.commands).toEqual([
      { id: 'demo.hello', title: 'Hello', pluginId: 'demo' },
      { id: 'demo.touch', title: 'Touch', pluginId: 'demo' },
    ]);
    // 不透传 handler 函数
    expect(res.commands.every((c) => typeof c.handler === 'undefined')).toBe(true);
  });

  it('无插件系统时 LIST_COMMANDS 返回空清单', async () => {
    const ipcMain = { handle: jest.fn() };
    registerPluginIpc(ipcMain, null);
    const handler = ipcMain.handle.mock.calls.find(([c]) => c === CHANNELS.LIST_COMMANDS)[1];
    const res = await handler();
    expect(res).toEqual({ ok: true, commands: [] });
  });

  it('EXECUTE_COMMAND 委托 pluginManager.executeCommand 并返回结果', async () => {
    const ipcMain = { handle: jest.fn() };
    const pm = makePluginManager();
    registerPluginIpc(ipcMain, pm);
    const handler = ipcMain.handle.mock.calls.find(([c]) => c === CHANNELS.EXECUTE_COMMAND)[1];

    const res = await handler({}, 'demo.hello', ['world']);
    expect(pm.executeCommand).toHaveBeenCalledWith('demo.hello', ['world']);
    expect(res.ok).toBe(true);
    expect(res.result).toEqual({ pluginId: 'demo', commandId: 'demo.hello', result: { ok: true, args: ['world'] } });
  });

  it('EXECUTE_COMMAND args 非数组时兜底为空数组', async () => {
    const ipcMain = { handle: jest.fn() };
    const pm = makePluginManager();
    registerPluginIpc(ipcMain, pm);
    const handler = ipcMain.handle.mock.calls.find(([c]) => c === CHANNELS.EXECUTE_COMMAND)[1];

    await handler({}, 'demo.hello', undefined);
    expect(pm.executeCommand).toHaveBeenCalledWith('demo.hello', []);
  });

  it('EXECUTE_COMMAND 插件系统未初始化时返回错误', async () => {
    const ipcMain = { handle: jest.fn() };
    registerPluginIpc(ipcMain, null);
    const handler = ipcMain.handle.mock.calls.find(([c]) => c === CHANNELS.EXECUTE_COMMAND)[1];

    const res = await handler({}, 'demo.hello', []);
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/未初始化/);
  });

  it('EXECUTE_COMMAND 命令不存在时返回错误（不抛给 IPC）', async () => {
    const ipcMain = { handle: jest.fn() };
    const pm = makePluginManager();
    pm.executeCommand.mockRejectedValue(new Error('命令不存在: nope'));
    registerPluginIpc(ipcMain, pm);
    const handler = ipcMain.handle.mock.calls.find(([c]) => c === CHANNELS.EXECUTE_COMMAND)[1];

    const res = await handler({}, 'nope', []);
    expect(res.ok).toBe(false);
    expect(res.error).toBe('命令不存在: nope');
  });

  it('LIST_VIEWS 返回视图清单（id/title/type/pluginId，无 render）', async () => {
    const ipcMain = { handle: jest.fn() };
    const pm = makePluginManager([], [
      { id: 'demo.status', title: '状态', type: 'panel', pluginId: 'demo', render: () => {} },
    ]);
    registerPluginIpc(ipcMain, pm);
    const handler = ipcMain.handle.mock.calls.find(([c]) => c === CHANNELS.LIST_VIEWS)[1];

    const res = await handler();
    expect(res.ok).toBe(true);
    expect(res.views).toEqual([
      { id: 'demo.status', title: '状态', type: 'panel', pluginId: 'demo' },
    ]);
    expect(res.views.every((v) => typeof v.render === 'undefined')).toBe(true);
  });

  it('无插件系统时 LIST_VIEWS 返回空清单', async () => {
    const ipcMain = { handle: jest.fn() };
    registerPluginIpc(ipcMain, null);
    const handler = ipcMain.handle.mock.calls.find(([c]) => c === CHANNELS.LIST_VIEWS)[1];
    const res = await handler();
    expect(res).toEqual({ ok: true, views: [] });
  });

  it('RENDER_VIEW 委托 pluginManager.renderView 并返回 HTML', async () => {
    const ipcMain = { handle: jest.fn() };
    const pm = makePluginManager();
    registerPluginIpc(ipcMain, pm);
    const handler = ipcMain.handle.mock.calls.find(([c]) => c === CHANNELS.RENDER_VIEW)[1];

    const res = await handler({}, 'demo.status', { rid: 'r1' });
    expect(pm.renderView).toHaveBeenCalledWith('demo.status', { rid: 'r1' });
    expect(res.ok).toBe(true);
    expect(res.view).toEqual({ pluginId: 'demo', viewId: 'demo.status', title: 'View', type: 'panel', html: '<p>hi</p>' });
  });

  it('RENDER_VIEW 视图不存在时返回错误', async () => {
    const ipcMain = { handle: jest.fn() };
    const pm = makePluginManager();
    pm.renderView.mockRejectedValue(new Error('视图不存在: nope'));
    registerPluginIpc(ipcMain, pm);
    const handler = ipcMain.handle.mock.calls.find(([c]) => c === CHANNELS.RENDER_VIEW)[1];

    const res = await handler({}, 'nope', {});
    expect(res.ok).toBe(false);
    expect(res.error).toBe('视图不存在: nope');
  });

  it('INSTALL 委托 pluginManager.install', async () => {
    const ipcMain = { handle: jest.fn() };
    const pm = makePluginManager();
    pm.install = jest.fn(async (id, url, opts) => ({ id, version: '0.1.0', dir: '/d', state: 'loaded' }));
    registerPluginIpc(ipcMain, pm);
    const handler = ipcMain.handle.mock.calls.find(([c]) => c === CHANNELS.INSTALL)[1];

    const res = await handler({}, 'demo', 'https://example.com', { force: true });
    expect(pm.install).toHaveBeenCalledWith('demo', 'https://example.com', { force: true });
    expect(res.ok).toBe(true);
    expect(res.result.id).toBe('demo');
  });

  it('INSTALL 失败时返回错误', async () => {
    const ipcMain = { handle: jest.fn() };
    const pm = makePluginManager();
    pm.install = jest.fn(async () => { throw new Error('checksum 校验失败'); });
    registerPluginIpc(ipcMain, pm);
    const handler = ipcMain.handle.mock.calls.find(([c]) => c === CHANNELS.INSTALL)[1];

    const res = await handler({}, 'demo', 'https://example.com', {});
    expect(res.ok).toBe(false);
    expect(res.error).toBe('checksum 校验失败');
  });

  it('LIST_PLUGINS 返回管理面板插件清单（listForUi 策展形状）', async () => {
    const ipcMain = { handle: jest.fn() };
    const pm = makePluginManager();
    pm.listForUi.mockReturnValue([
      { id: 'demo', name: 'Demo', version: '0.1.0', state: 'activated', enabled: true },
    ]);
    registerPluginIpc(ipcMain, pm);
    const handler = ipcMain.handle.mock.calls.find(([c]) => c === CHANNELS.LIST_PLUGINS)[1];

    const res = await handler();
    expect(res.ok).toBe(true);
    expect(res.plugins).toEqual([
      { id: 'demo', name: 'Demo', version: '0.1.0', state: 'activated', enabled: true },
    ]);
  });

  it('无插件系统时 LIST_PLUGINS 返回空清单', async () => {
    const ipcMain = { handle: jest.fn() };
    registerPluginIpc(ipcMain, null);
    const handler = ipcMain.handle.mock.calls.find(([c]) => c === CHANNELS.LIST_PLUGINS)[1];
    const res = await handler();
    expect(res).toEqual({ ok: true, plugins: [] });
  });

  it('ENABLE 委托 pluginManager.enable', async () => {
    const ipcMain = { handle: jest.fn() };
    const pm = makePluginManager();
    registerPluginIpc(ipcMain, pm);
    const handler = ipcMain.handle.mock.calls.find(([c]) => c === CHANNELS.ENABLE)[1];

    const res = await handler({}, 'demo');
    expect(pm.enable).toHaveBeenCalledWith('demo');
    expect(res.ok).toBe(true);
  });

  it('ENABLE 插件系统未初始化时返回错误', async () => {
    const ipcMain = { handle: jest.fn() };
    registerPluginIpc(ipcMain, null);
    const handler = ipcMain.handle.mock.calls.find(([c]) => c === CHANNELS.ENABLE)[1];
    const res = await handler({}, 'demo');
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/未初始化/);
  });

  it('DISABLE 委托 pluginManager.disable', async () => {
    const ipcMain = { handle: jest.fn() };
    const pm = makePluginManager();
    registerPluginIpc(ipcMain, pm);
    const handler = ipcMain.handle.mock.calls.find(([c]) => c === CHANNELS.DISABLE)[1];

    const res = await handler({}, 'demo');
    expect(pm.disable).toHaveBeenCalledWith('demo');
    expect(res.ok).toBe(true);
  });

  it('DISABLE 失败时返回错误', async () => {
    const ipcMain = { handle: jest.fn() };
    const pm = makePluginManager();
    pm.disable.mockRejectedValue(new Error('插件未加载: demo'));
    registerPluginIpc(ipcMain, pm);
    const handler = ipcMain.handle.mock.calls.find(([c]) => c === CHANNELS.DISABLE)[1];

    const res = await handler({}, 'demo');
    expect(res.ok).toBe(false);
    expect(res.error).toBe('插件未加载: demo');
  });

  it('UNINSTALL 委托 pluginManager.uninstall', async () => {
    const ipcMain = { handle: jest.fn() };
    const pm = makePluginManager();
    pm.uninstall.mockResolvedValue({ ok: true, id: 'demo' });
    registerPluginIpc(ipcMain, pm);
    const handler = ipcMain.handle.mock.calls.find(([c]) => c === CHANNELS.UNINSTALL)[1];

    const res = await handler({}, 'demo');
    expect(pm.uninstall).toHaveBeenCalledWith('demo');
    expect(res.ok).toBe(true);
  });

  it('UNINSTALL 失败时返回错误', async () => {
    const ipcMain = { handle: jest.fn() };
    const pm = makePluginManager();
    pm.uninstall.mockRejectedValue(new Error('卸载失败'));
    registerPluginIpc(ipcMain, pm);
    const handler = ipcMain.handle.mock.calls.find(([c]) => c === CHANNELS.UNINSTALL)[1];

    const res = await handler({}, 'demo');
    expect(res.ok).toBe(false);
    expect(res.error).toBe('卸载失败');
  });

  it('GET_PLUGIN_CONFIG 返回插件用户配置', async () => {
    const ipcMain = { handle: jest.fn() };
    const pm = makePluginManager();
    pm.getConfig.mockReturnValue({ greeting: '你好' });
    registerPluginIpc(ipcMain, pm);
    const handler = ipcMain.handle.mock.calls.find(
      ([c]) => c === CHANNELS.GET_PLUGIN_CONFIG,
    )[1];

    const res = await handler({}, 'demo');
    expect(pm.getConfig).toHaveBeenCalledWith('demo');
    expect(res.ok).toBe(true);
    expect(res.config).toEqual({ greeting: '你好' });
  });

  it('SET_PLUGIN_CONFIG 委托 pluginManager.setConfig 并落盘', async () => {
    const ipcMain = { handle: jest.fn() };
    const pm = makePluginManager();
    pm.setConfig.mockReturnValue({ greeting: '你好' });
    registerPluginIpc(ipcMain, pm);
    const handler = ipcMain.handle.mock.calls.find(
      ([c]) => c === CHANNELS.SET_PLUGIN_CONFIG,
    )[1];

    const res = await handler({}, 'demo', 'greeting', '你好');
    expect(pm.setConfig).toHaveBeenCalledWith('demo', 'greeting', '你好');
    expect(res.ok).toBe(true);
    expect(res.config).toEqual({ greeting: '你好' });
  });

  it('SET_PLUGIN_CONFIG 失败时返回错误', async () => {
    const ipcMain = { handle: jest.fn() };
    const pm = makePluginManager();
    pm.setConfig.mockImplementation(() => { throw new Error('pluginStore 未注入'); });
    registerPluginIpc(ipcMain, pm);
    const handler = ipcMain.handle.mock.calls.find(
      ([c]) => c === CHANNELS.SET_PLUGIN_CONFIG,
    )[1];

    const res = await handler({}, 'demo', 'k', 'v');
    expect(res.ok).toBe(false);
    expect(res.error).toBe('pluginStore 未注入');
  });
});
