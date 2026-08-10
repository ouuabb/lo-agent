/**
 * demo-hello 插件 —— 最小可用闭环验证
 *
 * 链路：发现 → 加载 → 初始化 → 经 ctx.lo 调用 Core 能力 → 返回结果
 *
 * 插件只能经 ctx.lo（SDK 契约）调用 Host Adapter；Host 内部经 @lo/client 访问 lo Core。
 */
const { AgentPlugin } = require('@lo/agent-plugins-sdk');

class DemoHelloPlugin extends AgentPlugin {
  manifest() {
    return {
      id: 'demo-hello',
      name: 'Demo Hello',
      version: '0.1.0',
      main: 'index.cjs',
      config: {
        greeting: {
          type: 'string',
          default: 'Hello from demo plugin',
          description: '插件问候语',
        },
      },
    };
  }

  async activate(ctx) {
    const greeting = ctx.config('greeting', 'Hello from demo plugin');
    ctx.logger.info(`[demo-hello] ${greeting}`);

    // 经 ctx.lo（SDK 契约）调用 Host Adapter → LoCoreService → @lo/client → lo Core
    let status = null;
    try {
      const stats = await ctx.lo.health.stats();
      if (stats) {
        status = {
          totalResources: stats.totalResources,
          totalRelations: stats.totalRelations,
        };
      }
    } catch (e) {
      ctx.logger.warn(`[demo-hello] 获取状态失败: ${e.message}`);
    }

    // 注册可执行命令（命令执行 Runtime）
    // handler 签名：async (args, ctx) => result
    ctx.extensions.registerCommands([
      {
        id: 'demo-hello.hello',
        title: 'Demo: Hello',
        handler: async (args, cmdCtx) => {
          const who = args[0] || 'world';
          const cfg = cmdCtx.config('greeting', greeting);
          return { message: `${cfg}, ${who}!`, status };
        },
      },
    ]);

    // 记录激活结果到插件上下文（供验证）
    this._activationResult = { greeting, status };

    ctx.logger.info(`[demo-hello] 激活完成: ${JSON.stringify(this._activationResult)}`);
  }

  get result() {
    return this._activationResult || null;
  }

  async deactivate() {
    this._activationResult = null;
  }
}

module.exports = DemoHelloPlugin;
