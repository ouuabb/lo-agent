/**
 * extension-registry.cjs —— 扩展点注册表（Host 实现）
 *
 * 收集/管理插件声明的扩展点（纯数据，无 handler）。
 * 执行能力（命令执行、视图渲染）由后续 Runtime 阶段管理，本阶段只做注册与查询。
 *
 * 生命周期：
 *   - 插件激活时注册（manifest.contributes 解析）
 *   - 插件停用/卸载时按 pluginId 清理
 */
class ExtensionRegistry {
  constructor() {
    /** @type {Map<string, Array<object>>} type → ExtensionPoint[] */
    this._byType = new Map();
    /** @type {Map<string, object>} `${pluginId}:${type}:${id}` → ExtensionPoint */
    this._byKey = new Map();
  }

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

  /** 统计 */
  count() {
    return this._byKey.size;
  }

  /** 清空 */
  clear() {
    this._byType.clear();
    this._byKey.clear();
  }

  _key(point) {
    return `${point.pluginId}:${point.type}:${point.id}`;
  }
}

module.exports = { ExtensionRegistry };
