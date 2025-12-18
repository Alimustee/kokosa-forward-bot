/**
 * kokosa-forward - Telegram Message Forwarding Bot
 * Copyright (c) 2025, 秦心桜
 * Licensed under BSD 2-Clause License
 *
 * @fileoverview Cloudflare KV storage functions.
 * Manages relay records, user blocks, statistics, rate limiting,
 * trust scores, content caching, and language preferences.
 */

import {
  RATE_LIMIT_MAX_REQUESTS,
  RATE_LIMIT_WINDOW_MS,
  TRUST_THRESHOLD,
} from "./config.js";

// ============================================
// Relay Management
// ============================================

function generateRelayId() {
  return `R-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
}

/**
 * Create a new relay for guest message.
 * @param {KVNamespace} kv - Cloudflare KV namespace
 * @param {string} guestId - Guest chat ID
 * @param {Object} message - Original message object
 * @returns {Promise<Object>} Created relay object
 */
export async function createRelay(kv, guestId, message) {
  const relay = {
    id: generateRelayId(),
    guestId: guestId.toString(),
    guestUsername:
      message.from?.username || message.from?.first_name || "Unknown",
    status: "open", // open | replied | blocked
    createdAt: Date.now(),
    messageType: message.text ? "text" : message.photo ? "photo" : "other",
    preview: (message.text || message.caption || "").substring(0, 100),
  };

  await kv.put(`relay:${relay.id}`, JSON.stringify(relay));
  await kv.put(`guest:latest:${guestId}`, relay.id);
  await incrementCounter(kv, "total-relays");

  return relay;
}

/**
 * Get relay by ID.
 * @param {KVNamespace} kv - Cloudflare KV namespace
 * @param {string} relayId - Relay ID
 * @returns {Promise<Object|null>} Relay object or null
 */
export async function getRelay(kv, relayId) {
  const data = await kv.get(`relay:${relayId}`, { type: "text" });
  return data ? JSON.parse(data) : null;
}

/**
 * Update relay status.
 * @param {KVNamespace} kv - Cloudflare KV namespace
 * @param {string} relayId - Relay ID
 * @param {string} status - New status
 */
export async function updateRelayStatus(kv, relayId, status) {
  const relay = await getRelay(kv, relayId);
  if (relay) {
    relay.status = status;
    relay.updatedAt = Date.now();
    await kv.put(`relay:${relayId}`, JSON.stringify(relay));
  }
}

/**
 * Store admin message ID for relay (for reply tracking).
 * @param {KVNamespace} kv - Cloudflare KV namespace
 * @param {number} adminMsgId - Admin's message ID
 * @param {string} relayId - Relay ID
 */
export async function linkAdminMessage(kv, adminMsgId, relayId) {
  await kv.put(`admin-msg:${adminMsgId}`, relayId);
}

/**
 * Get relay ID from admin message ID.
 * @param {KVNamespace} kv - Cloudflare KV namespace
 * @param {number} adminMsgId - Admin's message ID
 * @returns {Promise<string|null>} Relay ID or null
 */
export async function getRelayByAdminMsg(kv, adminMsgId) {
  return await kv.get(`admin-msg:${adminMsgId}`, { type: "text" });
}

/**
 * Check if user is blocked.
 * @param {KVNamespace} kv - Cloudflare KV namespace
 * @param {string} guestId - Guest chat ID
 * @returns {Promise<boolean>} True if blocked
 */
export async function isGuestBlocked(kv, guestId) {
  const status = await kv.get(`blocked:${guestId}`, { type: "text" });
  return status === "true";
}

// ============================================
// Block Status Management
// ============================================

/**
 * Set guest block status.
 * @param {KVNamespace} kv - Cloudflare KV namespace
 * @param {string} guestId - Guest chat ID
 * @param {boolean} blocked - Block status
 * @param {string} reason - Block reason
 */
export async function setGuestBlocked(kv, guestId, blocked, reason = "Manual") {
  if (blocked) {
    const blockData = { guestId, reason, blockedAt: Date.now() };
    await kv.put(`blocked:${guestId}`, "true");
    await kv.put(`block-info:${guestId}`, JSON.stringify(blockData));
    await incrementCounter(kv, "total-blocked");
    await kv.delete(`trust:${guestId}`); // Reset trust score on ban
  } else {
    await kv.delete(`blocked:${guestId}`);
    await kv.delete(`block-info:${guestId}`);
    await decrementCounter(kv, "total-blocked");
  }
}

/**
 * Get block info for a guest.
 * @param {KVNamespace} kv - Cloudflare KV namespace
 * @param {string} guestId - Guest chat ID
 * @returns {Promise<Object|null>} Block info or null
 */
export async function getBlockInfo(kv, guestId) {
  const data = await kv.get(`block-info:${guestId}`, { type: "text" });
  return data ? JSON.parse(data) : null;
}

/**
 * Get all blocked guests.
 * @param {KVNamespace} kv - Cloudflare KV namespace
 * @returns {Promise<Array>} Array of blocked guest info
 */
export async function getBlockedList(kv) {
  const list = await kv.list({ prefix: "block-info:" });
  const blocked = [];

  for (const key of list.keys) {
    const info = await kv.get(key.name, { type: "text" });
    if (info) {
      blocked.push(JSON.parse(info));
    }
  }

  return blocked;
}

// ============================================
// Statistics & Counters
// ============================================

/**
 * Increment a counter.
 * @param {KVNamespace} kv - Cloudflare KV namespace
 * @param {string} name - Counter name
 */
export async function incrementCounter(kv, name) {
  const current = parseInt((await kv.get(`counter:${name}`)) || "0");
  await kv.put(`counter:${name}`, (current + 1).toString());
}

/**
 * Decrement a counter.
 * @param {KVNamespace} kv - Cloudflare KV namespace
 * @param {string} name - Counter name
 */
export async function decrementCounter(kv, name) {
  const current = parseInt((await kv.get(`counter:${name}`)) || "0");
  if (current > 0) {
    await kv.put(`counter:${name}`, (current - 1).toString());
  }
}

/**
 * Get counter value.
 * @param {KVNamespace} kv - Cloudflare KV namespace
 * @param {string} name - Counter name
 * @returns {Promise<number>} Counter value
 */
export async function getCounter(kv, name) {
  return parseInt((await kv.get(`counter:${name}`)) || "0");
}

/**
 * Get all statistics.
 * @param {KVNamespace} kv - Cloudflare KV namespace
 * @returns {Promise<Object>} Statistics object
 */
export async function getStatistics(kv) {
  const totalRelays = await getCounter(kv, "total-relays");
  const aiBlocks = await getCounter(kv, "ai-blocks");
  const blockedList = await getBlockedList(kv);
  const totalBlocked = blockedList.length; // More accurate than counter

  return { totalRelays, totalBlocked, aiBlocks };
}

// ============================================
// Rate Limiting System
// ============================================

/**
 * Check if user is rate limited.
 * @param {KVNamespace} kv - Cloudflare KV namespace
 * @param {string} guestId - Guest chat ID
 * @returns {Promise<{allowed: boolean, remaining: number, resetIn?: number}>}
 */
export async function checkRateLimit(kv, guestId) {
  const key = `ratelimit:${guestId}`;
  const now = Date.now();
  const data = await kv.get(key, { type: "json" });

  if (!data || now - data.windowStart > RATE_LIMIT_WINDOW_MS) {
    // New window
    await kv.put(key, JSON.stringify({ windowStart: now, count: 1 }), {
      expirationTtl: 120,
    });
    return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - 1 };
  }

  if (data.count >= RATE_LIMIT_MAX_REQUESTS) {
    // Rate limited
    const resetIn = Math.ceil(
      (data.windowStart + RATE_LIMIT_WINDOW_MS - now) / 1000,
    );
    return { allowed: false, remaining: 0, resetIn };
  }

  // Increment counter
  await kv.put(
    key,
    JSON.stringify({ windowStart: data.windowStart, count: data.count + 1 }),
    { expirationTtl: 120 },
  );

  return {
    allowed: true,
    remaining: RATE_LIMIT_MAX_REQUESTS - data.count - 1,
  };
}

/**
 * Get rate limit configuration.
 * @returns {Object} Rate limit config
 */
export function getRateLimitConfig() {
  return {
    maxRequests: RATE_LIMIT_MAX_REQUESTS,
    windowMs: RATE_LIMIT_WINDOW_MS,
  };
}

// ============================================
// Trust Whitelist System
// ============================================

/**
 * Get user trust score.
 * @param {KVNamespace} kv - Cloudflare KV namespace
 * @param {string} guestId - Guest chat ID
 * @returns {Promise<number>} Trust score
 */
export async function getTrustScore(kv, guestId) {
  return parseInt((await kv.get(`trust:${guestId}`)) || "0");
}

/**
 * Increment user trust score (call after passing moderation).
 * @param {KVNamespace} kv - Cloudflare KV namespace
 * @param {string} guestId - Guest chat ID
 */
export async function incrementTrustScore(kv, guestId) {
  const current = await getTrustScore(kv, guestId);
  if (current < TRUST_THRESHOLD) {
    await kv.put(`trust:${guestId}`, (current + 1).toString());
  }
}

/**
 * Reset user trust score (call on ban).
 * @param {KVNamespace} kv - Cloudflare KV namespace
 * @param {string} guestId - Guest chat ID
 */
export async function resetTrustScore(kv, guestId) {
  await kv.delete(`trust:${guestId}`);
}

/**
 * Check if user is trusted (passed enough moderation checks).
 * @param {KVNamespace} kv - Cloudflare KV namespace
 * @param {string} guestId - Guest chat ID
 * @returns {Promise<boolean>} True if trusted
 */
export async function isUserTrusted(kv, guestId) {
  const score = await getTrustScore(kv, guestId);
  return score >= TRUST_THRESHOLD;
}

/**
 * Manually set user as trusted (admin whitelist).
 * @param {KVNamespace} kv - Cloudflare KV namespace
 * @param {string} guestId - Guest chat ID
 */
export async function setUserTrusted(kv, guestId) {
  await kv.put(`trust:${guestId}`, TRUST_THRESHOLD.toString());
}

// ============================================
// Content Cache System
// ============================================

/**
 * Generate content hash for caching.
 * @param {string} content - Content to hash
 * @returns {Promise<string>} Hash string
 */
async function generateContentHash(content) {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Get cached moderation result for content.
 * @param {KVNamespace} kv - Cloudflare KV namespace
 * @param {string} content - Content to check
 * @returns {Promise<{hit: boolean, result: string|null}>}
 */
export async function getCachedModerationResult(kv, content) {
  if (!content || content.length < 5) {
    return { hit: false, result: null };
  }

  const hash = await generateContentHash(content);
  const cached = await kv.get(`modcache:${hash}`, { type: "text" });

  if (cached === null) {
    return { hit: false, result: null };
  }

  // cached format: "SAFE" or "UNSAFE:reason"
  if (cached === "SAFE") {
    return { hit: true, result: null };
  }
  return { hit: true, result: cached.replace("UNSAFE:", "") };
}

/**
 * Cache moderation result for content.
 * @param {KVNamespace} kv - Cloudflare KV namespace
 * @param {string} content - Content that was checked
 * @param {string|null} result - Moderation result (null = safe)
 */
export async function cacheModerationResult(kv, content, result) {
  if (!content || content.length < 5) {
    return;
  }

  const hash = await generateContentHash(content);
  const value = result ? `UNSAFE:${result}` : "SAFE";
  await kv.put(`modcache:${hash}`, value, { expirationTtl: 86400 }); // 24 hours
}

// ============================================
// User Language Preferences
// ============================================

/**
 * Get user's language preference.
 * @param {KVNamespace} kv - Cloudflare KV namespace
 * @param {string} userId - User ID
 * @returns {Promise<string|null>} Language code or null
 */
export async function getUserLanguage(kv, userId) {
  return await kv.get(`lang:${userId}`, { type: "text" });
}

/**
 * Set user's language preference.
 * @param {KVNamespace} kv - Cloudflare KV namespace
 * @param {string} userId - User ID
 * @param {string} lang - Language code
 */
export async function setUserLanguage(kv, userId, lang) {
  await kv.put(`lang:${userId}`, lang);
}
