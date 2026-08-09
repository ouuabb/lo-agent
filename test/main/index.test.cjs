const path = require('path');

jest.mock('electron', () => {
  const mockLoadFile = jest.fn();
  const mockSetWindowOpenHandler = jest.fn();
  const mockOpenExternal = jest.fn();
  const mockGetAllWindows = jest.fn();
  const mockQuit = jest.fn();
  const mockWhenReady = jest.fn();
  const mockAppOn = jest.fn();
  mockWhenReady.mockResolvedValue(undefined);
  mockGetAllWindows.mockReturnValue([]);

  const mockWindow = {
    loadFile: mockLoadFile,
    webContents: { setWindowOpenHandler: mockSetWindowOpenHandler },
  };
  const MockBrowserWindow = jest.fn(() => mockWindow);

  return {
    app: {
      whenReady: mockWhenReady,
      on: mockAppOn,
      quit: mockQuit,
    },
    BrowserWindow: Object.assign(MockBrowserWindow, {
      getAllWindows: mockGetAllWindows,
    }),
    shell: { openExternal: mockOpenExternal },
    __mocks: {
      mockLoadFile,
      mockSetWindowOpenHandler,
      mockOpenExternal,
      mockGetAllWindows,
      mockQuit,
      mockWhenReady,
      mockAppOn,
      MockBrowserWindow,
      mockWindow,
    },
  };
});

describe('src/main/index.cjs', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  function loadMain() {
    const mocks = require('electron').__mocks;
    require('../../src/main/index.cjs');
    return mocks;
  }

  function awaitReady() {
    return new Promise((resolve) => setImmediate(resolve));
  }

  it('whenReady 后创建主窗口并加载渲染进程', async () => {
    const { MockBrowserWindow, mockLoadFile } = loadMain();
    await awaitReady();

    expect(MockBrowserWindow).toHaveBeenCalledTimes(1);
    const [options] = MockBrowserWindow.mock.calls[0];
    expect(options.width).toBe(1200);
    expect(options.height).toBe(800);
    expect(mockLoadFile).toHaveBeenCalledWith(
      path.join(__dirname, '..', '..', 'src', 'renderer', 'index.html'),
    );
  });

  it('webPreferences 符合安全基线', async () => {
    const { MockBrowserWindow } = loadMain();
    await awaitReady();

    const [options] = MockBrowserWindow.mock.calls[0];
    expect(options.webPreferences).toMatchObject({
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    });
    expect(options.webPreferences.preload).toBe(
      path.join(__dirname, '..', '..', 'src', 'preload', 'index.cjs'),
    );
  });

  it('外部链接交由系统浏览器打开', async () => {
    const { mockSetWindowOpenHandler, mockOpenExternal } = loadMain();
    await awaitReady();

    expect(mockSetWindowOpenHandler).toHaveBeenCalled();
    const handler = mockSetWindowOpenHandler.mock.calls[0][0];
    const result = handler({ url: 'https://example.com' });
    expect(result).toEqual({ action: 'deny' });
    expect(mockOpenExternal).toHaveBeenCalledWith('https://example.com');
  });

  it('window-all-closed 时退出应用', async () => {
    const { mockAppOn, mockQuit } = loadMain();
    await awaitReady();

    const handler = mockAppOn.mock.calls.find(
      ([event]) => event === 'window-all-closed',
    )[1];
    handler();
    expect(mockQuit).toHaveBeenCalled();
  });

  it('activate 且无窗口时重建主窗口', async () => {
    const { mockAppOn, mockGetAllWindows, MockBrowserWindow } = loadMain();
    await awaitReady();
    mockGetAllWindows.mockReturnValue([]);

    const handler = mockAppOn.mock.calls.find(
      ([event]) => event === 'activate',
    )[1];
    handler();

    expect(MockBrowserWindow).toHaveBeenCalledTimes(2);
  });
});
