# lo-agent

lo Agent 桌面端（Electron）。与 `log`（lo Core）同级，后续通过 lo 的 HTTP/CLI 集成 agent 功能。

## 开发

```bash
npm install
npm start
```

## 结构

```
src/
  main/      主进程
  preload/   预加载脚本（contextBridge）
  renderer/  渲染进程页面
```