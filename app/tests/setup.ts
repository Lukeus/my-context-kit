import { beforeEach, vi } from 'vitest';

type StubMethod = ReturnType<typeof vi.fn>;

type RepoApi = {
  list: StubMethod;
  add: StubMethod;
  update: StubMethod;
  remove: StubMethod;
  setActive: StubMethod;
  watch: StubMethod;
  onFileChanged: StubMethod;
};

type SettingsApi = {
  get: StubMethod;
  set: StubMethod;
};

type ContextApi = Record<string, StubMethod>;

type GitApi = Record<string, StubMethod>;

type FsApi = Record<string, StubMethod>;

type ClipboardApi = Record<string, StubMethod>;

type AiApi = Record<string, StubMethod>;

type AppApi = {
  getDefaultRepoPath: StubMethod;
};

const createDefaultStub = () => vi.fn(async () => ({}));

beforeEach(() => {
  const repoApi: RepoApi = {
    list: createDefaultStub(),
    add: createDefaultStub(),
    update: createDefaultStub(),
    remove: createDefaultStub(),
    setActive: createDefaultStub(),
    watch: createDefaultStub(),
    onFileChanged: vi.fn().mockReturnValue(() => { /* noop */ }),
  };

  const settingsApi: SettingsApi = {
    get: createDefaultStub(),
    set: createDefaultStub(),
  };

  const contextApi: ContextApi = {
    buildGraph: createDefaultStub(),
    validate: createDefaultStub(),
    impact: createDefaultStub(),
    generate: createDefaultStub(),
    nextId: createDefaultStub(),
    createEntity: createDefaultStub(),
    getSuggestions: createDefaultStub(),
    getTemplates: createDefaultStub(),
  };

  const gitApi: GitApi = {
    status: createDefaultStub(),
    diff: createDefaultStub(),
    commit: createDefaultStub(),
    branch: createDefaultStub(),
    createBranch: createDefaultStub(),
    checkout: createDefaultStub(),
    push: createDefaultStub(),
    createPR: createDefaultStub(),
  };

  const fsApi: FsApi = {
    readFile: createDefaultStub(),
    writeFile: createDefaultStub(),
    findEntityFile: createDefaultStub(),
  };

  const clipboardApi: ClipboardApi = {
    writeText: createDefaultStub(),
  };

  const aiApi: AiApi = {
    getConfig: createDefaultStub(),
    saveConfig: createDefaultStub(),
    saveCredentials: createDefaultStub(),
    getCredentials: createDefaultStub(),
    testConnection: createDefaultStub(),
    generate: createDefaultStub(),
    assist: createDefaultStub(),
    applyEdit: createDefaultStub(),
    assistStreamStart: createDefaultStub(),
    onAssistStreamEvent: vi.fn().mockReturnValue(() => { /* noop */ }),
    onAssistStreamEnd: vi.fn().mockReturnValue(() => { /* noop */ }),
  };

  const appApi: AppApi = {
    getDefaultRepoPath: createDefaultStub(),
  };

  (global as any).window = {
    api: {
      repos: repoApi,
      settings: settingsApi,
      context: contextApi,
      git: gitApi,
      fs: fsApi,
      clipboard: clipboardApi,
      ai: aiApi,
      app: appApi,
    },
  };
});
