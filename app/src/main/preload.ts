import { contextBridge, ipcRenderer } from 'electron';

// Expose IPC API to renderer process
contextBridge.exposeInMainWorld('api', {
  context: {
    validate: (dir: string) => ipcRenderer.invoke('context:validate', { dir }),
    buildGraph: (dir: string) => ipcRenderer.invoke('context:buildGraph', { dir }),
    impact: (dir: string, changedIds: string[]) => ipcRenderer.invoke('context:impact', { dir, changedIds }),
    generate: (dir: string, ids: string[]) => ipcRenderer.invoke('context:generate', { dir, ids }),
    nextId: (dir: string, entityType: string) => ipcRenderer.invoke('context:nextId', { dir, entityType }),
    createEntity: (dir: string, entity: any, entityType: string) => ipcRenderer.invoke('context:createEntity', { dir, entity, entityType }),
    getSuggestions: (dir: string, command: string, params: any[]) => ipcRenderer.invoke('context:getSuggestions', { dir, command, params }),
    getTemplates: (dir: string, entityType?: string) => ipcRenderer.invoke('context:getTemplates', { dir, entityType }),
  },
  fs: {
    readFile: (filePath: string) => ipcRenderer.invoke('fs:readFile', { filePath }),
    writeFile: (filePath: string, content: string) => ipcRenderer.invoke('fs:writeFile', { filePath, content }),
    findEntityFile: (dir: string, entityType: string, entityId: string) => ipcRenderer.invoke('fs:findEntityFile', { dir, entityType, entityId }),
  },
  clipboard: {
    writeText: (text: string) => ipcRenderer.invoke('clipboard:writeText', { text }),
  },
  git: {
    status: (dir: string) => ipcRenderer.invoke('git:status', { dir }),
    diff: (dir: string, filePath?: string) => ipcRenderer.invoke('git:diff', { dir, filePath }),
    commit: (dir: string, message: string, files?: string[]) => ipcRenderer.invoke('git:commit', { dir, message, files }),
    branch: (dir: string) => ipcRenderer.invoke('git:branch', { dir }),
    createBranch: (dir: string, branchName: string, checkout?: boolean) => ipcRenderer.invoke('git:createBranch', { dir, branchName, checkout }),
    checkout: (dir: string, branchName: string) => ipcRenderer.invoke('git:checkout', { dir, branchName }),
    push: (dir: string, remote?: string, branch?: string) => ipcRenderer.invoke('git:push', { dir, remote, branch }),
    createPR: (dir: string, title: string, body: string, base?: string) => ipcRenderer.invoke('git:createPR', { dir, title, body, base }),
  },
  ai: {
    getConfig: (dir: string) => ipcRenderer.invoke('ai:getConfig', { dir }),
    saveConfig: (dir: string, config: any) => ipcRenderer.invoke('ai:saveConfig', { dir, config }),
    saveCredentials: (provider: string, apiKey: string) => ipcRenderer.invoke('ai:saveCredentials', { provider, apiKey }),
    getCredentials: (provider: string) => ipcRenderer.invoke('ai:getCredentials', { provider }),
    testConnection: (dir: string, provider: string, endpoint: string, model: string, useStoredKey: boolean) => 
      ipcRenderer.invoke('ai:testConnection', { dir, provider, endpoint, model, useStoredKey }),
    generate: (dir: string, entityType: string, userPrompt: string) => 
      ipcRenderer.invoke('ai:generate', { dir, entityType, userPrompt }),
  },
});

// Type definitions for window.api
declare global {
  interface Window {
    api: {
      context: {
        validate: (dir: string) => Promise<any>;
        buildGraph: (dir: string) => Promise<any>;
        impact: (dir: string, changedIds: string[]) => Promise<any>;
        generate: (dir: string, ids: string[]) => Promise<any>;
        nextId: (dir: string, entityType: string) => Promise<{ ok: boolean; id?: string; error?: string }>;
        createEntity: (dir: string, entity: any, entityType: string) => Promise<{ ok: boolean; filePath?: string; error?: string }>;
        getSuggestions: (dir: string, command: string, params: any[]) => Promise<any>;
        getTemplates: (dir: string, entityType?: string) => Promise<{ ok: boolean; templates: any[]; error?: string }>;
      };
      fs: {
        readFile: (filePath: string) => Promise<{ ok: boolean; content?: string; error?: string }>;
        writeFile: (filePath: string, content: string) => Promise<{ ok: boolean; error?: string }>;
        findEntityFile: (dir: string, entityType: string, entityId: string) => Promise<{ ok: boolean; filePath?: string; error?: string }>;
      };
      clipboard: {
        writeText: (text: string) => Promise<{ ok: boolean; error?: string }>;
      };
      git: {
        status: (dir: string) => Promise<any>;
        diff: (dir: string, filePath?: string) => Promise<any>;
        commit: (dir: string, message: string, files?: string[]) => Promise<any>;
        branch: (dir: string) => Promise<any>;
        createBranch: (dir: string, branchName: string, checkout?: boolean) => Promise<any>;
        checkout: (dir: string, branchName: string) => Promise<any>;
        push: (dir: string, remote?: string, branch?: string) => Promise<any>;
        createPR: (dir: string, title: string, body: string, base?: string) => Promise<any>;
      };
      ai: {
        getConfig: (dir: string) => Promise<{ ok: boolean; config?: any; error?: string }>;
        saveConfig: (dir: string, config: any) => Promise<{ ok: boolean; error?: string }>;
        saveCredentials: (provider: string, apiKey: string) => Promise<{ ok: boolean; error?: string }>;
        getCredentials: (provider: string) => Promise<{ ok: boolean; hasCredentials?: boolean; error?: string }>;
        testConnection: (dir: string, provider: string, endpoint: string, model: string, useStoredKey: boolean) => 
          Promise<{ ok: boolean; message?: string; error?: string }>;
        generate: (dir: string, entityType: string, userPrompt: string) => 
          Promise<{ ok: boolean; entity?: any; usage?: any; error?: string; rawContent?: string }>;
      };
    };
  }
}
