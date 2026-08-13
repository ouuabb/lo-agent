/**
 * docs-check.cjs —— lo-agent 文档系统一致性校验
 *
 * 只校验机器可确定的事实，不校验语义：
 *   1. 生成结果幂等：docs/reference/ipc-channels.md 与源码 CHANNELS 派生结果一致
 *   2. 白名单一致性：preload 引用的 lo-core:/agent-plugins: 通道 ⊆ 主进程已注册通道
 *      （renderer 只调白名单，不透传）
 *   3. 文档引用的仓库内源码路径存在（backtick 内 src/ 前缀）
 *   4. 必需文档文件存在（docs/.baseline、docs/reference/ipc-channels.md）
 *
 * 用法：npm run docs:check
 */
const fs = require('fs');
const path = require('path');
const { generate, extractChannels } = require('./docs-gen.cjs');

const ROOT = path.resolve(__dirname, '..');
const DOCS_DIR = path.join(ROOT, 'docs');
const REF_PATTERN = /`(src\/[^`\s]+)`/g;

const errors = [];
const ok = (cond, msg) => {
  if (!cond) errors.push(msg);
};

// ── 1) 生成结果幂等 ──
const idxPath = path.join(DOCS_DIR, 'reference', 'ipc-channels.md');
if (fs.existsSync(idxPath)) {
  ok(
    fs.readFileSync(idxPath, 'utf8') === generate(),
    'docs/reference/ipc-channels.md 过期：请运行 npm run docs 重新生成',
  );
} else {
  errors.push('docs/reference/ipc-channels.md 缺失：请运行 npm run docs 生成');
}

// ── 2) 白名单一致性：preload 引用 ⊆ 主进程已注册 ──
const mainChannels = new Set([
  ...extractChannels(path.join(ROOT, 'src', 'main', 'ipc.cjs')).map((r) => r.channel),
  ...extractChannels(path.join(ROOT, 'src', 'main', 'plugin', 'plugin-ipc.cjs')).map(
    (r) => r.channel,
  ),
]);
const preloadChannels = extractChannels(path.join(ROOT, 'src', 'preload', 'index.cjs'));
for (const r of preloadChannels) {
  if (r.channel.startsWith('window:')) continue; // 窗口控制通道在 index.cjs 注册
  ok(
    mainChannels.has(r.channel),
    `preload 引用了主进程未注册的通道: ${r.channel}（请在 ipc.cjs / plugin-ipc.cjs 中登记）`,
  );
}

// ── 3) 文档引用路径存在 ──
function scanFile(file) {
  if (!fs.existsSync(file)) return;
  const txt = fs.readFileSync(file, 'utf8');
  let m;
  while ((m = REF_PATTERN.exec(txt)) !== null) {
    ok(fs.existsSync(path.resolve(ROOT, m[1])), `${path.relative(ROOT, file)}: 引用路径不存在: ${m[1]}`);
  }
}
for (const name of ['index', 'progress', 'architecture', 'boundary', 'release']) {
  scanFile(path.join(DOCS_DIR, name + '.md'));
}

// ── 4) 必需文件存在 ──
for (const f of ['docs/.baseline', 'docs/index.md', 'docs/progress.md', 'docs/architecture.md', 'docs/boundary.md', 'docs/release.md']) {
  ok(fs.existsSync(path.join(ROOT, f)), `缺失 ${f}`);
}

if (errors.length) {
  console.error('✗ docs 检查失败：');
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log('✓ docs 检查通过');
