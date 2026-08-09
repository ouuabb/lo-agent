jest.mock('electron', () => {
  const mockExposeInMainWorld = jest.fn();
  return {
    contextBridge: { exposeInMainWorld: mockExposeInMainWorld },
    __mocks: { mockExposeInMainWorld },
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
  });
});