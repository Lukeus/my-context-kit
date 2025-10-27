import { vi } from 'vitest';

export const app = {
  getPath: vi.fn((name: string) => `/mock/user/data`),
  getAppPath: vi.fn(() => '/mock/app/path'),
  isReady: vi.fn(() => true),
  whenReady: vi.fn(() => Promise.resolve()),
  isPackaged: false,
};

export const safeStorage = {
  isEncryptionAvailable: vi.fn(() => true),
  encryptString: vi.fn((str: string) => Buffer.from(`encrypted:${str}`)),
  decryptString: vi.fn((buf: Buffer) => buf.toString().replace('encrypted:', '')),
};

export const ipcMain = {
  handle: vi.fn(),
  on: vi.fn(),
  removeHandler: vi.fn(),
};

export const clipboard = {
  writeText: vi.fn(),
  readText: vi.fn(() => ''),
};

export const dialog = {
  showOpenDialog: vi.fn(() => Promise.resolve({ canceled: false, filePaths: [] })),
  showSaveDialog: vi.fn(() => Promise.resolve({ canceled: false, filePath: '' })),
};

export const BrowserWindow = vi.fn();
