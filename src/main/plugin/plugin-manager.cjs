/**
 * plugin-manager.cjs —— 插件管理器
 *
 * 职责：
 *   - 生命周期编排（load → activate → deactivate → dispose）
 *   - 插件注册表（id → 实例）
 *   - 构造插件 Context（注入 host API / logger / config）
 *
 * 边界：
 *   - 插件经 ctx.host 调用 Host API；Host 内部经 @lo/client 访问 Core
 *   - 插件不能直接访问 lo Core HTTP
 */
const { PluginLoader } = require('./plugin-loader.cjs');
const { createPluginHost } = require('./plugin-host.cjs');
const { fromHost } = require('@lo/agent-plugins-sdk');

class PluginManager {
  /**
   * @param {object} options
   * @param {string} options.pluginsDir — 插件根目录
   * @param {string} options.hostRequireBase — 解析 SDK 的基准路径
   * @param {import('../lo-core.cjs')} options.loCore — LoCoreService
   * @param {object} [options.logger] — 宿主 logger
   */
  constructor(options) {
    this.pluginsDir = options.pluginsDir;
    this.loCore = options.loCore;
    this.logger = options.logger || console;
    this.loader = new PluginLoader(options.pluginsDir, options.hostRequireBase);
    /** @type {Map<string, { plugin, manifest, dir, state }>} */
    this._registry = new Map();
  }

  /** 扫描并加载全部插件（发现 → 加载 → 实例化） */
  async initialize() {
    const loaded = await this.loader.loadAll();
    for (const { id, manifest, dir, plugin } of loaded) {
      this._registry.set(id, { id, plugin, manifest, dir, state: 'loaded' });
    }
    return this.list();
  }

  /** 激活单个插件（构造 context + activate） */
  async activate(id) {
    const entry = this._registry.get(id);
    if (!entry) throw new Error(`插件未加载: ${id}`);
    if (entry.state === 'activated') return;

    const ctx = this._createContext(entry);
    if (typeof entry.plugin.$setContext === 'function') {
      entry.plugin.$setContext(ctx);
    } else {
      entry.plugin.context = ctx;
    }

    try {
      await entry.plugin.activate(ctx);
      entry.state = 'activated';
    } catch (e) {
      console.error(`[plugin] 激活失败 ${id}: ${e.message}`);
      throw e;
    }
  }

  /** 激活全部已加载插件 */
  async activateAll() {
    for (const id of this._registry.keys()) {
      try {
        await this.activate(id);
      } catch (e) {
        // 错误隔离：单插件激活失败不影响其他
        console.error(`[plugin] 跳过 ${id}: ${e.message}`);
      }
    }
    return this.list();
  }

  /** 停用激活 */
  async deactivate(id) {
    const entry = this._registry.get(id);
    if (!entry || entry.state !== 'activated') return;
    if (typeof entry.plugin.deactivate === 'function') {
      await entry.plugin.deactivate();
    }
    entry.state = 'deactivated';
  }

  /** 停用全部 */
  async deactivateAll() {
    for (const id of this._registry.keys()) {
      try {
        await this.deactivate(id);
      } catch (e) {
        console.error(`[plugin] 停用失败 ${id}: ${e.message}`);
      }
    }
  }

  /** 销毁插件 */
  async dispose(id) {
    const entry = this._registry.get(id);
    if (!entry) return;
    if (typeof entry.plugin.dispose === 'function') {
      await entry.plugin.dispose();
    }
    this._registry.delete(id);
  }

  /** 销毁全部 */
  async disposeAll() {
    for (const id of Array.from(this._registry.keys())) {
      try {
        await this.dispose(id);
      } catch (e) {
        console.error(`[plugin] 销毁失败 ${id}: ${e.message}`);
      }
    }
  }

  /** 列出插件 */
  list() {
    return Array.from(this._registry.entries()).map(([id, e]) => ({
      id,
      name: e.manifest.name || id,
      version: e.manifest.version,
      state: e.state,
      manifest: e.manifest,
    }));
  }

  /** 获取插件实例 */
  get(id) {
    const e = this._registry.get(id);
    return e ? e.plugin : null;
  }

  /**
   * 构造插件 Context
   * 注入 host API（Host 门面）——插件经此访问 Core，禁止直连。
   * config 提供 SDK 语义的方法（key 读取 / 不传返回全部，带默认值合并）。
   */
  _createContext(entry) {
    const schema = entry.manifest.config || {};
    const values = {};
    for (const [k, def] of Object.entries(schema)) {
      values[k] = def && def.default !== undefined ? def.default : undefined;
    }
    return {
      pluginId: entry.id,
      host: createPluginHost(this.loCore),
      logger: fromHost(this.logger).child({ plugin: entry.id }),
      config: (key, defaultValue) => {
        if (key === undefined) return values;
        return values[key] !== undefined ? values[key] : defaultValue;
      },
    };
  }
}

module.exports = { PluginManager };
