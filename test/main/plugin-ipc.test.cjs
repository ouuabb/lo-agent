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
});
