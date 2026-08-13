# lo-agent

lo（lo Core）知识库的 **Electron 桌面端 + 客户端插件宿主**。

- **App**：经主进程 `LoCoreService` + `@lo/client` 连接 lo Core（HTTP/SSH）——配置仓库、
  SSH 登录、状态/资源/关系/操作历史、实时事件、笔记编辑。
- **插件宿主**：加载 `{userData}/plugins/` 下客户端插件（命令/视图/面板/编辑器/服务 +
  mountEl UI）。

```
renderer → window.loAgent（preload 白名单）→ 主进程 → @lo/client → lo Core
Plugin → ctx.lo(契约) → Host Adapter → @lo/client → lo Core
```

## 常用命令

```bash
npm run dev       # Vite(5173) + Electron HMR
npm run build     # Vite 构建到 dist/
npm start         # 构建后启动
npm test          # Jest（勿裸跑 npx jest）
npm run lint
```

## 文档系统

| 文档 | 内容 |
|---|---|
| [`docs/index.md`](docs/index.md) | 文档索引 + 定位 + 生态链条 |
| [`docs/progress.md`](docs/progress.md) | 项目进度：功能矩阵 + 里程碑 + 未实现清单 |
| [`docs/architecture.md`](docs/architecture.md) | 实现方式：主进程↔核心 / IPC 白名单 / 插件宿主 / mountEl |
| [`docs/boundary.md`](docs/boundary.md) | 边界与铁律：IPC 白名单 / 安全基线 / G2 / 插件宿主边界 |
| [`docs/release.md`](docs/release.md) | 构建与发布 |
| [`docs/reference/ipc-channels.md`](docs/reference/ipc-channels.md) | IPC 白名单通道目录（自动生成，勿手改） |

> 契约口径见生态总纲（`lo-meta/ecosystem/AGENTS.md`，opencode 全局自动加载）。

## 开发规范

见 [`AGENTS.md`](AGENTS.md)（薄入口）与生态总纲。
