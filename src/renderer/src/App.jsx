import { useCallback, useEffect, useState } from 'react';
import DocViewer from './docs/DocViewer.jsx';

const api = window.loAgent && window.loAgent.loCore;

const MENU = [
  { id: 'workspace', label: '工作台' },
  { id: 'docs', label: '文档' },
];

export default function App() {
  const [view, setView] = useState('workspace');
  const [config, setConfig] = useState({ host: '127.0.0.1', port: 8765, protocol: 'http' });
  const [privateKeyPath, setPrivateKeyPath] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(null);
  const [notes, setNotes] = useState([]);
  const [message, setMessage] = useState('');

  const notify = (text) => setMessage(text);

  useEffect(() => {
    if (!api) {
      notify('preload 未就绪,无法连接 lo 核心');
      return;
    }
    api
      .getConfig()
      .then((c) => {
        if (c && c.host) {
          setConfig((prev) => ({ ...prev, ...c }));
          setPrivateKeyPath(c.privateKeyPath || '');
        }
      })
      .catch((e) => notify(`读取配置失败: ${e.message}`));
  }, []);

  const handleConfigure = useCallback(async () => {
    if (!api) return;
    setBusy(true);
    notify('');
    const res = await api.configure(config);
    setBusy(false);
    if (res.ok) notify(`已连接 ${res.config.host}:${res.config.port}`);
    else notify(`配置失败: ${res.message}`);
  }, [config]);

  const handleLogin = useCallback(async () => {
    if (!api) return;
    setBusy(true);
    notify('');
    const res = await api.login({ privateKeyPath: privateKeyPath || undefined });
    setBusy(false);
    if (res.ok) {
      notify(`登录成功 fingerprint=${res.fingerprint || '-'}`);
      handleRefresh();
    } else {
      notify(`登录失败: ${res.message}`);
    }
  }, [privateKeyPath]);

  const handleRefresh = useCallback(async () => {
    if (!api) return;
    setBusy(true);
    notify('');
    const [statusRes, notesRes] = await Promise.all([
      api.getStatus(),
      api.listNotes({ limit: 50 }),
    ]);
    setBusy(false);
    if (statusRes.ok) setStatus(statusRes.stats);
    else notify(`获取状态失败: ${statusRes.message}`);
    if (notesRes.ok) setNotes(notesRes.data);
    else notify(`获取资源列表失败: ${notesRes.message}`);
  }, []);

  const handleLogout = useCallback(async () => {
    if (!api) return;
    await api.logout();
    setStatus(null);
    setNotes([]);
    notify('已登出');
  }, []);

  const setField = (field) => (e) => {
    setConfig((prev) => ({ ...prev, [field]: e.target.value }));
  };

  return (
    <main
      style={{ fontFamily: 'system-ui, sans-serif', maxWidth: 1200, margin: '0 auto', padding: 24 }}
    >
      <header className="app-header">
        <div>
          <h1 style={{ margin: 0 }}>lo-agent</h1>
          <p style={{ margin: '4px 0 0', color: '#666' }}>知识库桌面端 — 连接 lo 核心</p>
        </div>
        <nav className="app-menu">
          {MENU.map((item) => (
            <button
              key={item.id}
              className={view === item.id ? 'active' : ''}
              onClick={() => setView(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </header>

      {view === 'docs' ? (
        <DocViewer />
      ) : (
        <>
          <section>
            <h2>仓库地址</h2>
            <label>
              协议
              <select value={config.protocol} onChange={setField('protocol')}>
                <option value="http">http</option>
                <option value="https">https</option>
              </select>
            </label>
            <label>
              主机
              <input value={config.host} onChange={setField('host')} placeholder="127.0.0.1" />
            </label>
            <label>
              端口
              <input
                type="number"
                value={config.port}
                onChange={setField('port')}
                placeholder="8765"
              />
            </label>
            <button onClick={handleConfigure} disabled={busy}>
              {busy ? '处理中…' : '连接'}
            </button>
          </section>

          <section>
            <h2>登录 / 认证</h2>
            <label>
              SSH 私钥路径
              <input
                value={privateKeyPath}
                onChange={(e) => setPrivateKeyPath(e.target.value)}
                placeholder="~/.ssh/id_ed25519 (可选)"
              />
            </label>
            <button onClick={handleLogin} disabled={busy}>
              登录
            </button>
            <button onClick={handleLogout}>登出</button>
            <button onClick={handleRefresh} disabled={busy}>
              刷新状态与资源
            </button>
          </section>

          {message && <p aria-live="polite">{message}</p>}

          <section>
            <h2>仓库状态</h2>
            {status ? <pre>{JSON.stringify(status, null, 2)}</pre> : <p>尚未获取。请先登录。</p>}
          </section>

          <section>
            <h2>资源列表</h2>
            {notes.length === 0 ? (
              <p>暂无资源。</p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>rid</th>
                    <th>标题</th>
                    <th>类型</th>
                  </tr>
                </thead>
                <tbody>
                  {notes.map((n) => (
                    <tr key={n.rid}>
                      <td>{n.rid}</td>
                      <td>{(n.metadata && n.metadata.title) || n.name || ''}</td>
                      <td>{n.type}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </>
      )}
    </main>
  );
}
