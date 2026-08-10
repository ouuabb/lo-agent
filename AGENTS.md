# AGENTS.md

面向 AI 编码助手（opencode 等）的项目规范，供 lo-agent 工程开发时遵循。
lo 生态总纲是**独立文档**（不依赖任何本地目录布局），定义跨仓库边界与契约铁律；
如与本文档同处一个工作区，先读生态总纲再进入本仓库。

## 项目概况

lo Agent 是 lo（lo Core）知识库的 Electron 桌面端。它与 `lo`（lo Core 仓库）同级，
通过 Electron 主进程 + `@lo/client`（本地 SDK）连接 lo 核心的 HTTP/SSH 协议：
配置仓库地址、SSH 挑战-应答登录、获取仓库状态与资源列表。

## 主进程 ↔ 核心

- `src/main/lo-core.cjs`：`LoCoreService` 封装 `@lo/client`（configure/login/getStatus/listNotes/logout），
  方法返回 `{ ok, ... }` 或 `{ ok:false, error, message }`，便于跨 IPC 序列化。
- `src/main/ipc.cjs`：白名单通道 `lo-core:*`（config/configure/login/status/list-notes/logout）。
- `src/main/config-store.cjs`：配置持久化到 `userData/lo-agent.json`。
- preload `window.loAgent.loCore` 仅暴露上述方法（`ipcRenderer.invoke`）。

## IPC 白名单铁律

- **渲染进程 → 主进程只能经 preload 白名单通道**：`window.loAgent.*` →
  `ipcRenderer.invoke(白名单通道)`；每个通道在 `ipc.cjs` 绑定到主进程**具体方法**。
- **禁止**：透传任意 IPC 调用、任意处理函数、`PluginManager` / `LoClient` 原始实例给渲染进程。
- **插件能力接入 UI**：新增 `agent-plugins:*` 白名单通道（如
  `agent-plugins:execute-command` 绑定 `PluginManager.executeCommand`），preload 只暴露
  固定方法签名——与 `lo-core:*` 完全同构，不透传。
- 主进程持有能力宿主（`LoCoreService` / `PluginManager`）；渲染层永远只经白名单调用。

## 技术栈与约定

- **语言/模块**：JavaScript CommonJS（`.cjs`）主进程/preload，JSX（`.jsx`）渲染进程；无 TypeScript。
- **渲染框架**：React 19，构建工具 Vite（`vite.config.mjs`），源码位于 `src/renderer`。
- **Electron**：主进程 `src/main`、preload `src/preload`、渲染进程 `src/renderer`。
- **安全基线**：`contextIsolation: true`、`nodeIntegration: false`、`sandbox: true`，
  渲染进程不接触 Node API，一律通过 preload 的 `contextBridge` 暴露受控接口。
- **代码风格**：`no-var`、`prefer-const`、双空格、单引号、100 列上限；
  具体见 `.editorconfig` / `.prettierrc.json` / `.eslintrc.cjs`。

## 常用命令

- `npm run dev` — 并行启动 Vite dev server（端口 5173）与 Electron（HMR）
- `npm run build` — Vite 构建渲染进程到 `dist/`
- `npm start` — 构建后启动 Electron 生产模式
- `npm test` — 单元测试（Jest，覆盖率默认开启）
- `npm run lint` — ESLint 检查 `src/**/*.{cjs,jsx}` 与 `test/**/*.cjs`
- `npm run format` — Prettier 自动格式化

## 开发说明

- 开发模式：主进程通过 `ELECTRON_RENDERER_URL` 加载 Vite dev server；生产模式加载 `dist/index.html`。
- 新增渲染 UI 放 `src/renderer/src/`，组件使用函数式 + Hooks。
- 渲染进程访问受控 API：`window.loAgent`（由 preload 暴露）。

## 测试

- 测试文件位于 `test/**/*.test.cjs` / `*.spec.cjs`（Jest）。
- 运行测试前先改动确认：`npm test`。
- 新功能必须配测试；合并前确保 `npm test` 与 `npm run lint` 通过。

## 提交规范

- 采用 Conventional Commits：type 英文小写，subject 包含中文描述。
- 允许 type：feat / fix / docs / style / refactor / perf / test / build / ci / chore / revert。
- 由 husky 钩子强制：`pre-commit` 跑测试，`commit-msg` 校验提交信息。

## 注意事项

- 不要修改 `node_modules/`、`dist/`、`out/` 等生成目录。
- 与 lo Core 交互优先复用 `lo`/`lo-plugins-sdk` 的既有契约（事件名用点号如 `resource.created`）。
- 新增主进程文件需遵循 Electron 安全基线，不透传任意 IPC 调用。