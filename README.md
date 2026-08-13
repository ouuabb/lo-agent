# lo-agent

lo Agent 桌面端（Electron）。作为 lo Core 的**薄客户端**，通过 `@lo/client` 连接
lo 核心（`log serve` 的 HTTP 协议），实现仓库地址配置、SSH 登录、状态查看、资源浏览、
编辑、实时事件刷新、操作历史与关联关系展示，并作为**插件宿主**承载客户端插件。

## 功能

- **仓库地址**：配置 `host` / `port` / `protocol`（持久化到 `userData/lo-agent.json`）
- **登录 / 认证**：SSH 挑战-应答（`login({ privateKeyPath })` 或手动 `nonce/signature/fingerprint`）
- **仓库状态**：`GET /api/stats`（资源数、关系数等）
- **资源浏览 / 编辑**：资源列表、Monaco 编辑器、保存经 Operation 语义
- **实时刷新**：经 `@lo/client.events`（SSE）订阅 `resource.created/updated/deleted` 自动刷新列表
- **操作历史**：Operation History 面板 + 撤销（`operations.undo`）
- **关联关系**：资源编辑区展示 outgoing / incoming relations
- **内置文档**：菜单「文档」入口，`react-markdown` 渲染 `src/renderer/src/docs/content/`
- **插件宿主**：加载 `{userData}/plugins/` 下的客户端插件，含命令面板、视图面板与插件管理面板（见「插件宿主」）

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
    index.cjs          主进程入口(BrowserWindow + IPC + 插件系统装配)
    lo-core.cjs        LoCoreService:configure/login/status/notes/relations/operations/events(经 @lo/client)
    ipc.cjs           ipcMain.handle 白名单通道注册
    config-store.cjs  配置持久化(userData/lo-agent.json)
    plugin/
      plugin-manager.cjs     插件生命周期编排 + 收集 contributes
      plugin-loader.cjs      扫描/加载 {userData}/plugins
      plugin-ipc.cjs         agent-plugins:* 白名单 IPC 通道
      plugin-installer.cjs   分发仓库安装(下载/校验/解压)
      plugin-store.cjs       插件配置与私有设置持久化
      lo-adapter.cjs         ctx.lo 实现(Host Adapter → @lo/client)
      extension-registry.cjs 扩展点注册/查询/管理
  preload/
    index.cjs          contextBridge 暴露 window.loAgent(loCore + plugins)
  renderer/
    src/App.jsx        主界面(连接/登录/编辑器/历史/关系/插件面板)
test/
  main/lo-core.test.cjs / ipc.test.cjs / config-store.test.cjs / index.test.cjs
  main/plugin/*.test.cjs
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
| `lo-core:get-note` | `rid` | 单个资源(含 content) |
| `lo-core:update-note` | `rid, body` | 更新资源(Operation 语义) |
| `lo-core:relations` | `rid` | 关联关系(outgoing/incoming) |
| `lo-core:operations` | `{ limit?, type?, status? }` | 操作历史 |
| `lo-core:operation-undo` | `id` | 撤销操作 |
| `lo-core:events-subscribe` | `types[]` | 订阅 Core 事件(SSE) |
| `lo-core:events-unsubscribe` | - | 关闭事件订阅 |
| `lo-core:event` | - | 主 → 渲染推送事件 |
| `lo-core:logout` | - | 本地登出 |

### `agent-plugins:*`（插件能力通道）

| 通道 | 参数 | 说明 |
|---|---|---|
| `agent-plugins:list-commands` | - | 已注册命令清单 |
| `agent-plugins:execute-command` | `commandId, args[]` | 执行插件命令 |
| `agent-plugins:list-views` | - | 已注册视图清单 |
| `agent-plugins:render-view` | `viewId, context` | 渲染视图 HTML 交付渲染进程 |
| `agent-plugins:install` | `id, registryUrl, options` | 从分发仓库安装插件 |
| `agent-plugins:list-plugins` | - | 已安装插件清单（管理面板） |
| `agent-plugins:enable` | `id` | 启用插件（激活 + 注册扩展点） |
| `agent-plugins:disable` | `id` | 禁用插件（清理扩展点 + 停用） |
| `agent-plugins:uninstall` | `id` | 卸载插件（删除目录 + 清理数据） |
| `agent-plugins:get-plugin-config` | `id` | 读取插件配置值 |
| `agent-plugins:set-plugin-config` | `id, key, value` | 写入插件配置并落盘 |

## 插件宿主

lo-agent 作为插件 Host，加载 `{userData}/plugins/<plugin-id>/` 下的客户端插件：

- **SDK 契约**：插件经 `@lo/agent-plugins-sdk` 的 `AgentPlugin` 基类 + `ctx.lo` 访问 Core
- **边界**：插件只能经 `ctx.lo`（Host Adapter）调用 Core，不能直接访问 `@lo/client` / HTTP
- **生命周期**：`installed → loaded → activated → enabled → disabled → deactivated → disposed`
- **扩展点**：插件 `manifest.contributes`（commands/views/panels/editors/services）→
  `ExtensionRegistry` 收集/查询/管理（纯数据），激活时清理/dispose 时清理
- **命令执行 Runtime**：插件激活时经 `ctx.extensions.registerCommands([...])` 注册命令 handler，
  宿主经 `PluginManager.executeCommand(id, args)` 调用；命令面板经白名单 IPC 展示/执行
- **视图挂载**：插件经 `ctx.extensions.registerView([...])` 注册 `render`（返回 HTML 字符串），
  `PluginManager.renderView` 交付渲染进程挂载（`dangerouslySetInnerHTML`）
- **面板/编辑器**：`ctx.extensions.registerPanel` / `registerEditor` 注册（area: sidebar/bottom；
  resourceType 绑定资源类型），`PluginManager.renderPanel` / `renderEditor` 同构交付渲染进程
- **mountEl UI（渲染端）**：插件 `manifest.ui`（自包含 ESM）在渲染进程 **isolated world**
  中执行 `render(mountEl, ctx)` 挂载真实 DOM；worldId 由 Host 分配；ctx 经 `agent-plugins:ctx`
  代理到主进程插件 `context.lo`（Phase B 权限裁决）；未声明 `ui` 的插件保留 HTML 快照模式
- **插件服务**：插件经 `ctx.extensions.registerServices([...])` 注册服务（含 api，如状态服务），
  其他插件经 `ctx.extensions.getService(id)` / `listServices()` 消费（插件间通信）；
  提供者停用/禁用时服务从注册表清理
- **依赖与激活顺序**：插件 `manifest.dependsOn` 声明依赖插件的 ID；
  `activateAll` 按依赖拓扑排序激活（提供者先于消费者），循环依赖时稳定兜底
- **延迟激活**：`manifest.activationEvents` 仅含 `onCommand:<id>`/`onView:<id>`/`onPanel:<id>`/`onEditor:<id>`
  的插件启动不激活，宿主在首次执行/渲染对应能力时懒激活（`onStartup`/`*` 或未声明 → 启动激活）；
  `dependsOn` 硬依赖会强制先激活被依赖方
- **权限模型**：`ctx.lo` 按 `manifest.permissions.lo` 白名单过滤，未授权方法抛错；
  默认只读，写操作需显式声明（`resolvePermissions` 解析，最小权限）
- **安装 / 生命周期管理**：`PluginInstaller` 经分发仓库 index.json 下载→校验 checksum→解压→
  校验 manifest；插件管理面板提供列表/启用/禁用/卸载/配置编辑/安装
- **配置持久化**：`PluginStore` 写入 `plugin-config.json` 与 `plugin-settings/<id>.json` 沙箱
- 依赖方向：`Plugin → ctx.lo → lo-adapter → LoCoreService → @lo/client → lo Core`

## 安全基线

- `contextIsolation: true`、`nodeIntegration: false`、`sandbox: true`
- 渲染进程不接触 Node/网络，一律经 preload 的 `window.loAgent.loCore` 调用白名单 IPC
- 主进程仅转发方法调用，不透传任意 IPC 处理函数
- 插件不能访问 LoClient 原始实例，只能经受控 `ctx.lo` 门面
