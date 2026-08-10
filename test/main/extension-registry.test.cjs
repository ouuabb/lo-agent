const { ExtensionRegistry } = require('../../src/main/plugin/extension-registry.cjs');

describe('ExtensionRegistry', () => {
  it('注册/查询扩展点', () => {
    const reg = new ExtensionRegistry();
    reg.register({ pluginId: 'demo', type: 'commands', id: 'demo.open', title: '打开' });
    reg.register({ pluginId: 'demo', type: 'views', id: 'demo.panel', title: '面板' });

    expect(reg.count()).toBe(2);
    expect(reg.list('commands')).toHaveLength(1);
    expect(reg.list()).toHaveLength(2);
    expect(reg.get('commands', 'demo.open', 'demo')).toMatchObject({
      pluginId: 'demo',
      type: 'commands',
      id: 'demo.open',
    });
  });

  it('重复注册抛错', () => {
    const reg = new ExtensionRegistry();
    reg.register({ pluginId: 'demo', type: 'commands', id: 'x' });
    expect(() => reg.register({ pluginId: 'demo', type: 'commands', id: 'x' })).toThrow(/已存在/);
  });

  it('registerAll 跳过冲突', () => {
    const reg = new ExtensionRegistry();
    reg.register({ pluginId: 'a', type: 'commands', id: 'x' });
    const points = reg.registerAll([
      { pluginId: 'a', type: 'commands', id: 'x' }, // 冲突
      { pluginId: 'a', type: 'views', id: 'y' },
    ]);
    expect(points).toHaveLength(1);
    expect(reg.count()).toBe(2);
  });

  it('unregisterByPlugin 清理某插件全部扩展点', () => {
    const reg = new ExtensionRegistry();
    reg.register({ pluginId: 'a', type: 'commands', id: 'x' });
    reg.register({ pluginId: 'a', type: 'views', id: 'y' });
    reg.register({ pluginId: 'b', type: 'commands', id: 'z' });
    reg.unregisterByPlugin('a');
    expect(reg.count()).toBe(1);
    expect(reg.listByPlugin('a')).toEqual([]);
    expect(reg.listByPlugin('b')).toHaveLength(1);
  });

  it('listByPlugin 列出某插件贡献', () => {
    const reg = new ExtensionRegistry();
    reg.register({ pluginId: 'a', type: 'commands', id: 'x' });
    reg.register({ pluginId: 'b', type: 'commands', id: 'z' });
    expect(reg.listByPlugin('a')).toHaveLength(1);
  });

  it('clear 清空', () => {
    const reg = new ExtensionRegistry();
    reg.register({ pluginId: 'a', type: 'commands', id: 'x' });
    reg.clear();
    expect(reg.count()).toBe(0);
  });

  it('registerCommands 注册可执行命令（含 handler）', () => {
    const reg = new ExtensionRegistry();
    const handler = jest.fn();
    const defs = [
      { id: 'demo.hello', title: 'Hello', handler },
      { id: 'demo.skip', handler: 'not-a-function' }, // 缺 handler → 跳过
    ];
    const registered = reg.registerCommands('demo', defs);
    expect(registered).toHaveLength(1);
    expect(reg.count()).toBe(1);

    const cmd = reg.getCommand('demo.hello');
    expect(cmd).toMatchObject({ id: 'demo.hello', pluginId: 'demo', title: 'Hello' });
    expect(typeof cmd.handler).toBe('function');
    expect(reg.getCommand('demo.skip')).toBeNull();
    expect(reg.listCommands()).toHaveLength(1);
  });

  it('registerCommands 重复 ID 跳过', () => {
    const reg = new ExtensionRegistry();
    reg.registerCommands('a', [{ id: 'dup', handler: () => 1 }]);
    const reg2 = reg.registerCommands('b', [{ id: 'dup', handler: () => 2 }]);
    expect(reg2).toHaveLength(0);
    expect(reg.getCommand('dup').pluginId).toBe('a');
  });

  it('unregisterByPlugin 同时清理命令', () => {
    const reg = new ExtensionRegistry();
    reg.registerCommands('a', [{ id: 'a.cmd', handler: () => 1 }]);
    reg.registerCommands('b', [{ id: 'b.cmd', handler: () => 2 }]);
    reg.unregisterByPlugin('a');
    expect(reg.getCommand('a.cmd')).toBeNull();
    expect(reg.getCommand('b.cmd')).not.toBeNull();
    expect(reg.count()).toBe(1);
  });

  it('clear 清空命令', () => {
    const reg = new ExtensionRegistry();
    reg.registerCommands('a', [{ id: 'a.cmd', handler: () => 1 }]);
    reg.clear();
    expect(reg.getCommand('a.cmd')).toBeNull();
    expect(reg.count()).toBe(0);
  });

  it('registerViews 注册视图（含 render）', () => {
    const reg = new ExtensionRegistry();
    const render = jest.fn(() => '<p>hi</p>');
    const registered = reg.registerViews('demo', [
      { id: 'demo.status', title: '状态', type: 'panel', render },
      { id: 'demo.bad', render: 'not-fn' }, // 缺 render → 跳过
    ]);
    expect(registered).toHaveLength(1);

    const view = reg.getView('demo.status');
    expect(view).toMatchObject({ id: 'demo.status', pluginId: 'demo', title: '状态', type: 'panel' });
    expect(typeof view.render).toBe('function');
    expect(reg.getView('demo.bad')).toBeNull();
    expect(reg.listViews()).toHaveLength(1);
  });

  it('registerViews 重复 ID 跳过', () => {
    const reg = new ExtensionRegistry();
    reg.registerViews('a', [{ id: 'dup', render: () => 1 }]);
    const reg2 = reg.registerViews('b', [{ id: 'dup', render: () => 2 }]);
    expect(reg2).toHaveLength(0);
    expect(reg.getView('dup').pluginId).toBe('a');
  });

  it('unregisterByPlugin 同时清理视图，clear 清空', () => {
    const reg = new ExtensionRegistry();
    reg.registerViews('a', [{ id: 'a.view', render: () => 1 }]);
    reg.registerViews('b', [{ id: 'b.view', render: () => 2 }]);
    reg.unregisterByPlugin('a');
    expect(reg.getView('a.view')).toBeNull();
    expect(reg.getView('b.view')).not.toBeNull();
    reg.clear();
    expect(reg.listViews()).toHaveLength(0);
  });
});
