export interface JobStatus {
  jobId: string;
  state: "queued" | "cloning" | "analyzing" | "generating" | "validating" | "ready" | "failed";
  message: string;
  createdAt: string;
  updatedAt: string;
  artifactRoot: string;
  error?: {
    phase: string;
    message: string;
  };
}

export async function fetchJobStatus(jobId: string): Promise<JobStatus> {
  const response = await fetch(`/api/jobs/${encodeURIComponent(jobId)}/status`);
  if (!response.ok) {
    throw new Error(`Status request failed (${response.status})`);
  }

  const payload = (await response.json()) as { status: JobStatus };
  return payload.status;
}

export async function fetchSlidesMarkdown(jobId: string): Promise<string> {
  const response = await fetch(`/api/jobs/${encodeURIComponent(jobId)}/slides.md`);
  if (!response.ok) {
    throw new Error(`Slides request failed (${response.status})`);
  }

  return response.text();
}

export async function fetchRepoFile(jobId: string, repoRelativePath: string): Promise<string> {
  const query = new URLSearchParams({
    path: repoRelativePath
  });

  const response = await fetch(`/api/jobs/${encodeURIComponent(jobId)}/file?${query.toString()}`);
  if (!response.ok) {
    throw new Error(`File request failed (${response.status})`);
  }

  return response.text();
}
