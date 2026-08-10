import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import DocViewer from './docs/DocViewer.jsx';
import NoteEditor from './editor/NoteEditor.jsx';
import './App.css';

const api = window.loAgent && window.loAgent.loCore;

function formatTime(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

const SUB_NAV = [
  { id: 'workspace', label: '工作台' },
  { id: 'docs', label: '文档' },
  { id: 'history', label: '历史' },
];

export default function App() {
  const [view, setView] = useState('workspace');
  const [subOpen, setSubOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(220);
  const [resizing, setResizing] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [config, setConfig] = useState({ host: '127.0.0.1', port: 8765, protocol: 'http' });
  const [privateKeyPath, setPrivateKeyPath] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(null);
  const [notes, setNotes] = useState([]);
  const [authenticated, setAuthenticated] = useState(false);
  const [message, setMessage] = useState('');
  const [tabs, setTabs] = useState([]);
  const [activeKey, setActiveKey] = useState(null);
  const [savingKey, setSavingKey] = useState(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [zoom, setZoom] = useState(1);
  const discardKeyRef = useRef(null);

  const notify = (text) => setMessage(text);

  const activeTab = tabs.find((t) => t.key === activeKey) || null;
  const isDirty = (tab) => !!tab && (tab.readOnly ? false : tab.text !== tab.savedText);

  useEffect(() => {
    if (!api) {
      notify('preload 未就绪，无法连接 lo 核心');
      return;
    }
    let cancelled = false;
    api
      .getConfig()
      .then(async (c) => {
        if (cancelled) return;
        if (!c || !c.host) return;
        setConfig((prev) => ({ ...prev, ...c }));
        setPrivateKeyPath(c.privateKeyPath || '');
        if (c.privateKeyPath) {
          const { host, port, protocol } = c;
          const cfg = await api.configure({ host, port, protocol });
          if (cfg.ok) {
            const res = await api.login({ privateKeyPath: c.privateKeyPath });
            if (res.ok) {
              setAuthenticated(true);
              notify(`已自动登录 fingerprint=${res.fingerprint || '-'}`);
              handleRefresh();
            }
          }
        }
      })
      .catch((e) => notify(`读取配置失败: ${e.message}`));
    return () => {
      cancelled = true;
    };
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
    setTabs([]);
    setActiveKey(null);
    notify('已登出');
  }, []);

  const openResource = useCallback(
    async (n) => {
      if (!api || !n) return;
      const existing = tabs.find((t) => t.rid === n.rid);
      if (existing) {
        setActiveKey(existing.key);
        return;
      }
      setBusy(true);
      notify('');
      const res = await api.getNote(n.rid);
      setBusy(false);
      if (res.ok && res.data) {
        const data = res.data;
        const readOnly = n.type !== 'note';
        const tab = {
          key: n.rid,
          rid: n.rid,
          type: n.type || data.type || 'resource',
          title: (data.metadata && data.metadata.title) || n.name || n.rid,
          text: data.content || '',
          savedText: data.content || '',
          readOnly,
          meta: {
            rid: n.rid,
            type: n.type || data.type || 'resource',
            updatedAt: data.updatedAt || data.lastModified || null,
            size: data.size != null ? data.size : (data.content || '').length,
            schema: data.schema || null,
          },
        };
        setTabs((prev) => [...prev, tab]);
        setActiveKey(tab.key);
      } else {
        notify(`打开资源失败: ${res.message}`);
      }
    },
    [api, tabs],
  );

  const setActiveText = useCallback(
    (text) => {
      setTabs((prev) => prev.map((t) => (t.key === activeKey ? { ...t, text } : t)));
    },
    [activeKey],
  );

  const closeTab = useCallback(
    (key) => {
      setTabs((prev) => {
        const idx = prev.findIndex((t) => t.key === key);
        const next = prev.filter((t) => t.key !== key);
        if (activeKey === key) {
          const fallback = next[Math.max(0, idx - 1)];
          setActiveKey(fallback ? fallback.key : null);
        }
        return next;
      });
    },
    [activeKey],
  );

  const requestCloseTab = useCallback(
    (key) => {
      const tab = tabs.find((t) => t.key === key);
      if (tab && isDirty(tab)) {
        discardKeyRef.current = key;
        setConfirmDiscard(true);
      } else {
        closeTab(key);
      }
    },
    [tabs, isDirty, closeTab],
  );

  const saveActiveTab = useCallback(async () => {
    if (!api || !activeTab || activeTab.readOnly) return;
    setSavingKey(activeTab.key);
    notify('');
    const res = await api.updateNote(activeTab.rid, { content: activeTab.text });
    setSavingKey(null);
    if (res.ok) {
      setTabs((prev) =>
        prev.map((t) => (t.key === activeTab.key ? { ...t, savedText: t.text } : t)),
      );
      notify('已保存');
      handleRefresh();
    } else {
      notify(`保存失败: ${res.message}`);
    }
  }, [api, activeTab, handleRefresh]);

  const confirmDiscardAction = useCallback(() => {
    const key = discardKeyRef.current;
    discardKeyRef.current = null;
    setConfirmDiscard(false);
    if (key) closeTab(key);
  }, [closeTab]);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        saveActiveTab();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [saveActiveTab]);

  useEffect(() => {
    document.documentElement.style.zoom = String(zoom);
    return () => {
      document.documentElement.style.zoom = '';
    };
  }, [zoom]);

useEffect(() => {
    const round1 = (n) => Number(n.toFixed(2));
    const step = (cur) => Math.min(1.6, Math.max(0.5, round1(cur)));
    const onKey = (e) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        setZoom((z) => step(z + 0.1));
      } else if (e.key === '-' || e.key === '_') {
        e.preventDefault();
        setZoom((z) => step(z - 0.1));
      } else if (e.key === '0') {
        e.preventDefault();
        setZoom(1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const setField = (field) => (e) => {
    setConfig((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const startResize = useCallback(
    (e) => {
      e.preventDefault();
      setResizing(true);
      const startX = e.clientX;
      const startWidth = sidebarWidth;
      const onMove = (ev) => {
        const next = Math.min(480, Math.max(140, startWidth + (ev.clientX - startX)));
        setSidebarWidth(next);
      };
      const stop = () => {
        setResizing(false);
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', stop);
        document.body.classList.remove('no-select');
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', stop);
      document.body.classList.add('no-select');
    },
    [sidebarWidth],
  );

  const openLogin = () => setLoginOpen(true);
  const closeLogin = () => setLoginOpen(false);

  const [isMaximized, setIsMaximized] = useState(false);
  useEffect(() => {
    const wc = window.loAgent?.windowControls;
    if (!wc) return undefined;
    wc.isMaximized().then(setIsMaximized).catch(() => {});
    return wc.onMaximizeChange(setIsMaximized);
  }, []);

  // 登录后订阅 Core 事件(SSE)，收到资源变化事件刷新列表
  // 生命周期：登录建立订阅 → 登出/卸载关闭订阅
  useEffect(() => {
    if (!api || !authenticated) return undefined;
    const ev = api.events;
    if (!ev) return undefined;

    let cancelled = false;
    let unlisten = null;

    ev.subscribe(['resource.created', 'resource.updated', 'resource.deleted'])
      .then(() => {
        if (cancelled) return;
        unlisten = ev.onEvent((event) => {
          const type = event && event.event;
          if (
            type === 'resource.created' ||
            type === 'resource.deleted' ||
            type === 'resource.updated'
          ) {
            handleRefresh();
          }
        });
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      if (unlisten) unlisten();
      ev.unsubscribe().catch(() => {});
    };
  }, [authenticated, handleRefresh]);

  const winBtn = (action, label, children) => (
    <button
      type="button"
      className="win-btn"
      aria-label={label}
      title={label}
      onClick={action}
    >
      {children}
    </button>
  );

  const renderCtlButtons = () => {
    const wc = window.loAgent?.windowControls;
    if (!wc) return null;
    return (
      <div className="win-controls">
        {winBtn(
          () => wc.minimize(),
          '最小化',
          <svg width="11" height="11" viewBox="0 0 11 11" aria-hidden="true">
            <path d="M1 5.5h9" stroke="currentColor" strokeWidth="1.1" />
          </svg>,
        )}
        {winBtn(
          () => wc.toggleMaximize(),
          isMaximized ? '向下还原' : '最大化',
          isMaximized ? (
            <svg width="11" height="11" viewBox="0 0 11 11" aria-hidden="true">
              <rect x="1.5" y="1.5" width="8" height="8" fill="none" stroke="currentColor" strokeWidth="1.1" />
              <path d="M3.5 3.5v-2a0 0 0 0 1 0 0v0h0z" fill="none" />
              <rect x="3.2" y="3.2" width="7" height="7" fill="none" stroke="currentColor" strokeWidth="1.1" />
            </svg>
          ) : (
            <svg width="11" height="11" viewBox="0 0 11 11" aria-hidden="true">
              <rect x="1.5" y="1.5" width="8" height="8" fill="none" stroke="currentColor" strokeWidth="1.1" />
            </svg>
          ),
        )}
        {winBtn(
          () => wc.close(),
          '关闭',
          <svg width="11" height="11" viewBox="0 0 11 11" aria-hidden="true">
            <path d="M2 2l7 7M9 2L2 9" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
          </svg>,
        )}
      </div>
    );
  };

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
          className="rail-btn"
          type="button"
          title="插件命令"
          aria-label="插件命令"
          onClick={() => setCommandOpen(true)}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M4 17h6M14 17h6M9 11h6M4 5h6M14 5h6" />
          </svg>
        </button>
        <button
          className={`conn-dot ${authenticated ? 'on' : ''}`}
          type="button"
          title={authenticated ? '已登录，点击重新登录/登出' : '未连接，点击登录'}
          aria-label={authenticated ? '已登录' : '未连接'}
          onClick={openLogin}
        />
        {renderCtlButtons()}
      </header>
      <div className={`app-shell ${resizing ? 'resizing' : ''}`}>
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
        <aside
          className={collapsed ? 'app-sidebar collapsed' : 'app-sidebar'}
          style={{ width: collapsed ? 0 : sidebarWidth }}
        >
          <ResourceExplorer
            notes={notes}
            busy={busy}
            authenticated={authenticated}
            onRefresh={handleRefresh}
            onOpen={openResource}
          />
        </aside>

        <div
          className="app-sidebar-resizer"
          onPointerDown={startResize}
          title="拖拽调整侧边栏宽度"
        />

      <main className="app-content">
        {message && (
          <div className="app-toast" aria-live="polite">
            {message}
          </div>
        )}

        {tabs.length > 0 && (
          <div className="editor-tabs" role="tablist">
            {tabs.map((t) => (
              <div
                key={t.key}
                role="tab"
                aria-selected={t.key === activeKey}
                className={`editor-tab ${t.key === activeKey ? 'active' : ''} ${
                  isDirty(t) ? 'dirty' : ''
                }`}
                onClick={() => setActiveKey(t.key)}
              >
                <span className="editor-tab-name">{t.title}</span>
                {isDirty(t) && <span className="editor-tab-dirty-dot" title="未保存" />}
                <button
                  type="button"
                  className="editor-tab-close"
                  aria-label={`关闭 ${t.title}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    requestCloseTab(t.key);
                  }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        {activeTab ? (
          <div className="editor-panel">
            <div className="editor-toolbar">
              <div className="editor-toolbar-title">
                <span className="editor-doc-rid">{activeTab.rid}</span>
                <span className="editor-doc-name">{activeTab.title}</span>
                {isDirty(activeTab) && <span className="chip chip-dirty">未保存</span>}
                {activeTab.readOnly && <span className="chip">只读</span>}
              </div>
              <div className="editor-toolbar-actions">
                <button
                  className="btn primary"
                  type="button"
                  onClick={saveActiveTab}
                  disabled={savingKey || activeTab.readOnly}
                >
                  {savingKey ? '保存中…' : activeTab.readOnly ? '只读' : '保存'}
                </button>
                <button
                  className="btn ghost"
                  type="button"
                  onClick={() => requestCloseTab(activeTab.key)}
                >
                  关闭
                </button>
              </div>
            </div>

            <div className="editor-body">
              <NoteEditor
                key={activeTab.key}
                value={activeTab.text}
                onChange={setActiveText}
                readOnly={activeTab.readOnly}
              />
            </div>

            <RelationPanel rid={activeTab.rid} notes={notes} />

            <div className="editor-statusbar">
              <span className="status-meta">{activeTab.rid}</span>
              <span className="status-meta">类型 {activeTab.meta.type}</span>
              {activeTab.meta.schema && (
                <span className="status-meta">schema {activeTab.meta.schema}</span>
              )}
              {activeTab.meta.updatedAt && (
                <span className="status-meta">
                  更新 {formatTime(activeTab.meta.updatedAt)}
                </span>
              )}
              <span className="status-meta">
                {activeTab.text.length} 字符
                {activeTab.readOnly ? ' · 只读' : ''}
              </span>
              <span className="status-hint">Ctrl/Cmd+S 保存</span>
            </div>
          </div>
        ) : (
          tabs.length === 0 &&
          subOpen && (
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

              {view === 'history' && (
                <OperationHistory
                  authenticated={authenticated}
                  onLogin={openLogin}
                  onNotify={notify}
                  onRefresh={handleRefresh}
                />
              )}
            </div>
          </div>
          )
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

        {confirmDiscard && (
          <Modal title="放弃未保存的修改" onClose={() => setConfirmDiscard(false)}>
            <div className="confirm-body">
              <p>当前编辑内容尚未保存，确定要关闭并放弃这些修改吗？</p>
              <div className="confirm-actions">
                <button className="btn primary" type="button" onClick={confirmDiscardAction}>
                  放弃修改
                </button>
                <button className="btn ghost" type="button" onClick={() => setConfirmDiscard(false)}>
                  继续编辑
                </button>
              </div>
            </div>
          </Modal>
        )}

        {commandOpen && (
          <Modal title="插件命令" onClose={() => setCommandOpen(false)}>
            <CommandPanel onNotify={notify} onClose={() => setCommandOpen(false)} />
          </Modal>
        )}
      </div>
    </div>
  );
}

function CommandPanel(props) {
  const { onNotify, onClose } = props;
  const [commands, setCommands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const api = window.loAgent && window.loAgent.plugins;
    if (!api) {
      if (onNotify) onNotify('插件系统未就绪');
      setLoading(false);
      return;
    }
    const res = await api.list();
    setLoading(false);
    if (res.ok) setCommands(res.commands || []);
    else if (onNotify) onNotify(`获取命令失败: ${res.error}`);
  }, [onNotify]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const run = useCallback(
    async (cmd) => {
      const api = window.loAgent && window.loAgent.plugins;
      if (!api) return;
      setBusy(true);
      const res = await api.execute(cmd.id, []);
      setBusy(false);
      if (onNotify) {
        onNotify(res.ok ? `已执行: ${cmd.title}` : `执行失败: ${res.error}`);
      }
      if (onClose) onClose();
    },
    [onNotify, onClose],
  );

  return (
    <section className="panel-card">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h3 style={{ margin: 0, fontSize: 14 }}>已注册命令</h3>
        <button className="btn ghost" onClick={refresh} disabled={busy || loading}>
          {loading ? '加载中…' : '刷新'}
        </button>
      </div>
      {commands.length === 0 ? (
        <p className="empty">{loading ? '加载中…' : '暂无插件命令'}</p>
      ) : (
        <ul className="command-list">
          {commands.map((c) => (
            <li key={c.id} className="command-item">
              <div className="command-info">
                <span className="command-title">{c.title}</span>
                <span className="muted">{c.pluginId}</span>
              </div>
              <button
                className="btn primary"
                type="button"
                disabled={busy}
                onClick={() => run(c)}
              >
                执行
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
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

function RelationPanel(props) {
  const { rid, notes } = props;
  const [rels, setRels] = useState(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const api = window.loAgent?.loCore;
    if (!api || !api.relations || !rid) return;
    setBusy(true);
    const res = await api.relations.list(rid);
    setBusy(false);
    if (res.ok) setRels(res.data);
  }, [rid]);

  useEffect(() => {
    setRels(null);
    refresh();
  }, [rid, refresh]);

  // 从 notes 列表解析对端资源名(名称或标题)
  const resolveName = (rid2) => {
    const found = (notes || []).find((n) => n.rid === rid2);
    if (found) return (found.metadata && found.metadata.title) || found.name || rid2;
    return rid2;
  };

  const renderRelation = (rel, dir) => {
    const otherRid = dir === 'outgoing' ? rel.to_rid : rel.from_rid;
    return (
      <div className="rel-item" key={rel.id}>
        <span className="name-badge">{rel.type || 'reference'}</span>
        <span className="rel-dir">{dir === 'outgoing' ? '→' : '←'}</span>
        <span className="rel-target" title={otherRid}>
          {resolveName(otherRid)}
        </span>
      </div>
    );
  };

  if (!rid) return null;

  return (
    <section className="panel-card rel-panel">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h3 style={{ margin: 0, fontSize: 14 }}>关联关系</h3>
        <button className="btn ghost" onClick={refresh} disabled={busy}>
          {busy ? '加载中…' : '刷新'}
        </button>
      </div>

      {rels ? (
        <>
          <div className="rel-group">
            <div className="rel-group-title">引用 ({rels.outgoing ? rels.outgoing.length : 0})</div>
            {rels.outgoing && rels.outgoing.length > 0 ? (
              rels.outgoing.map((r) => renderRelation(r, 'outgoing'))
            ) : (
              <div className="rel-empty">无</div>
            )}
          </div>
          <div className="rel-group">
            <div className="rel-group-title">被引用 ({rels.incoming ? rels.incoming.length : 0})</div>
            {rels.incoming && rels.incoming.length > 0 ? (
              rels.incoming.map((r) => renderRelation(r, 'incoming'))
            ) : (
              <div className="rel-empty">无</div>
            )}
          </div>
        </>
      ) : (
        <p className="empty">加载中…</p>
      )}
    </section>
  );
}

function OperationHistory(props) {
  const { authenticated, onLogin, onNotify, onRefresh } = props;
  const [ops, setOps] = useState([]);
  const [busy, setBusy] = useState(false);
  const [undoing, setUndoing] = useState(null);

  const refresh = useCallback(async () => {
    const api = window.loAgent?.loCore;
    if (!api || !api.operations) return;
    setBusy(true);
    const res = await api.operations.list({ limit: 100 });
    setBusy(false);
    if (res.ok) setOps(res.data || []);
    else if (onNotify) onNotify(`获取操作历史失败: ${res.message}`);
  }, [onNotify]);

  useEffect(() => {
    if (authenticated) refresh();
  }, [authenticated, refresh]);

  const handleUndo = useCallback(
    async (op) => {
      const api = window.loAgent?.loCore;
      if (!api || !api.operations) return;
      const opId = op.operation_id || op.operationId;
      setUndoing(opId);
      const res = await api.operations.undo(opId);
      setUndoing(null);
      if (res.ok) {
        if (onNotify) onNotify('已撤销操作');
        refresh();
        // undo 是独立 Operation，不产生领域事件；手动刷新资源列表
        if (onRefresh) onRefresh();
      } else if (onNotify) {
        onNotify(`撤销失败: ${res.message}`);
      }
    },
    [refresh, onRefresh, onNotify],
  );

  if (!authenticated) {
    return (
      <div className="panel-card">
        <h2>操作历史</h2>
        <p className="empty">
          请先
          <button className="btn ghost" onClick={onLogin} style={{ marginLeft: 8 }}>
            登录
          </button>
          查看操作历史。
        </p>
      </div>
    );
  }

  return (
    <section className="panel-card">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2 style={{ margin: 0 }}>操作历史</h2>
        <button className="btn ghost" onClick={refresh} disabled={busy}>
          {busy ? '加载中…' : '刷新'}
        </button>
      </div>
      {ops.length === 0 ? (
        <p className="empty">暂无操作记录。</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>时间</th>
              <th>类型</th>
              <th>状态</th>
              <th>关联资源</th>
              <th>operationId</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {ops.map((op) => {
              const after = op.after || {};
              const before = op.before || {};
              const rid =
                after.rid || before.rid || after.resource_rid || after.from_rid || '';
              const opId = op.operation_id || op.operationId;
              const statusLabel =
                op.status === 'success'
                  ? '成功'
                  : op.status === 'failed'
                    ? '失败'
                    : op.status === 'rolled_back'
                      ? '已撤销'
                      : op.status || '';
              return (
                <tr key={opId}>
                  <td>{formatTime(op.created)}</td>
                  <td>
                    <span className="name-badge">{op.type}</span>
                  </td>
                  <td>
                    <span className={`op-status op-status-${op.status || 'unknown'}`}>
                      {statusLabel}
                    </span>
                  </td>
                  <td className="muted">{rid || '—'}</td>
                  <td className="muted">{opId}</td>
                  <td>
                    <button
                      className="btn ghost"
                      type="button"
                      disabled={undoing === opId || op.status !== 'success'}
                      title={
                        op.status === 'success' ? '撤销此操作' : '仅成功状态可撤销'
                      }
                      onClick={() => handleUndo(op)}
                    >
                      {undoing === opId ? '撤销中…' : '撤销'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
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
  const { notes, busy, authenticated, onRefresh, onOpen } = props;
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
                onClick={() => {
                  setActive(n.rid);
                  if (onOpen) onOpen(n);
                }}
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
