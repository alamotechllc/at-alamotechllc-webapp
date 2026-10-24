import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export interface SecretVersion {
  secretResource: string;
}

/** Create and add versions. raas-api receives this and does not read payloads. */
export interface SecretWriter {
  addVersion(secretId: string, payload: string): Promise<SecretVersion>;
}

/** Read a version. The GoHighLevel adapter receives this and does not create secrets. */
export interface SecretReader {
  access(secretResource: string): Promise<string>;
}

export function secretResourceName(projectId: string, secretId: string): string {
  return `projects/${projectId}/secrets/${secretId}/versions/latest`;
}

export function assertSecretId(secretId: string): void {
  if (!/^[a-z0-9_-]+$/.test(secretId)) {
    throw new Error("secret id is invalid");
  }
}

export class MemorySecretStore implements SecretWriter, SecretReader {
  private readonly versions = new Map<string, string>();
  readonly addedSecretIds: string[] = [];

  constructor(private readonly projectId: string) {}

  async addVersion(secretId: string, payload: string): Promise<SecretVersion> {
    assertSecretId(secretId);
    if (!payload) throw new Error("secret payload is empty");
    const secretResource = secretResourceName(this.projectId, secretId);
    this.versions.set(secretResource, payload);
    this.addedSecretIds.push(secretId);
    return { secretResource };
  }

  async access(secretResource: string): Promise<string> {
    const payload = this.versions.get(secretResource);
    if (payload === undefined) throw new Error("secret version was not found");
    return payload;
  }
}

export class FileSecretStore implements SecretWriter, SecretReader {
  constructor(
    private readonly projectId: string,
    private readonly directory: string,
  ) {}

  async addVersion(secretId: string, payload: string): Promise<SecretVersion> {
    assertSecretId(secretId);
    if (!payload) throw new Error("secret payload is empty");
    const secretResource = secretResourceName(this.projectId, secretId);
    const versions = await this.read();
    versions[secretResource] = payload;
    await mkdir(this.directory, { recursive: true });
    await writeFile(this.file(), JSON.stringify(versions), { mode: 0o600 });
    return { secretResource };
  }

  async access(secretResource: string): Promise<string> {
    const payload = (await this.read())[secretResource];
    if (typeof payload !== "string") throw new Error("secret version was not found");
    return payload;
  }

  private file(): string {
    return path.join(this.directory, "versions.json");
  }

  private async read(): Promise<Record<string, string>> {
    try {
      const parsed = JSON.parse(await readFile(this.file(), "utf8")) as unknown;
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
      return parsed as Record<string, string>;
    } catch {
      return {};
    }
  }
}
