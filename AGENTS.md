# AGENTS.md

面向 AI 编码助手（opencode 等）的项目规范，供 lo-agent 工程开发时遵循。

## 项目概况

lo Agent 是 lo（log）知识库的 Electron 桌面端。它与 `log`（lo Core）同级，
通过 Electron 主进程与 lo 的 HTTP/CLI 集成 agent 功能（待开发）。

## 技术栈与约定

- **语言/模块**：JavaScript CommonJS（`.cjs`），无 TypeScript、无 ESM。
- **Electron**：主进程 `src/main`、preload `src/preload`、渲染进程 `src/renderer`。
- **安全基线**：`contextIsolation: true`、`nodeIntegration: false`、`sandbox: true`，
  渲染进程不接触 Node API，一律通过 preload 的 `contextBridge` 暴露受控接口。
- **代码风格**：`no-var`、`prefer-const`、双空格、单引号、100 列上限；
  具体见 `.editorconfig` / `.prettierrc.json` / `.eslintrc.cjs`。

## 常用命令

- `npm start` — 启动 Electron 应用
- `npm test` — Jest（覆盖率收集默认开启）
- `npm run lint` — ESLint 检查 `src/**/*.cjs` 与 `test/**/*.cjs`
- `npm run format` — Prettier 自动格式化

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
- 与 lo Core 交互优先复用 `log`/`lo-sdk` 的既有契约（事件名用点号如 `resource.created`）。
- 新增主进程文件需遵循 Electron 安全基线，不透传任意 IPC 调用。