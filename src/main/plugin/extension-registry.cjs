/**
 * extension-registry.cjs —— 扩展点注册表（Host 实现）
 *
 * 两套数据：
 *   1. 扩展点声明（纯数据，无 handler）—— 插件激活时经 contributes 解析注册，
 *      供 UI 层发现/展示（命令菜单、视图清单等）。
 *   2. 命令执行器（含 handler）—— 插件激活时经 ctx.extensions.registerCommands
 *      注册，供宿主 PluginManager.executeCommand 调用（命令执行 Runtime）。
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

  /** 统计 */
  count() {
    return this._byKey.size + this._commands.size;
  }

  /** 清空 */
  clear() {
    this._byType.clear();
    this._byKey.clear();
    this._commands.clear();
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
