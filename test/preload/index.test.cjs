jest.mock('electron', () => {
  const mockExposeInMainWorld = jest.fn();
  const mockInvoke = jest.fn();
  const mockOn = jest.fn();
  const mockRemoveListener = jest.fn();
  return {
    contextBridge: { exposeInMainWorld: mockExposeInMainWorld },
    ipcRenderer: { invoke: mockInvoke, on: mockOn, removeListener: mockRemoveListener },
    __mocks: { mockExposeInMainWorld, mockInvoke, mockOn, mockRemoveListener },
  };
});

describe('src/preload/index.cjs', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('通过 contextBridge 暴露 loAgent API', () => {
    require('../../src/preload/index.cjs');
    const { mockExposeInMainWorld } = require('electron').__mocks;

    expect(mockExposeInMainWorld).toHaveBeenCalledTimes(1);
    expect(mockExposeInMainWorld.mock.calls[0][0]).toBe('loAgent');
    const api = mockExposeInMainWorld.mock.calls[0][1];
    expect(api).toHaveProperty('version', '0.1.0');
    expect(api.loCore.configure).toBeDefined();
    expect(api.loCore.login).toBeDefined();
    expect(api.loCore.getStatus).toBeDefined();
    expect(api.loCore.listNotes).toBeDefined();
    expect(api.loCore.getNote).toBeDefined();
    expect(api.loCore.updateNote).toBeDefined();
    expect(api.loCore.logout).toBeDefined();
    expect(api.loCore.operations).toBeDefined();
    expect(api.loCore.operations.list).toBeDefined();
    expect(api.loCore.operations.undo).toBeDefined();
    expect(api.loCore.events).toBeDefined();
    expect(api.loCore.events.subscribe).toBeDefined();
    expect(api.loCore.events.unsubscribe).toBeDefined();
    expect(api.loCore.events.onEvent).toBeDefined();
  });

  it('loCore 方法转发到对应 IPC 通道', () => {
    require('../../src/preload/index.cjs');
    const { mockExposeInMainWorld, mockInvoke } = require('electron').__mocks;
    const api = mockExposeInMainWorld.mock.calls[0][1];

    api.loCore.getConfig();
    api.loCore.configure({ host: 'h' });
    api.loCore.login('x-invalid-arg');
    api.loCore.getStatus();
    api.loCore.listNotes({ limit: 5 });
    api.loCore.getNote('res_1');
    api.loCore.updateNote('res_1', { content: 'x' });
    api.loCore.logout();
    api.loCore.events.subscribe(['resource.created']);
    api.loCore.events.unsubscribe();
    api.loCore.operations.list({ limit: 5 });
    api.loCore.operations.undo('op_1');

    expect(mockInvoke).toHaveBeenCalledTimes(12);
    expect(mockInvoke).toHaveBeenNthCalledWith(1, 'lo-core:config');
    expect(mockInvoke).toHaveBeenNthCalledWith(2, 'lo-core:configure', { host: 'h' });
    expect(mockInvoke).toHaveBeenNthCalledWith(3, 'lo-core:login', 'x-invalid-arg');
    expect(mockInvoke).toHaveBeenNthCalledWith(4, 'lo-core:status');
    expect(mockInvoke).toHaveBeenNthCalledWith(5, 'lo-core:list-notes', { limit: 5 });
    expect(mockInvoke).toHaveBeenNthCalledWith(6, 'lo-core:get-note', 'res_1');
    expect(mockInvoke).toHaveBeenNthCalledWith(7, 'lo-core:update-note', 'res_1', { content: 'x' });
    expect(mockInvoke).toHaveBeenNthCalledWith(8, 'lo-core:logout');
    expect(mockInvoke).toHaveBeenNthCalledWith(9, 'lo-core:events-subscribe', ['resource.created']);
    expect(mockInvoke).toHaveBeenNthCalledWith(10, 'lo-core:events-unsubscribe');
    expect(mockInvoke).toHaveBeenNthCalledWith(11, 'lo-core:operations', { limit: 5 });
    expect(mockInvoke).toHaveBeenNthCalledWith(12, 'lo-core:operation-undo', 'op_1');
  });

  it('events.onEvent 注册 EVENTS_PUSH 监听并返回退订函数', () => {
    require('../../src/preload/index.cjs');
    const { mockExposeInMainWorld, mockOn, mockRemoveListener } = require('electron').__mocks;
    const api = mockExposeInMainWorld.mock.calls[0][1];

    const cb = jest.fn();
    const unlisten = api.loCore.events.onEvent(cb);

    // 注册监听
    expect(mockOn).toHaveBeenCalledWith('lo-core:event', expect.any(Function));
    const listener = mockOn.mock.calls[0][1];

    // 模拟主进程推送事件
    const ev = { event: 'resource.updated', data: { rid: 'r1' } };
    listener({}, ev);
    expect(cb).toHaveBeenCalledWith(ev);

    // 退订
    unlisten();
    expect(mockRemoveListener).toHaveBeenCalledWith('lo-core:event', listener);
  });
});
