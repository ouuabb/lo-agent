/**
 * plugin-host.cjs —— 插件 Host API 门面
 *
 * 插件通过 ctx.host 调用 lo-agent 主进程能力；Host 内部经 @lo/client 访问 lo Core。
 *
 * 边界原则：
 *   - 插件不能直接访问 lo Core HTTP
 *   - 插件不能拿到 LoClient 原始实例
 *   - 只暴露 LoCoreService 的受控方法（白名单）
 */

/**
 * 构造 Host API 门面
 * @param {import('../lo-core.cjs')} loCore — LoCoreService 实例
 * @returns {object} 插件可见的 host API
 */
function createPluginHost(loCore) {
  return {
    /** 仓库状态 */
    getStatus: () => loCore.getStatus(),
    /** 资源列表 */
    listNotes: (query) => loCore.listNotes(query || {}),
    /** 单个资源 */
    getNote: (rid) => loCore.getNote(rid),
    /** 更新资源（Operation 语义） */
    updateNote: (rid, body) => loCore.updateNote(rid, body || {}),
    /** 关联关系 */
    getRelations: (rid) => loCore.getRelations(rid),
    /** 操作历史 */
    listOperations: (query) => loCore.listOperations(query || {}),
    /** 撤销操作 */
    undoOperation: (id) => loCore.undoOperation(id),
    /** 订阅 Core 事件（SSE） */
    subscribeEvents: (types, handler) => loCore.subscribeEvents(types || [], handler),
    /** 关闭事件订阅 */
    unsubscribeEvents: () => loCore.unsubscribeEvents(),
    /** 是否已连接/登录 */
    isAuthenticated: () => !!loCore.client && loCore.client.auth.authenticated,
  };
}

module.exports = { createPluginHost };
