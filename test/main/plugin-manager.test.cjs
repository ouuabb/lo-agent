const fs = require('fs');
const os = require('os');
const path = require('path');
const { PluginManager } = require('../../src/main/plugin/plugin-manager.cjs');

function makeLoCore() {
  return {
    getStatus: jest.fn(async () => ({ ok: true, stats: { totalResources: 3 } })),
    listNotes: jest.fn(async () => ({ ok: true, data: [] })),
    getNote: jest.fn(async () => ({ ok: true, data: {} })),
    updateNote: jest.fn(async () => ({ ok: true })),
    getRelations: jest.fn(async () => ({ ok: true, data: { outgoing: [], incoming: [] } })),
    listOperations: jest.fn(async () => ({ ok: true, data: [] })),
    undoOperation: jest.fn(async () => ({ ok: true })),
    subscribeEvents: jest.fn(() => ({ ok: true })),
    unsubscribeEvents: jest.fn(() => ({ ok: true })),
    client: { auth: { authenticated: true } },
  };
}

function makePluginsDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lo-plugins-test-'));
  return dir;
}

function writePlugin(dir, id, mainContent) {
  const pluginDir = path.join(dir, id);
  fs.mkdirSync(pluginDir, { recursive: true });
  fs.writeFileSync(
    path.join(pluginDir, 'plugin.json'),
    JSON.stringify({ id, name: id, version: '0.1.0', main: 'index.cjs' }),
  );
  fs.writeFileSync(path.join(pluginDir, 'index.cjs'), mainContent);
  return pluginDir;
}

// 插件入口 require SDK（经 lo-agent node_modules 解析）
const SDK_INDEX = path.join(__dirname, '..', '..', 'node_modules', '@lo', 'agent-plugins-sdk', 'src', 'index.cjs');

describe('PluginManager', () => {
  it('发现并加载插件', async () => {
    const dir = makePluginsDir();
    writePlugin(dir, 'demo-a', `
      const { AgentPlugin } = require(${JSON.stringify(SDK_INDEX)});
      class P extends AgentPlugin {
        manifest() { return { id: 'demo-a', name: 'Demo A', version: '0.1.0', main: 'index.cjs' }; }
        activate() {}
      }
      module.exports = P;
    `);
    const pm = new PluginManager({
      pluginsDir: dir,
      hostRequireBase: path.join(__dirname, '..', '..', 'src', 'main'),
      loCore: makeLoCore(),
    });
    await pm.initialize();
    const list = pm.list();
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe('demo-a');
    expect(list[0].state).toBe('loaded');
  });

  it('激活插件并注入 host 能力，插件可调用 Host API', async () => {
    const dir = makePluginsDir();
    writePlugin(dir, 'demo-b', `
      const { AgentPlugin } = require(${JSON.stringify(SDK_INDEX)});
      class P extends AgentPlugin {
        manifest() { return { id: 'demo-b', name: 'Demo B', version: '0.1.0', main: 'index.cjs' }; }
        async activate(ctx) {
          const res = await ctx.host.getStatus();
          this._r = { status: res && res.ok ? res.stats : null, pluginId: ctx.pluginId };
        }
      }
      module.exports = P;
    `);
    const loCore = makeLoCore();
    const pm = new PluginManager({
      pluginsDir: dir,
      hostRequireBase: path.join(__dirname, '..', '..', 'src', 'main'),
      loCore,
    });
    await pm.initialize();
    await pm.activate('demo-b');
    const plugin = pm.get('demo-b');
    expect(plugin._r).toEqual({ status: { totalResources: 3 }, pluginId: 'demo-b' });
    expect(loCore.getStatus).toHaveBeenCalled();
  });

  it('激活失败不阻塞其他插件', async () => {
    const dir = makePluginsDir();
    writePlugin(dir, 'bad', `
      class P {
        manifest() { return { id: 'bad', name: 'Bad', version: '0.1.0', main: 'index.cjs' }; }
        async activate() { throw new Error('boom'); }
      }
      module.exports = P;
    `);
    writePlugin(dir, 'good', `
      const { AgentPlugin } = require(${JSON.stringify(SDK_INDEX)});
      class P extends AgentPlugin {
        manifest() { return { id: 'good', name: 'Good', version: '0.1.0', main: 'index.cjs' }; }
        async activate(ctx) { this._ok = true; }
      }
      module.exports = P;
    `);
    const pm = new PluginManager({
      pluginsDir: dir,
      hostRequireBase: path.join(__dirname, '..', '..', 'src', 'main'),
      loCore: makeLoCore(),
    });
    await pm.initialize();
    await pm.activateAll();
    expect(pm.get('good')._ok).toBe(true);
    const list = pm.list();
    expect(list.find((x) => x.id === 'bad').state).toBe('loaded');
  });

  it('deactivate 与 dispose 生命周期', async () => {
    const dir = makePluginsDir();
    writePlugin(dir, 'demo-c', `
      const { AgentPlugin } = require(${JSON.stringify(SDK_INDEX)});
      class P extends AgentPlugin {
        manifest() { return { id: 'demo-c', name: 'Demo C', version: '0.1.0', main: 'index.cjs' }; }
        async activate() { this._activated = true; }
        async deactivate() { this._deactivated = true; }
        async dispose() { this._disposed = true; }
      }
      module.exports = P;
    `);
    const pm = new PluginManager({
      pluginsDir: dir,
      hostRequireBase: path.join(__dirname, '..', '..', 'src', 'main'),
      loCore: makeLoCore(),
    });
    await pm.initialize();
    await pm.activate('demo-c');
    await pm.deactivate('demo-c');
    const plugin = pm.get('demo-c');
    expect(plugin._activated).toBe(true);
    expect(plugin._deactivated).toBe(true);
    await pm.dispose('demo-c');
    expect(pm.get('demo-c')).toBeNull();
  });
});
