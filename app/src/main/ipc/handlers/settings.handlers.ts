import { ipcMain, app } from 'electron';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { toErrorMessage } from '../../utils/errorHandler';
import { successWith, error } from '../types';

const APP_SETTINGS_FILE = 'app-settings.json';

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const getSettingsFilePath = (): string => path.join(app.getPath('userData'), APP_SETTINGS_FILE);

const loadAppSettings = async (): Promise<Record<string, unknown>> => {
  try {
    const content = await readFile(getSettingsFilePath(), 'utf-8');
    const parsed = JSON.parse(content);
    if (isPlainObject(parsed)) {
      return parsed;
    }
    console.warn('App settings file was not a plain object; resetting.');
    return {};
  } catch (error: any) {
    if (error?.code === 'ENOENT') {
      return {};
    }
    console.warn('Failed to load app settings; returning empty object.', error);
    return {};
  }
};

const saveAppSettings = async (settings: Record<string, unknown>): Promise<void> => {
  await writeFile(getSettingsFilePath(), JSON.stringify(settings, null, 2), 'utf-8');
};

/**
 * Registers all settings IPC handlers
 */
export function registerSettingsHandlers(): void {
  ipcMain.handle('settings:get', async (_event, { key }: { key: string }) => {
    try {
      const settings = await loadAppSettings();
      return successWith({ value: settings[key] });
    } catch (err) {
      return error(toErrorMessage(err, 'Failed to load setting'));
    }
  });

  ipcMain.handle('settings:set', async (_event, { key, value }: { key: string; value: unknown }) => {
    try {
      const settings = await loadAppSettings();
      settings[key] = value;
      await saveAppSettings(settings);
      return successWith({});
    } catch (err) {
      return error(toErrorMessage(err, 'Failed to save setting'));
    }
  });
}
