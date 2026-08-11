/**
 * extension-registry.cjs —— 扩展点注册表（Host 实现）
 *
 * 四套数据：
 *   1. 扩展点声明（纯数据，无 handler）—— 插件激活时经 contributes 解析注册，
 *      供 UI 层发现/展示（命令菜单、视图清单等）。
 *   2. 命令执行器（含 handler）—— 插件激活时经 ctx.extensions.registerCommands
 *      注册，供宿主 PluginManager.executeCommand 调用（命令执行 Runtime）。
 *   3. 视图渲染器（含 render）—— 插件激活时经 ctx.extensions.registerView 注册，
 *      render 返回 HTML 字符串，供宿主经白名单 IPC 交付渲染进程承载。
 *   4. 服务（含 api）—— 插件激活时经 ctx.extensions.registerService 注册，供
 *      其他插件经 ctx.extensions.getService 按服务 ID 消费（插件间通信）。
 *
 * 生命周期：
 *   - 插件激活时注册（contributes 解析 + ctx.extensions 动态注册）
 *   - 插件停用/卸载时按 pluginId 清理
 */
class ExtensionRegistry {
  constructor() {
    /** @type {Map<string, Array<object>>} type → ExtensionPoint[] */
    this._byType = new Map();
    /** @type {Map<string, object>} `${pluginId}:${type}:${id}` → ExtensionPoint */
    this._byKey = new Map();
    /** @type {Map<string, object>} commandId → { id, pluginId, title, handler } */
    this._commands = new Map();
    /** @type {Map<string, object>} viewId → { id, pluginId, title, type, render } */
    this._views = new Map();
    /** @type {Map<string, object>} serviceId → { id, pluginId, title, version, api } */
    this._services = new Map();
  }

  // ── 扩展点声明（纯数据） ──

  /**
   * 注册扩展点
   * @param {object} point — ExtensionPoint（纯数据）
   * @returns {object} 注册的扩展点
   * @throws {Error} 重复注册时抛错
   */
  register(point) {
    const key = this._key(point);
    if (this._byKey.has(key)) {
      throw new Error(`扩展点已存在: ${key}`);
    }
    if (!this._byType.has(point.type)) {
      this._byType.set(point.type, []);
    }
    this._byType.get(point.type).push(point);
    this._byKey.set(key, point);
    return point;
  }

  /**
   * 批量注册
   * @param {object[]} points
   * @returns {object[]}
   */
  registerAll(points = []) {
    const registered = [];
    for (const p of points) {
      try {
        registered.push(this.register(p));
      } catch (e) {
        console.error(`[extension-registry] ${e.message}`);
      }
    }
    return registered;
  }

  /** 卸载某插件的全部扩展点 */
  unregisterByPlugin(pluginId) {
    for (const [type, list] of this._byType) {
      const remaining = list.filter((p) => p.pluginId !== pluginId);
      if (remaining.length !== list.length) {
        this._byType.set(type, remaining);
      }
    }
    for (const [key, point] of this._byKey) {
      if (point.pluginId === pluginId) {
        this._byKey.delete(key);
      }
    }
    for (const [cmdId, cmd] of this._commands) {
      if (cmd.pluginId === pluginId) {
        this._commands.delete(cmdId);
      }
    }
    for (const [viewId, view] of this._views) {
      if (view.pluginId === pluginId) {
        this._views.delete(viewId);
      }
    }
    for (const [serviceId, service] of this._services) {
      if (service.pluginId === pluginId) {
        this._services.delete(serviceId);
      }
    }
  }

  // ── 命令执行器（含 handler） ──

  /**
   * 注册可执行命令（命令执行 Runtime）
   * @param {string} pluginId — 来源插件 ID
   * @param {Array<{ id: string, title?: string, handler: Function }>} defs — 命令定义
   * @returns {object[]} 注册成功的命令
   */
  registerCommands(pluginId, defs = []) {
    const registered = [];
    for (const def of defs) {
      if (!def || typeof def.id !== 'string' || !def.id) continue;
      if (typeof def.handler !== 'function') {
        console.error(`[extension-registry] 命令缺少 handler: ${pluginId}:commands:${def.id}`);
        continue;
      }
      if (this._commands.has(def.id)) {
        console.error(`[extension-registry] 命令已存在: ${def.id}`);
        continue;
      }
      const cmd = {
        id: def.id,
        pluginId,
        title: def.title || def.id,
        handler: def.handler,
      };
      this._commands.set(def.id, cmd);
      registered.push(cmd);
    }
    return registered;
  }

  /** 获取命令（含 handler） */
  getCommand(id) {
    return this._commands.get(id) || null;
  }

  /** 列出全部命令 */
  listCommands() {
    return Array.from(this._commands.values());
  }

  // ── 视图渲染器（含 render） ──

  /**
   * 注册可渲染视图（UI 挂载层）
   * @param {string} pluginId — 来源插件 ID
   * @param {Array<{ id: string, title?: string, type?: string, render: Function }>} defs
   * @returns {object[]} 注册成功的视图
   */
  registerViews(pluginId, defs = []) {
    const registered = [];
    for (const def of defs) {
      if (!def || typeof def.id !== 'string' || !def.id) continue;
      if (typeof def.render !== 'function') {
        console.error(`[extension-registry] 视图缺少 render: ${pluginId}:views:${def.id}`);
        continue;
      }
      if (this._views.has(def.id)) {
        console.error(`[extension-registry] 视图已存在: ${def.id}`);
        continue;
      }
      const view = {
        id: def.id,
        pluginId,
        title: def.title || def.id,
        type: def.type || 'panel',
        render: def.render,
      };
      this._views.set(def.id, view);
      registered.push(view);
    }
    return registered;
  }

  /** 获取视图（含 render） */
  getView(id) {
    return this._views.get(id) || null;
  }

  /** 列出全部视图 */
  listViews() {
    return Array.from(this._views.values());
  }

  // ── 服务（含 api，插件间通信） ──

  /**
   * 注册插件服务（供其他插件经 getService 消费）
   * @param {string} pluginId — 来源插件 ID
   * @param {Array<{ id: string, title?: string, version?: string, api: object }>} defs
   * @returns {object[]} 注册成功的服务
   */
  registerServices(pluginId, defs = []) {
    const registered = [];
    for (const def of defs) {
      if (!def || typeof def.id !== 'string' || !def.id) continue;
      if (!def.api || typeof def.api !== 'object') {
        console.error(`[extension-registry] 服务缺少 api: ${pluginId}:services:${def.id}`);
        continue;
      }
      if (this._services.has(def.id)) {
        console.error(`[extension-registry] 服务已存在: ${def.id}`);
        continue;
      }
      const service = {
        id: def.id,
        pluginId,
        title: def.title || def.id,
        version: def.version || '0.0.0',
        api: def.api,
      };
      this._services.set(def.id, service);
      registered.push(service);
    }
    return registered;
  }

  /**
   * 获取服务（含 api）
   * @returns {object|null} { id, pluginId, title, version, api }，不存在返回 null
   */
  getService(id) {
    return this._services.get(id) || null;
  }

  /**
   * 列出全部服务（元信息，不含 api）
   * @returns {object[]}
   */
  listServices() {
    return Array.from(this._services.values()).map((s) => ({
      id: s.id,
      pluginId: s.pluginId,
      title: s.title,
      version: s.version,
    }));
  }

  /** 统计 */
  count() {
    return this._byKey.size + this._commands.size + this._views.size + this._services.size;
  }

  /** 清空 */
  clear() {
    this._byType.clear();
    this._byKey.clear();
    this._commands.clear();
    this._views.clear();
    this._services.clear();
  }

  /** 按类型列出扩展点 */
  list(type) {
    if (type) {
      return this._byType.get(type) || [];
    }
    return Array.from(this._byKey.values());
  }

  /** 精确获取 */
  get(type, id, pluginId) {
    const key = pluginId ? this._key({ pluginId, type, id }) : `${type}:${id}`;
    return this._byKey.get(key) || null;
  }

  /** 某插件贡献的扩展点 */
  listByPlugin(pluginId) {
    return Array.from(this._byKey.values()).filter((p) => p.pluginId === pluginId);
  }

  _key(point) {
    return `${point.pluginId}:${point.type}:${point.id}`;
  }
}

module.exports = { ExtensionRegistry };
