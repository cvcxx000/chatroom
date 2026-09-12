import api from './client';

export interface TerminalContainer {
  id: string;
  name: string;
  status: string;
  createdAt: string;
  image: string;
  userId?: string;
}

export interface TerminalConfig {
  cpus: number;
  memory: string;
  image: string;
  timeoutMinutes: number;
  networkDisabled: boolean;
}

export interface StartTerminalResponse {
  containerId: string;
  wsPath: string;
}

export const terminalApi = {
  startTerminal: async (): Promise<StartTerminalResponse> => {
    return (await api.post('/terminal/start')) as unknown as StartTerminalResponse;
  },
  stopTerminal: async (containerId: string): Promise<{ ok: boolean }> => {
    return (await api.post(`/terminal/${containerId}/stop`)) as unknown as { ok: boolean };
  },
  getTerminalStatus: async (
    containerId: string,
  ): Promise<{ id: string; status: string; createdAt: string; image: string }> => {
    return (await api.get(`/terminal/${containerId}/status`)) as unknown as {
      id: string;
      status: string;
      createdAt: string;
      image: string;
    };
  },
};

export const adminTerminalApi = {
  listTerminals: async (): Promise<{ containers: TerminalContainer[]; dockerAvailable: boolean }> => {
    return (await api.get('/admin/terminals')) as unknown as {
      containers: TerminalContainer[];
      dockerAvailable: boolean;
    };
  },
  adminStopTerminal: async (id: string): Promise<{ ok: boolean }> => {
    return (await api.post(`/admin/terminals/${id}/stop`)) as unknown as { ok: boolean };
  },
  getTerminalConfig: async (): Promise<TerminalConfig> => {
    return (await api.get('/admin/terminal-config')) as unknown as TerminalConfig;
  },
  updateTerminalConfig: async (cfg: Partial<TerminalConfig>): Promise<TerminalConfig> => {
    return (await api.put('/admin/terminal-config', cfg)) as unknown as TerminalConfig;
  },
};
