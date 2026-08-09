/**
 * demo-hello 插件 —— 最小可用闭环验证
 *
 * 链路：发现 → 加载 → 初始化 → 调用 Host 能力 → 返回结果
 *
 * 插件只能经 ctx.host 调用 Host API；Host 内部经 @lo/client 访问 lo Core。
 */
const { AgentPlugin } = require('@lo/agent-plugins-sdk');

class DemoHelloPlugin extends AgentPlugin {
  manifest() {
    return {
      id: 'demo-hello',
      name: 'Demo Hello',
      version: '0.1.0',
      main: 'index.cjs',
    };
  }

  async activate(ctx) {
    const greeting = ctx.config('greeting', 'Hello from demo plugin');
    ctx.logger.info(`[demo-hello] ${greeting}`);

    // 调用 Host 能力：获取仓库状态（若已连接/登录）
    let status = null;
    try {
      const res = await ctx.host.getStatus();
      if (res && res.ok) {
        status = res.stats;
      }
    } catch (e) {
      ctx.logger.warn(`[demo-hello] 获取状态失败: ${e.message}`);
    }

    // 记录激活结果到插件上下文（供验证）
    this._activationResult = {
      greeting,
      status: status
        ? { totalResources: status.totalResources, totalRelations: status.totalRelations }
        : null,
      authenticated: ctx.host.isAuthenticated ? ctx.host.isAuthenticated() : false,
    };

    ctx.logger.info(
      `[demo-hello] 激活完成: ${JSON.stringify(this._activationResult)}`,
    );
  }

  get result() {
    return this._activationResult || null;
  }

  async deactivate() {
    this._activationResult = null;
  }
}

module.exports = DemoHelloPlugin;
