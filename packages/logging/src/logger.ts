import { redact } from "./redact";

export interface LogEntry {
  severity: "DEBUG" | "INFO" | "WARNING" | "ERROR";
  message: string;
  [key: string]: unknown;
}

export interface Logger {
  write(entry: LogEntry): void;
}

export class JsonLogger implements Logger {
  constructor(private readonly sink: (line: string) => void = (line) => console.log(line)) {}

  write(entry: LogEntry): void {
    const safe = redact({
      ...entry,
      time: new Date().toISOString(),
    }) as LogEntry;
    this.sink(JSON.stringify(safe));
  }
}

export class MemoryLogger implements Logger {
  readonly entries: LogEntry[] = [];

  write(entry: LogEntry): void {
    this.entries.push(redact(entry) as LogEntry);
  }

  serialized(): string {
    return JSON.stringify(this.entries);
  }
}
