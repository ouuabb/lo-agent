export default function App() {
  const version = window.loAgent && window.loAgent.version;
  return (
    <main>
      <h1>lo-agent</h1>
      <p>知识库桌面端（React 渲染进程）</p>
      <p>preload 版本：{version ? version : '未知'}</p>
    </main>
  );
}