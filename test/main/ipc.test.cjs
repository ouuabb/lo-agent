const { registerLoCoreIpc, CHANNELS } = require('../../src/main/ipc.cjs');

function makeService() {
  return {
    load: jest.fn(() => ({ host: 'h' })),
    configure: jest.fn((cfg) => ({ ok: true, config: cfg })),
    login: jest.fn(async (p) => ({ ok: true, token: 't' })),
    getStatus: jest.fn(async () => ({ ok: true, stats: {} })),
    listNotes: jest.fn(async (q) => ({ ok: true, data: [] })),
    logout: jest.fn(() => ({ ok: true })),
  };
}

describe('registerLoCoreIpc', () => {
  it('为每个通道注册 handle', () => {
    const ipcMain = { handle: jest.fn() };
    const service = makeService();
    registerLoCoreIpc(ipcMain, service);

    expect(ipcMain.handle).toHaveBeenCalledWith(CHANNELS.CONFIG, expect.any(Function));
    expect(ipcMain.handle).toHaveBeenCalledWith(CHANNELS.CONFIGURE, expect.any(Function));
    expect(ipcMain.handle).toHaveBeenCalledWith(CHANNELS.LOGIN, expect.any(Function));
    expect(ipcMain.handle).toHaveBeenCalledWith(CHANNELS.STATUS, expect.any(Function));
    expect(ipcMain.handle).toHaveBeenCalledWith(CHANNELS.LIST_NOTES, expect.any(Function));
    expect(ipcMain.handle).toHaveBeenCalledWith(CHANNELS.LOGOUT, expect.any(Function));
    expect(ipcMain.handle.mock.calls.length).toBe(6);
  });

  it('handler 委托并传参', async () => {
    const ipcMain = { handle: jest.fn() };
    const service = makeService();
    registerLoCoreIpc(ipcMain, service);

    const byChannel = (ch) => ipcMain.handle.mock.calls.find(([c]) => c === ch)[1];

    expect(await byChannel(CHANNELS.CONFIG)()).toEqual({ host: 'h' });
    expect(await byChannel(CHANNELS.CONFIGURE)({}, { port: 1 })).toEqual({
      ok: true,
      config: { port: 1 },
    });
    expect(service.configure).toHaveBeenCalledWith({ port: 1 });

    await byChannel(CHANNELS.LOGIN)({}, { privateKeyPath: '/k' });
    expect(service.login).toHaveBeenCalledWith({ privateKeyPath: '/k' });

    await byChannel(CHANNELS.STATUS)();
    expect(service.getStatus).toHaveBeenCalled();

    await byChannel(CHANNELS.LIST_NOTES)({}, { limit: 5 });
    expect(service.listNotes).toHaveBeenCalledWith({ limit: 5 });

    await byChannel(CHANNELS.CONFIGURE)({}, undefined);
    expect(service.configure).toHaveBeenCalledWith({});

    await byChannel(CHANNELS.LOGIN)({}, undefined);
    expect(service.login).toHaveBeenCalledWith({});

    await byChannel(CHANNELS.LIST_NOTES)({}, undefined);
    expect(service.listNotes).toHaveBeenCalledWith({});

    await byChannel(CHANNELS.LOGOUT)();
    expect(service.logout).toHaveBeenCalled();
  });
});
