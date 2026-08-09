jest.mock('electron', () => {
  const mockExposeInMainWorld = jest.fn();
  const mockInvoke = jest.fn();
  return {
    contextBridge: { exposeInMainWorld: mockExposeInMainWorld },
    ipcRenderer: { invoke: mockInvoke },
    __mocks: { mockExposeInMainWorld, mockInvoke },
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

    expect(mockInvoke).toHaveBeenCalledTimes(8);
    expect(mockInvoke).toHaveBeenNthCalledWith(1, 'lo-core:config');
    expect(mockInvoke).toHaveBeenNthCalledWith(2, 'lo-core:configure', { host: 'h' });
    expect(mockInvoke).toHaveBeenNthCalledWith(3, 'lo-core:login', 'x-invalid-arg');
    expect(mockInvoke).toHaveBeenNthCalledWith(4, 'lo-core:status');
    expect(mockInvoke).toHaveBeenNthCalledWith(5, 'lo-core:list-notes', { limit: 5 });
    expect(mockInvoke).toHaveBeenNthCalledWith(6, 'lo-core:get-note', 'res_1');
    expect(mockInvoke).toHaveBeenNthCalledWith(7, 'lo-core:update-note', 'res_1', { content: 'x' });
    expect(mockInvoke).toHaveBeenNthCalledWith(8, 'lo-core:logout');
  });
});
