import { describe, expect, it } from "bun:test";

import { InMemoryJobStore } from "@tour/server";

describe("job state machine", () => {
  it("supports legal transitions", () => {
    const store = new InMemoryJobStore();
    store.create("job-1", "/tmp/job-1");

    store.transition("job-1", "cloning", "clone");
    store.transition("job-1", "analyzing", "analyze");
    store.transition("job-1", "generating", "generate");
    store.transition("job-1", "validating", "validate");
    const status = store.transition("job-1", "ready", "ready");

    expect(status.state).toBe("ready");
  });

  it("rejects illegal transitions", () => {
    const store = new InMemoryJobStore();
    store.create("job-2", "/tmp/job-2");

    expect(() => store.transition("job-2", "ready", "skip" as never)).toThrow();
  });

  it("stores failure phase and message", () => {
    const store = new InMemoryJobStore();
    store.create("job-3", "/tmp/job-3");
    store.transition("job-3", "cloning", "clone");

    const status = store.fail("job-3", "cloning", "network timeout");

    expect(status.state).toBe("failed");
    expect(status.error?.phase).toBe("cloning");
    expect(status.error?.message).toContain("network timeout");
  });
});
