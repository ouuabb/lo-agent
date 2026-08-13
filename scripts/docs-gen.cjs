/**
 * docs-gen.cjs —— 生成 docs/reference/ipc-channels.md（IPC 白名单通道目录）
 *
 * 从主进程/ preload 源码提取 CHANNELS/CHANNEL 常量，生成机器事实目录：
 *   - src/main/ipc.cjs           → lo-core:*（App ↔ Core 能力桥）
 *   - src/main/plugin/plugin-ipc.cjs → agent-plugins:*（插件能力白名单）
 *   - src/main/index.cjs         → window:*（窗口控制）
 *   - src/preload/index.cjs      → 全部通道（renderer 侧调用面）
 *
 * 幂等：源码未变 → 输出不变。
 * 用法：npm run docs
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT_FILE = path.join(ROOT, 'docs', 'reference', 'ipc-channels.md');

/** 提取形如 `KEY: 'prefix:...'` 的通道常量 */
function extractChannels(filePath) {
  const txt = fs.readFileSync(filePath, 'utf8');
  const re = /^\s*([A-Z][A-Z0-9_]*):\s*'((?:lo-core|agent-plugins|window):[^']+)'/gm;
  const out = [];
  let m;
  while ((m = re.exec(txt)) !== null) {
    out.push({ key: m[1], channel: m[2] });
  }
  return out;
}

const PREFIXES = ['lo-core:', 'agent-plugins:', 'window:'];

function generate() {
  const sources = {
    'src/main/ipc.cjs': extractChannels(path.join(ROOT, 'src', 'main', 'ipc.cjs')),
    'src/main/plugin/plugin-ipc.cjs': extractChannels(
      path.join(ROOT, 'src', 'main', 'plugin', 'plugin-ipc.cjs'),
    ),
    'src/main/index.cjs': extractChannels(path.join(ROOT, 'src', 'main', 'index.cjs')),
    'src/preload/index.cjs': extractChannels(path.join(ROOT, 'src', 'preload', 'index.cjs')),
  };

  const lines = [
    '# IPC 白名单通道目录',
    '',
    '> 本文档由 `scripts/docs-gen.cjs` 从源码 CHANNELS/CHANNEL 常量**自动生成**，请勿手改。',
    '> 修改通道后运行 `npm run docs` 重新生成。',
    '',
  ];

  for (const prefix of PREFIXES) {
    const title = {
      'lo-core:': 'lo-core:*（App ↔ Core 能力桥）',
      'agent-plugins:': 'agent-plugins:*（插件能力白名单）',
      'window:': 'window:*（窗口控制）',
    }[prefix];
    const defineFile = {
      'lo-core:': 'src/main/ipc.cjs',
      'agent-plugins:': 'src/main/plugin/plugin-ipc.cjs',
      'window:': 'src/main/index.cjs',
    }[prefix];
    lines.push(`## ${title}`, '');
    lines.push('| key | channel | 定义文件 |');
    lines.push('|---|---|---|');
    const seen = new Set();
    for (const [file, rows] of Object.entries(sources)) {
      for (const r of rows) {
        if (!r.channel.startsWith(prefix)) continue;
        if (seen.has(r.channel)) continue;
        seen.add(r.channel);
        lines.push(`| \`${r.key}\` | \`${r.channel}\` | \`${defineFile}\` |`);
      }
    }
    lines.push('');
  }

  lines.push('## 说明', '');
  lines.push('- renderer 只经 preload 白名单调用；通道逐一绑定主进程具体方法，不透传任意调用/实例。');
  lines.push('- renderer 侧 API 映射见 [`architecture.md`](../architecture.md)「IPC 白名单」。');
  lines.push('- 通道值一致性由 `scripts/docs-check.cjs` 校验（preload 只引用主进程已注册通道）。');
  lines.push('');
  return lines.join('\n');
}

if (require.main === module) {
  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  fs.writeFileSync(OUT_FILE, generate());
  console.log(`✓ 生成 ${path.relative(ROOT, OUT_FILE)}`);
}

module.exports = { generate, extractChannels };
