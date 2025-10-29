import { BrowserWindow } from 'electron';

export function broadcastAssistantStream(payload: unknown) {
  const windows = BrowserWindow.getAllWindows();
  for (const win of windows) {
    try {
      win.webContents.send('assistant:stream-event', payload);
    } catch {
      // ignore send failures for closed windows
    }
  }
}
