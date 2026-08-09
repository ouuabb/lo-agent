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
});
