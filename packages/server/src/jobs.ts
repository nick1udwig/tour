import {
  ALLOWED_TRANSITIONS,
  type JobLogEntry,
  type JobState,
  type JobStatus
} from "@tour/shared";

interface JobRecord {
  status: JobStatus;
  logs: JobLogEntry[];
}

export class InMemoryJobStore {
  private readonly jobs = new Map<string, JobRecord>();

  create(jobId: string, artifactRoot: string): JobStatus {
    const now = new Date().toISOString();
    const status: JobStatus = {
      jobId,
      artifactRoot,
      state: "queued",
      message: "Job queued",
      createdAt: now,
      updatedAt: now
    };

    this.jobs.set(jobId, {
      status,
      logs: [
        {
          timestamp: now,
          phase: "queued",
          message: status.message
        }
      ]
    });

    return status;
  }

  transition(jobId: string, to: Exclude<JobState, "failed">, message: string): JobStatus {
    const record = this.mustGet(jobId);
    const from = record.status.state;
    const allowed = ALLOWED_TRANSITIONS[from] ?? [];

    if (!allowed.includes(to)) {
      throw new Error(`Illegal transition ${from} -> ${to}`);
    }

    const updated = this.writeStatus(record, to, message);
    return updated;
  }

  fail(jobId: string, phase: JobState, message: string): JobStatus {
    const record = this.mustGet(jobId);
    const status = this.writeStatus(record, "failed", message);
    status.error = {
      phase,
      message
    };
    record.status = status;
    return status;
  }

  getStatus(jobId: string): JobStatus | null {
    return this.jobs.get(jobId)?.status ?? null;
  }

  getLogs(jobId: string): JobLogEntry[] {
    return this.mustGet(jobId).logs;
  }

  private mustGet(jobId: string): JobRecord {
    const record = this.jobs.get(jobId);
    if (!record) {
      throw new Error(`Unknown job: ${jobId}`);
    }

    return record;
  }

  private writeStatus(record: JobRecord, nextState: JobState, message: string): JobStatus {
    const updatedAt = new Date().toISOString();
    const status: JobStatus = {
      ...record.status,
      state: nextState,
      message,
      updatedAt
    };

    record.status = status;
    record.logs.push({
      timestamp: updatedAt,
      phase: nextState,
      message
    });

    return status;
  }
}
