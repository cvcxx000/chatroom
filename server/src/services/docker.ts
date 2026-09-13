import Docker from 'dockerode';
import type { Container } from 'dockerode';
import { env } from '../config/env';

const NAME_PREFIX = 'chatroom-term-';
const DOCKER_UNAVAILABLE_ERROR =
  'Docker is not available. Please install Docker on the server.';

/** Handle returned after attaching to a container's stdio. */
export interface AttachHandle {
  write(data: string): void;
  resize(cols: number, rows: number): void;
  destroy(): void;
}

/** Public container status shape used by REST / WebSocket routes. */
export interface ContainerInfo {
  id: string;
  name: string;
  status: string;
  createdAt: string;
  image: string;
  userId?: string;
}

/** Mutable (in-memory) terminal resource configuration exposed to admins. */
export interface TerminalConfig {
  cpus: number;
  memory: number; // bytes
  image: string;
  timeoutMinutes: number;
  networkDisabled: boolean;
}

interface ManagedContainer {
  containerId: string;
  name: string;
  userId: string;
  image: string;
  createdAt: string;
  lastActivity: number;
}

/**
 * Owns the Docker socket connection and all chatroom terminal containers.
 *
 * The service degrades gracefully: if Docker cannot be reached at startup it
 * stays `available = false` and every operation throws a clear error instead
 * of crashing the process.
 */
class DockerService {
  private docker: Docker | null = null;
  public available = false;

  private managed = new Map<string, ManagedContainer>();
  private reaperTimer: NodeJS.Timeout | null = null;

  /** In-memory runtime configuration (overridable by admins at runtime). */
  private terminalConfig: TerminalConfig = {
    cpus: 0.5,
    memory: env.TERMINAL_MEMORY,
    image: env.TERMINAL_IMAGE,
    timeoutMinutes: env.TERMINAL_TIMEOUT_MINUTES,
    networkDisabled: env.TERMINAL_NETWORK_DISABLED,
  };

  constructor() {
    try {
      this.docker = new Docker({ socketPath: env.DOCKER_SOCKET_PATH });
      this.checkAvailability();
      this.startIdleReaper();
      this.registerProcessCleanup();
    } catch (err) {
      this.available = false;
      // eslint-disable-next-line no-console
      console.error('[docker] failed to initialize Docker client:', err);
    }
  }

  /** Probe Docker on startup; never throws. */
  private checkAvailability(): void {
    if (!this.docker) return;
    this.docker
      .ping()
      .then(() => {
        this.available = true;
        // eslint-disable-next-line no-console
        console.log('[docker] connection established to', env.DOCKER_SOCKET_PATH);
      })
      .catch((err) => {
        this.available = false;
        // eslint-disable-next-line no-console
        console.error(
          '[docker] Docker is not available at',
          env.DOCKER_SOCKET_PATH,
          '- virtual terminal disabled:',
          err && err.message ? err.message : err,
        );
      });
  }

  private assertAvailable(): void {
    if (!this.docker || !this.available) {
      throw new Error(DOCKER_UNAVAILABLE_ERROR);
    }
  }

  // ---------------------------------------------------------------- config

  getTerminalConfig(): TerminalConfig {
    return { ...this.terminalConfig };
  }

  updateTerminalConfig(patch: Partial<TerminalConfig>): TerminalConfig {
    if (typeof patch.cpus === 'number') this.terminalConfig.cpus = patch.cpus;
    if (typeof patch.memory === 'number') this.terminalConfig.memory = patch.memory;
    if (typeof patch.image === 'string' && patch.image) this.terminalConfig.image = patch.image;
    if (typeof patch.timeoutMinutes === 'number')
      this.terminalConfig.timeoutMinutes = patch.timeoutMinutes;
    if (typeof patch.networkDisabled === 'boolean')
      this.terminalConfig.networkDisabled = patch.networkDisabled;
    return this.getTerminalConfig();
  }

  // ---------------------------------------------------------------- lifecycle

  /**
   * Create a restricted alpine container running /bin/sh.
   */
  async createContainer(userId: string): Promise<string> {
    this.assertAvailable();
    const docker = this.docker!;

    // [SECURITY] Limit the number of concurrent containers per user to prevent
    // resource exhaustion (Docker daemon CPU/memory/disk DoS).
    let userContainerCount = 0;
    for (const m of this.managed.values()) {
      if (m.userId === userId) userContainerCount++;
    }
    const MAX_CONTAINERS_PER_USER = 3;
    if (userContainerCount >= MAX_CONTAINERS_PER_USER) {
      throw new Error(
        `Maximum ${MAX_CONTAINERS_PER_USER} containers per user. Stop an existing one first.`,
      );
    }

    const shortId = Math.random().toString(36).slice(2, 10);
    const name = `${NAME_PREFIX}${userId}-${shortId}`;
    const image = this.terminalConfig.image;

    // CpuQuota / CpuPeriod: 0.5 CPU -> quota=50000us over period=100000us.
    const cpuQuota = Math.round(this.terminalConfig.cpus * 100000);

    const buildOptions = (useNonRoot: boolean): Docker.ContainerCreateOptions => ({
      name,
      Image: image,
      Cmd: ['/bin/sh'],
      OpenStdin: true,
      Tty: true,
      AttachStdin: true,
      AttachStdout: true,
      AttachStderr: true,
      // Non-root; falls back to default root if the image lacks uid 1000.
      User: useNonRoot ? '1000:1000' : undefined,
      HostConfig: {
        CpuQuota: cpuQuota,
        CpuPeriod: 100000,
        Memory: this.terminalConfig.memory,
        ReadonlyRootfs: true,
        Tmpfs: { '/tmp': '', '/home': '' },
        NetworkMode: this.terminalConfig.networkDisabled ? 'none' : 'bridge',
      },
    });

    let container: Container;
    try {
      container = await docker.createContainer(buildOptions(true));
    } catch (err) {
      // Retry without the non-root user if the image has no uid 1000.
      // eslint-disable-next-line no-console
      console.warn('[docker] create as 1000:1000 failed, retrying with default user:', (err as Error).message);
      container = await docker.createContainer(buildOptions(false));
    }

    await container.start();
    await this.waitForRunning(container, 10000);

    const inspect = await container.inspect();
    const containerId = inspect.Id;

    this.managed.set(containerId, {
      containerId,
      name,
      userId,
      image,
      createdAt: inspect.Created,
      lastActivity: Date.now(),
    });

    return containerId;
  }

  private async waitForRunning(container: Container, timeoutMs: number): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const info = await container.inspect();
      if (info.State && info.State.Running) return;
      await new Promise((r) => setTimeout(r, 200));
    }
    throw new Error('Container did not enter running state in time');
  }

  /**
   * Attach to a container's stdio and return a small control handle.
   */
  async attachContainer(
    containerId: string,
    onOutput: (data: string) => void,
    onClose: () => void,
  ): Promise<AttachHandle> {
    this.assertAvailable();
    const docker = this.docker!;
    const container = docker.getContainer(containerId);

    const stream = await container.attach({
      stream: true,
      stdin: true,
      stdout: true,
      stderr: true,
    });

    let closed = false;
    const fireClose = () => {
      if (closed) return;
      closed = true;
      onClose();
    };

    stream.on('data', (chunk: Buffer) => {
      this.touch(containerId);
      onOutput(chunk.toString('utf8'));
    });
    stream.on('end', fireClose);
    stream.on('close', fireClose);
    stream.on('error', () => fireClose());

    return {
      write: (data: string) => {
        this.touch(containerId);
        stream.write(data);
      },
      resize: (cols: number, rows: number) => {
        container.resize({ h: rows, w: cols }).catch((err) => {
          // eslint-disable-next-line no-console
          console.error('[docker] resize failed:', err);
        });
      },
      destroy: () => {
        try {
          stream.end();
          (stream as unknown as { destroy(): void }).destroy();
        } catch {
          /* ignore */
        }
      },
    };
  }

  /** Stop and remove a container (force). */
  async stopContainer(containerId: string): Promise<void> {
    if (!this.docker) return;
    const docker = this.docker;
    const container = docker.getContainer(containerId);
    try {
      await container.stop({ t: 5 });
    } catch {
      /* already stopped / gone */
    }
    try {
      await container.remove({ force: true });
    } catch {
      /* already removed */
    }
    this.managed.delete(this.resolveManagedKey(containerId));
  }

  /** Inspect a single container's status. */
  async getContainerStatus(containerId: string): Promise<ContainerInfo> {
    this.assertAvailable();
    const inspect = await this.docker!.getContainer(containerId).inspect();
    return {
      id: inspect.Id,
      name: (inspect.Name || '').replace(/^\//, ''),
      status: (inspect.State && inspect.State.Status) || 'unknown',
      createdAt: inspect.Created || '',
      image: (inspect.Config && inspect.Config.Image) || '',
      userId: (this.managed.get(containerId) || this.findManaged(containerId))?.userId,
    };
  }

  /** List all chatroom terminal containers that are currently running. */
  async listContainers(): Promise<ContainerInfo[]> {
    this.assertAvailable();
    const list = await this.docker!.listContainers({ all: false });
    const result: ContainerInfo[] = [];
    for (const c of list) {
      const names = c.Names || [];
      const prefixed = names.find((n) => n.slice(1).startsWith(NAME_PREFIX));
      if (!prefixed) continue;
      const name = prefixed.slice(1);
      const managedEntry = this.findManaged(name);
      result.push({
        id: c.Id,
        name,
        status: c.State || 'unknown',
        createdAt: c.Created ? String(c.Created) : '',
        image: c.Image || '',
        userId: managedEntry ? managedEntry.userId : this.parseUserIdFromName(name) ?? undefined,
      });
    }
    return result;
  }

  /**
   * Resolve the owning userId for a container id or name. Used for ownership
   * checks. Returns null when the container cannot be resolved.
   */
  async getContainerOwner(containerId: string): Promise<string | null> {
    this.assertAvailable();
    const managedEntry = this.findManaged(containerId);
    if (managedEntry) return managedEntry.userId;
    try {
      const inspect = await this.docker!.getContainer(containerId).inspect();
      const name = (inspect.Name || '').replace(/^\//, '');
      return this.parseUserIdFromName(name);
    } catch {
      return null;
    }
  }

  // ---------------------------------------------------------------- helpers

  /** Update last activity for a container (by id or name). */
  private touch(containerRef: string): void {
    const entry = this.findManaged(containerRef);
    if (entry) entry.lastActivity = Date.now();
  }

  private findManaged(ref: string): ManagedContainer | undefined {
    if (this.managed.has(ref)) return this.managed.get(ref);
    for (const m of this.managed.values()) {
      // [SECURITY] Exact match only: previously used startsWith(), which allowed
      // a user to pass a short container-ID prefix and resolve to another user's
      // container (IDOR / cross-user container access).
      if (m.containerId === ref || m.name === ref) return m;
    }
    return undefined;
  }

  private resolveManagedKey(ref: string): string {
    const m = this.findManaged(ref);
    return m ? m.containerId : ref;
  }

  /**
   * Container names look like `chatroom-term-{userId}-{random}`. userId is a
   * UUID containing hyphens, so strip the fixed prefix and the trailing random
   * segment.
   */
  private parseUserIdFromName(name: string): string | null {
    const match = name.match(/^chatroom-term-(.+)-[^-]+$/);
    return match ? match[1] : null;
  }

  /** Sweep idle containers every 60s; destroy after the configured timeout. */
  private startIdleReaper(): void {
    this.reaperTimer = setInterval(() => {
      const now = Date.now();
      const timeoutMs = this.terminalConfig.timeoutMinutes * 60 * 1000;
      for (const m of Array.from(this.managed.values())) {
        if (now - m.lastActivity > timeoutMs) {
          // eslint-disable-next-line no-console
          console.log('[docker] idle timeout reached, destroying container', m.name);
          this.stopContainer(m.containerId).catch((err) => {
            // eslint-disable-next-line no-console
            console.error('[docker] reaper failed to stop container:', err);
          });
        }
      }
    }, 60 * 1000);
    if (typeof this.reaperTimer.unref === 'function') this.reaperTimer.unref();
  }

  /** Best-effort cleanup of all managed containers on process exit. */
  private registerProcessCleanup(): void {
    const cleanup = async () => {
      if (!this.available) return;
      for (const m of Array.from(this.managed.values())) {
        try {
          await this.stopContainer(m.containerId);
        } catch {
          /* ignore */
        }
      }
    };
    process.on('SIGTERM', () => {
      cleanup().finally(() => process.exit(0));
    });
    process.on('SIGINT', () => {
      cleanup().finally(() => process.exit(0));
    });
  }
}

export const dockerService = new DockerService();
export { DOCKER_UNAVAILABLE_ERROR };
