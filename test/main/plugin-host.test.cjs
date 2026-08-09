const { createPluginHost } = require('../../src/main/plugin/plugin-host.cjs');

function makeLoCore() {
  return {
    getStatus: jest.fn(async () => ({ ok: true })),
    listNotes: jest.fn(async () => ({ ok: true })),
    getNote: jest.fn(async () => ({ ok: true })),
    updateNote: jest.fn(async () => ({ ok: true })),
    getRelations: jest.fn(async () => ({ ok: true })),
    listOperations: jest.fn(async () => ({ ok: true })),
    undoOperation: jest.fn(async () => ({ ok: true })),
    subscribeEvents: jest.fn(() => ({ ok: true })),
    unsubscribeEvents: jest.fn(() => ({ ok: true })),
    client: { auth: { authenticated: true } },
  };
}

describe('createPluginHost', () => {
  it('暴露受控方法（白名单）', () => {
    const host = createPluginHost(makeLoCore());
    const methods = [
      'getStatus', 'listNotes', 'getNote', 'updateNote',
      'getRelations', 'listOperations', 'undoOperation',
      'subscribeEvents', 'unsubscribeEvents', 'isAuthenticated',
    ];
    for (const m of methods) {
      expect(typeof host[m]).toBe('function');
    }
  });

  it('不暴露 LoClient 原始对象', () => {
    const host = createPluginHost(makeLoCore());
    expect(host.client).toBeUndefined();
    expect(host.loCore).toBeUndefined();
    expect(host.request).toBeUndefined();
  });

  it('方法委托到 LoCoreService', async () => {
    const loCore = makeLoCore();
    const host = createPluginHost(loCore);
    await host.getStatus();
    await host.listNotes({ limit: 5 });
    await host.getNote('res_1');
    await host.getRelations('res_1');
    await host.listOperations({ limit: 10 });
    await host.undoOperation('op_1');
    expect(loCore.getStatus).toHaveBeenCalled();
    expect(loCore.listNotes).toHaveBeenCalledWith({ limit: 5 });
    expect(loCore.getNote).toHaveBeenCalledWith('res_1');
    expect(loCore.getRelations).toHaveBeenCalledWith('res_1');
    expect(loCore.listOperations).toHaveBeenCalledWith({ limit: 10 });
    expect(loCore.undoOperation).toHaveBeenCalledWith('op_1');
  });

  it('isAuthenticated 读取 client 认证状态', () => {
    const host = createPluginHost(makeLoCore());
    expect(host.isAuthenticated()).toBe(true);
  });
});
