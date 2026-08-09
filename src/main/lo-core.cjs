/**
 * lo-core.cjs —— lo 核心连接服务（主进程）
 *
 * 封装 @lo/client，向渲染进程提供受控能力：
 *   - configure:   配置仓库地址(host/port/protocol)
 *   - login:       SSH 挑战-应答登录(支持私钥路径或手动 nonce/signature)
 *   - getStatus:   获取 repo 状态(stats)
 *   - listNotes:   获取资源列表
 *
 * 全部方法返回可序列化数据；网络/业务错误统一转成 { error, message } 结构，
 * 避免把 Error 实例直接抛给 IPC。
 */
const { LoClient, LoApiError, LoHttpError } = require('@lo/client');

const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_PORT = 8765;

class LoCoreService {
  /**
   * @param {object} [deps]
   * @param {Function} [deps.LoClient]  — 便于测试注入 mock
   * @param {Function} [deps.loadConfig] — 返回持久化配置的对象
   */
  constructor(deps = {}) {
    this._Client = deps.LoClient || LoClient;
    this._loadConfig = deps.loadConfig || (() => ({}));
    this.client = null;
    this.config = {};
  }

  /** 读取持久化配置并预填当前配置 */
  load() {
    this.config = this._loadConfig() || {};
    return this.config;
  }

  /**
   * 配置仓库地址
   * @param {object} cfg — { host, port, protocol }
   * @returns {{ ok: true, config }}
   */
  configure(cfg = {}) {
    const host = cfg.host || DEFAULT_HOST;
    const port = cfg.port === undefined ? DEFAULT_PORT : Number(cfg.port);
    const protocol = cfg.protocol || 'http';
    const timeout = cfg.timeout === undefined ? 15000 : Number(cfg.timeout);

    const config = { host, port, protocol, timeout };
    this.config = config;
    this.client = new this._Client(config);
    return { ok: true, config };
  }

  /** 是否已配置 */
  get configured() {
    return !!this.client;
  }

  /**
   * SSH 登录
   * @param {object} [params] — { privateKeyPath?, nonce?, signature?, fingerprint? }
   */
  async login(params = {}) {
    try {
      this._ensureClient();
      const result = await this.client.login(params);
      return { ok: true, token: result.token, fingerprint: result.fingerprint || null };
    } catch (e) {
      return this._toError(e);
    }
  }

  /** 获取 repo 状态(stats) */
  async getStatus() {
    try {
      this._ensureClient();
      const stats = await this.client.health.stats();
      return { ok: true, stats };
    } catch (e) {
      return this._toError(e);
    }
  }

  /**
   * 获取资源列表
   * @param {object} [query] — { type, schema, limit, offset }
   */
  async listNotes(query = {}) {
    try {
      this._ensureClient();
      const result = await this.client.notes.list(query);
      return { ok: true, total: result.total, data: result.data };
    } catch (e) {
      return this._toError(e);
    }
  }

  /** 登出(清除本地 token) */
  logout() {
    if (this.client) this.client.logout();
    return { ok: true };
  }

  _ensureClient() {
    if (!this.client) {
      throw new Error('请先配置仓库地址（configure）');
    }
  }

  _toError(e) {
    if (e instanceof LoApiError) {
      return {
        ok: false,
        error: 'api',
        status: e.status,
        message: e.message,
      };
    }
    if (e instanceof LoHttpError) {
      return {
        ok: false,
        error: 'http',
        code: e.code,
        message: e.message,
      };
    }
    return { ok: false, error: 'unknown', message: e.message || String(e) };
  }
}

module.exports = { LoCoreService, DEFAULT_HOST, DEFAULT_PORT };
