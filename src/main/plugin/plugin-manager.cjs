/**
 * plugin-manager.cjs —— 插件管理器
 *
 * 职责：
 *   - 生命周期编排（load → activate → deactivate → dispose）
 *   - 插件注册表（id → 实例）
 *   - 构造插件 Context（注入 loImpl / logger / config）
 *   - 收集插件 contributes → 注册到 ExtensionRegistry
 *
 * 边界：
 *   - 插件经 ctx.lo（SDK 契约）调用 Host Adapter；Host 内部经 @lo/client 访问 Core
 *   - 插件不能直接访问 lo Core HTTP
 */
const { PluginLoader } = require('./plugin-loader.cjs');
const { createLoImpl } = require('./lo-adapter.cjs');
const { fromHost, AgentPluginContext, parseContributes } = require('@lo/agent-plugins-sdk');

class PluginManager {
  /**
   * @param {object} options
   * @param {string} options.pluginsDir — 插件根目录
   * @param {string} options.hostRequireBase — 解析 SDK 的基准路径
   * @param {import('../lo-core.cjs')} options.loCore — LoCoreService
   * @param {import('./extension-registry.cjs')} [options.extensionRegistry]
   * @param {object} [options.logger] — 宿主 logger
   */
  constructor(options) {
    this.pluginsDir = options.pluginsDir;
    this.loCore = options.loCore;
    this.logger = options.logger || console;
    this.loader = new PluginLoader(options.pluginsDir, options.hostRequireBase);
    /** @type {import('./extension-registry.cjs')} */
    this.extensionRegistry = options.extensionRegistry || null;
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
      // 收集插件 contributes → 注册扩展点（纯数据）
      if (this.extensionRegistry) {
        const points = parseContributes(entry.manifest);
        entry.extensionPoints = this.extensionRegistry.registerAll(points);
      }
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
    // 清理该插件注册的扩展点
    if (this.extensionRegistry) {
      this.extensionRegistry.unregisterByPlugin(id);
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
   * 构造插件 Context —— 用 SDK AgentPluginContext 实例化
   *
   * 注入：
   *   - loImpl（ctx.lo 实现，Host Adapter）→ LoCoreService → @lo/client
   *   - extensionsImpl（ctx.extensions 实现）→ ExtensionRegistry.registerCommands
   *   - configValues（manifest.config 默认值）
   *   - logger
   *
   * SDK 定义契约；Host 提供实现。
   */
  _createContext(entry) {
    const schema = entry.manifest.config || {};
    const configValues = {};
    for (const [k, def] of Object.entries(schema)) {
      configValues[k] = def && def.default !== undefined ? def.default : undefined;
    }
    return new AgentPluginContext({
      pluginId: entry.id,
      loImpl: createLoImpl(this.loCore),
      extensionsImpl: {
        registerCommands: (defs) => this._registerCommands(entry.id, defs),
      },
      logger: fromHost(this.logger).child({ plugin: entry.id }),
      configValues,
    });
  }

  /**
   * 将插件的命令注册到 ExtensionRegistry
   * @param {string} pluginId
   * @param {Array} defs — [{ id, title?, handler }]
   */
  _registerCommands(pluginId, defs) {
    if (!this.extensionRegistry) {
      throw new Error(`[plugin] 命令注册失败：extensionRegistry 未注入 (${pluginId})`);
    }
    return this.extensionRegistry.registerCommands(pluginId, defs);
  }

  /**
   * 执行插件命令（命令执行 Runtime）
   * @param {string} commandId — 命令 ID（如 'demo-hello.hello'）
   * @param {Array} [args] — 传给 handler 的参数数组
   * @returns {Promise<{ pluginId: string, commandId: string, result: any }>}
   */
  async executeCommand(commandId, args = []) {
    if (!this.extensionRegistry) {
      throw new Error('extensionRegistry 未注入，无法执行命令');
    }
    const cmd = this.extensionRegistry.getCommand(commandId);
    if (!cmd) {
      throw new Error(`命令不存在: ${commandId}`);
    }
    const entry = this._registry.get(cmd.pluginId);
    if (!entry) {
      throw new Error(`插件未加载: ${cmd.pluginId}`);
    }
    if (entry.state !== 'activated') {
      throw new Error(`插件未激活: ${cmd.pluginId}`);
    }
    const result = await cmd.handler(args, entry.plugin.context);
    return { pluginId: cmd.pluginId, commandId, result };
  }
}

module.exports = { PluginManager };
