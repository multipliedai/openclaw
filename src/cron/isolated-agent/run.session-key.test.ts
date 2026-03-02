import { describe, expect, it } from "vitest";
import { isChannelSessionKey, resolveCronAgentSessionKey } from "./session-key.js";

describe("isChannelSessionKey", () => {
  it("returns true for discord:channel: keys", () => {
    expect(isChannelSessionKey("discord:channel:123")).toBe(true);
    expect(isChannelSessionKey("  discord:channel:1470853689169416254  ")).toBe(true);
  });

  it("returns true for agent:main:discord:channel: keys", () => {
    expect(isChannelSessionKey("agent:main:discord:channel:123")).toBe(true);
  });

  it("returns true for slack:channel: keys", () => {
    expect(isChannelSessionKey("slack:channel:abc")).toBe(true);
  });

  it("returns false for hook: and cron: keys", () => {
    expect(isChannelSessionKey("hook:email:msg-123")).toBe(false);
    expect(isChannelSessionKey("cron:job-id")).toBe(false);
  });

  it("returns false for main session", () => {
    expect(isChannelSessionKey("main")).toBe(false);
    expect(isChannelSessionKey("agent:main:main")).toBe(false);
  });
});

describe("resolveCronAgentSessionKey", () => {
  it("builds an agent-scoped key for legacy aliases", () => {
    expect(resolveCronAgentSessionKey({ sessionKey: "main", agentId: "main" })).toBe(
      "agent:main:main",
    );
  });

  it("preserves canonical agent keys instead of prefixing twice", () => {
    expect(resolveCronAgentSessionKey({ sessionKey: "agent:main:main", agentId: "main" })).toBe(
      "agent:main:main",
    );
  });

  it("normalizes canonical keys to lowercase before reuse", () => {
    expect(
      resolveCronAgentSessionKey({ sessionKey: "AGENT:Main:Hook:Webhook:42", agentId: "x" }),
    ).toBe("agent:main:hook:webhook:42");
  });

  it("keeps hook keys scoped under the target agent", () => {
    expect(resolveCronAgentSessionKey({ sessionKey: "hook:webhook:42", agentId: "main" })).toBe(
      "agent:main:hook:webhook:42",
    );
  });
});
