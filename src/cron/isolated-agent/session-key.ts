import { toAgentStoreSessionKey } from "../../routing/session-key.js";

/**
 * Session key prefixes that identify a messaging-channel session (e.g. Discord, Slack).
 * When a hook targets such a key, we reuse the existing session so the run sees full
 * channel history (shared context with messages posted via the channel).
 */
const CHANNEL_SESSION_KEY_PREFIXES = [
  "discord:channel:",
  "agent:main:discord:channel:",
  "slack:channel:",
  "agent:main:slack:channel:",
];

/**
 * Returns true when the session key is for a messaging channel (Discord, Slack, etc.).
 * Hook runs that target such keys should reuse the existing session (forceNew: false)
 * so the agent sees the full transcript including messages from the channel.
 */
export function isChannelSessionKey(sessionKey: string): boolean {
  const key = sessionKey.trim();
  return CHANNEL_SESSION_KEY_PREFIXES.some((prefix) => key.startsWith(prefix));
}

export function resolveCronAgentSessionKey(params: {
  sessionKey: string;
  agentId: string;
  mainKey?: string | undefined;
}): string {
  return toAgentStoreSessionKey({
    agentId: params.agentId,
    requestKey: params.sessionKey.trim(),
    mainKey: params.mainKey,
  });
}
