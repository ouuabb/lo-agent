# lo-agent

lo Agent 桌面端（Electron）。通过 `@lo/client` 连接 lo 核心（`log serve` 的 HTTP 协议），
实现仓库地址配置、SSH 登录、状态查看与资源浏览。

## 功能

- **仓库地址**：配置 `host` / `port` / `protocol`（持久化到 `userData/lo-agent.json`）
- **登录 / 认证**：SSH 挑战-应答（`login({ privateKeyPath })` 或手动 `nonce/signature/fingerprint`）
- **仓库状态**：`GET /api/stats`（资源数、关系数等）
- **资源列表**：`GET /api/notes`（分页 / 类型过滤）

## 开发

```bash
npm install
npm run dev     # Vite(5173) + Electron(HMR)
npm run build   # 构建渲染进程到 dist/
npm start       # 生产模式启动
```

## 测试与规范

```bash
npm test       # Jest(覆盖率默认开启)
npm run lint   # ESLint(src/**/*.{cjs,jsx} + test)
npm run format # Prettier
```

## 架构

```
src/
  main/
    index.cjs          主进程入口(BrowserWindow + IPC 装配)
    lo-core.cjs        LoCoreService:configure/login/getStatus/listNotes(经 @lo/client)
    ipc.cjs           ipcMain.handle 白名单通道注册
    config-store.cjs  配置持久化(userData/lo-agent.json)
  preload/
    index.cjs          contextBridge 暴露 window.loAgent.loCore(仅受控方法)
  renderer/
    src/App.jsx        连接表单 + 登录 + 状态 + 资源列表
test/
  main/lo-core.test.cjs / ipc.test.cjs / config-store.test.cjs / index.test.cjs
  preload/index.test.cjs
```

## IPC 通道

| 通道 | 参数 | 说明 |
|---|---|---|
| `lo-core:config` | - | 读取持久化配置 |
| `lo-core:configure` | `{ host, port, protocol }` | 配置仓库地址并创建客户端 |
| `lo-core:login` | `{ privateKeyPath?, nonce?, signature?, fingerprint? }` | SSH 登录 |
| `lo-core:status` | - | 获取仓库状态(stats) |
| `lo-core:list-notes` | `{ type?, schema?, limit?, offset? }` | 资源列表 |
| `lo-core:logout` | - | 本地登出 |

## 安全基线

- `contextIsolation: true`、`nodeIntegration: false`、`sandbox: true`
- 渲染进程不接触 Node/网络，一律经 preload 的 `window.loAgent.loCore` 调用白名单 IPC
- 主进程仅转发方法调用，不透传任意 IPC 处理函数