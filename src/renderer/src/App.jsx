import { useCallback, useEffect, useMemo, useState } from 'react';
import DocViewer from './docs/DocViewer.jsx';
import './App.css';

const api = window.loAgent && window.loAgent.loCore;

const SUB_NAV = [
  { id: 'workspace', label: '工作台' },
  { id: 'docs', label: '文档' },
];

export default function App() {
  const [view, setView] = useState('workspace');
  const [subOpen, setSubOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [config, setConfig] = useState({ host: '127.0.0.1', port: 8765, protocol: 'http' });
  const [privateKeyPath, setPrivateKeyPath] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(null);
  const [notes, setNotes] = useState([]);
  const [authenticated, setAuthenticated] = useState(false);
  const [message, setMessage] = useState('');

  const notify = (text) => setMessage(text);

  useEffect(() => {
    if (!api) {
      notify('preload 未就绪，无法连接 lo 核心');
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
      setAuthenticated(true);
      notify(`登录成功 fingerprint=${res.fingerprint || '-'}`);
      setLoginOpen(false);
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
    setAuthenticated(false);
    setStatus(null);
    setNotes([]);
    notify('已登出');
  }, []);

  const setField = (field) => (e) => {
    setConfig((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const openLogin = () => setLoginOpen(true);
  const closeLogin = () => setLoginOpen(false);

  return (
    <div className="app">
      <header className="app-topbar">
        <button
          className="hamburger"
          aria-label="切换侧边栏"
          onClick={() => setCollapsed((v) => !v)}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
            <path
              d="M2 4.5h14M2 9h14M2 13.5h14"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              fill="none"
            />
          </svg>
        </button>
        <div className="topbar-spacer" />
        <button
          className={`conn-dot ${authenticated ? 'on' : ''}`}
          type="button"
          title={authenticated ? '已登录，点击重新登录/登出' : '未连接，点击登录'}
          aria-label={authenticated ? '已登录' : '未连接'}
          onClick={openLogin}
        />
      </header>
      <div className="app-shell">
        <aside className="app-rail">
          <div className="rail-spacer" />
          <button
            className="rail-btn"
            aria-label="展开功能面板"
            title="功能面板"
            onClick={() => setSubOpen(true)}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="2" />
              <path
                d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </aside>
        <aside className={collapsed ? 'app-sidebar collapsed' : 'app-sidebar'}>
          <ResourceExplorer
            notes={notes}
            busy={busy}
            authenticated={authenticated}
            onRefresh={handleRefresh}
          />
        </aside>

      <main className="app-content">
        {message && (
          <div className="app-toast" aria-live="polite">
            {message}
          </div>
        )}

        {subOpen && (
          <div className="sub-panel">
            <div className="sub-nav" role="tablist">
              {SUB_NAV.map((item) => (
                <button
                  key={item.id}
                  role="tab"
                  aria-selected={view === item.id}
                  className={view === item.id ? 'active' : ''}
                  onClick={() => setView(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <div className="sub-body">
              {view === 'workspace' && (
                <WorkspacePanel
                  status={status}
                  notes={notes}
                  busy={busy}
                  onRefresh={handleRefresh}
                  onLogin={openLogin}
                />
              )}

              {view === 'docs' && <DocViewer />}
            </div>
          </div>
        )}
        </main>

        {loginOpen && (
          <Modal title="登录" onClose={closeLogin}>
            <LoginPanel
              config={config}
              privateKeyPath={privateKeyPath}
              busy={busy}
              setField={setField}
              setPrivateKeyPath={setPrivateKeyPath}
              onConfigure={handleConfigure}
              onLogin={handleLogin}
              onLogout={handleLogout}
            />
          </Modal>
        )}
      </div>
    </div>
  );
}

function LoginPanel(props) {
  const { config, privateKeyPath, busy, setField, setPrivateKeyPath, onConfigure, onLogin, onLogout } = props;
  return (
    <>
      <section className="panel-card">
        <h2>仓库地址</h2>
        <div className="field-row">
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
        </div>
        <button className="btn primary" onClick={onConfigure} disabled={busy}>
          {busy ? '处理中…' : '连接'}
        </button>
      </section>

      <section className="panel-card">
        <h2>登录 / 认证</h2>
        <div className="field-col">
          <label>
            SSH 私钥路径
            <input
              value={privateKeyPath}
              onChange={(e) => setPrivateKeyPath(e.target.value)}
              placeholder="~/.ssh/id_ed25519 (可选)"
            />
          </label>
        </div>
        <button className="btn primary" onClick={onLogin} disabled={busy}>
          登录
        </button>
        <button className="btn ghost" onClick={onLogout} disabled={busy}>
          登出
        </button>
      </section>
    </>
  );
}

function WorkspacePanel(props) {
  const { status, notes, busy, onRefresh, onLogin } = props;
  return (
    <>
      <section className="panel-card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0 }}>仓库状态</h2>
          <button className="btn ghost" onClick={onRefresh} disabled={busy}>
            {busy ? '刷新中…' : '刷新'}
          </button>
        </div>
        {status ? (
          <pre style={{ margin: '16px 0 0', fontSize: 13, overflow: 'auto' }}>
            {JSON.stringify(status, null, 2)}
          </pre>
        ) : (
          <p className="empty">
            尚未获取状态。请先
            <button className="btn ghost" onClick={onLogin} style={{ marginLeft: 8 }}>
              登录
            </button>
            。
          </p>
        )}
      </section>

      <section className="panel-card">
        <h2>资源列表</h2>
        {notes.length === 0 ? (
          <p className="empty">暂无资源。</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>标题</th>
                <th>类型</th>
                <th>rid</th>
              </tr>
            </thead>
            <tbody>
              {notes.map((n) => (
                <tr key={n.rid}>
                  <td>{(n.metadata && n.metadata.title) || n.name || ''}</td>
                  <td>
                    <span className="name-badge">{n.type}</span>
                  </td>
                  <td className="muted">{n.rid}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}

function ResourceExplorer(props) {
  const { notes, busy, authenticated, onRefresh } = props;
  const [active, setActive] = useState(null);

  const groups = useMemo(() => {
    const m = {};
    notes.forEach((n) => {
      const type = n.type || 'resource';
      (m[type] = m[type] || []).push(n);
    });
    return Object.entries(m).sort((a, b) => a[0].localeCompare(b[0]));
  }, [notes]);

  return (
    <div className="sidebar-explore">
      <div className="explore-head">
        <span className="explore-title">资源</span>
        <button
          className="explore-refresh"
          type="button"
          title="刷新资源库"
          aria-label="刷新"
          onClick={onRefresh}
          disabled={busy}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M21 12a9 9 0 1 1-2.64-6.36" />
            <path d="M21 3v6h-6" />
          </svg>
        </button>
      </div>
      <nav className="explore-list">
        {groups.map(([type, items]) => (
          <div className="explore-group" key={type}>
            <div className="explore-group-title">{type}</div>
            {items.map((n) => (
              <button
                key={n.rid}
                type="button"
                className={`explore-item ${active === n.rid ? 'active' : ''}`}
                onClick={() => setActive(n.rid)}
                title={n.rid}
              >
                <span className="explore-name">
                  {(n.metadata && n.metadata.title) || n.name || n.rid}
                </span>
              </button>
            ))}
          </div>
        ))}
        {!busy && groups.length === 0 && (
          <p className="empty">{authenticated ? '暂无资源' : '未登录，点击顶栏指示灯登录'}</p>
        )}
      </nav>
    </div>
  );
}

function Modal(props) {
  const { title, onClose, children } = props;

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2 className="modal-title">{title}</h2>
          <button className="modal-close" aria-label="关闭" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}
