/**
 * kokosa-forward - Telegram Message Forwarding Bot
 * Copyright (c) 2025, 秦心桜
 * Licensed under BSD 2-Clause License
 *
 * @fileoverview Admin message handler.
 * Handles all admin commands including blocking, statistics, and management.
 */

import { checkContentSafety, getApiUsageStats, parseApiKeys } from "../ai.js";
import {
  getRelay,
  getRelayByAdminMsg,
  updateRelayStatus,
  setGuestBlocked,
  isGuestBlocked,
  getBlockedList,
  getStatistics,
  setUserTrusted,
  getUserLanguage,
  setUserLanguage,
} from "../storage.js";
import {
  t,
  buildLanguageKeyboard,
  getUserLangOrDefault,
  isValidUserId,
} from "../i18n.js";

// ============================================
// Helper Functions
// ============================================

/**
 * Send a message to admin with consistent error handling.
 */
async function sendToAdmin(telegram, adminId, text, options = {}) {
  return telegram.sendMessage({ chat_id: adminId, text, ...options });
}

/**
 * Get relay for reply-based commands with validation.
 * @returns {{relay, relayId, error}} Relay info or error flag
 */
async function getReplyRelay(kv, replyMsgId, telegram, adminId, lang) {
  const relayId = await getRelayByAdminMsg(kv, replyMsgId);
  if (!relayId) {
    await sendToAdmin(telegram, adminId, t("cannot_find_user", {}, lang));
    return { relay: null, relayId: null, error: true };
  }

  const relay = await getRelay(kv, relayId);
  if (!relay) {
    await sendToAdmin(telegram, adminId, t("relay_not_found", {}, lang));
    return { relay: null, relayId, error: true };
  }

  return { relay, relayId, error: false };
}

// ============================================
// Command Handlers (Standalone Commands)
// ============================================

const cmdStart = async (ctx) => {
  return sendToAdmin(
    ctx.telegram,
    ctx.adminId,
    t("admin_online", {}, ctx.lang),
  );
};

const cmdLang = async (ctx) => {
  return sendToAdmin(
    ctx.telegram,
    ctx.adminId,
    t("lang_select_prompt", {}, ctx.lang),
    { reply_markup: buildLanguageKeyboard(ctx.userId) },
  );
};

const cmdList = async (ctx) => {
  const blocked = await getBlockedList(ctx.kv);

  if (blocked.length === 0) {
    return sendToAdmin(
      ctx.telegram,
      ctx.adminId,
      t("no_blocked_users", {}, ctx.lang),
    );
  }

  let output = t("blocked_users_title", { count: blocked.length }, ctx.lang);
  const buttons = [];

  for (const [i, b] of blocked.entries()) {
    const date = new Date(b.blockedAt).toLocaleString();
    output += t(
      "blocked_user_item",
      { index: i + 1, guestId: b.guestId, reason: b.reason, date },
      ctx.lang,
    );
    buttons.push([
      {
        text: t("unban_button", { guestId: b.guestId }, ctx.lang),
        callback_data: `unban:${b.guestId}`,
      },
    ]);
  }

  return sendToAdmin(ctx.telegram, ctx.adminId, output, {
    reply_markup: { inline_keyboard: buttons },
  });
};

const cmdStats = async (ctx) => {
  const stats = await getStatistics(ctx.kv);
  const apiStats = getApiUsageStats();

  let output = t("stats_title", {}, ctx.lang);
  output += t(
    "stats_content",
    {
      totalRelays: stats.totalRelays,
      totalBlocked: stats.totalBlocked,
      aiBlocks: stats.aiBlocks,
    },
    ctx.lang,
  );

  const apiKeys = Object.keys(apiStats);
  if (apiKeys.length > 0) {
    output += t("api_usage_title", {}, ctx.lang);
    for (const [idx, key] of apiKeys.entries()) {
      const masked = key.substring(0, 10) + "...";
      output += t(
        "api_usage_item",
        { index: idx + 1, calls: apiStats[key], masked },
        ctx.lang,
      );
    }
  }

  return sendToAdmin(ctx.telegram, ctx.adminId, output);
};

/** Command map for exact match commands */
const COMMANDS = {
  "/start": cmdStart,
  "/lang": cmdLang,
  "/list": cmdList,
  "/stats": cmdStats,
};

// ============================================
// Parameterized Command Handlers
// ============================================

async function handleUnbanCommand(ctx, text) {
  const guestId = text.split(" ")[1];
  if (!guestId) {
    return sendToAdmin(
      ctx.telegram,
      ctx.adminId,
      t("unban_usage", {}, ctx.lang),
    );
  }
  if (!isValidUserId(guestId)) {
    return sendToAdmin(
      ctx.telegram,
      ctx.adminId,
      t("invalid_user_id", {}, ctx.lang),
    );
  }
  await setGuestBlocked(ctx.kv, guestId, false);
  return sendToAdmin(
    ctx.telegram,
    ctx.adminId,
    t("unbanned", { guestId }, ctx.lang),
  );
}

async function handleTrustIdCommand(ctx, text) {
  const guestId = text.split(" ")[1];
  if (!guestId) {
    return sendToAdmin(
      ctx.telegram,
      ctx.adminId,
      t("trustid_usage", {}, ctx.lang),
    );
  }
  if (!isValidUserId(guestId)) {
    return sendToAdmin(
      ctx.telegram,
      ctx.adminId,
      t("invalid_user_id", {}, ctx.lang),
    );
  }
  await setUserTrusted(ctx.kv, guestId);
  return sendToAdmin(
    ctx.telegram,
    ctx.adminId,
    t("trustid_success", { guestId }, ctx.lang),
  );
}

async function handleCheckTextCommand(ctx, text, env) {
  const content = text.substring(11).trim();
  if (!content) {
    return sendToAdmin(
      ctx.telegram,
      ctx.adminId,
      t("checktext_usage", {}, ctx.lang),
    );
  }
  const apiKeys = parseApiKeys(env.ENV_GEMINI_API_KEY);
  const result = await checkContentSafety(content, apiKeys);
  const status = result ? `UNSAFE: ${result}` : "SAFE";
  return sendToAdmin(
    ctx.telegram,
    ctx.adminId,
    t("content_check", { status }, ctx.lang),
  );
}

// ============================================
// Reply-based Command Handlers
// ============================================

const replyBlock = async (ctx, relay, relayId) => {
  await setGuestBlocked(ctx.kv, relay.guestId, true, "Manual block by admin");
  await updateRelayStatus(ctx.kv, relayId, "blocked");
  return sendToAdmin(
    ctx.telegram,
    ctx.adminId,
    t(
      "blocked",
      { guestId: relay.guestId, username: relay.guestUsername },
      ctx.lang,
    ),
  );
};

const replyTrust = async (ctx, relay) => {
  await setUserTrusted(ctx.kv, relay.guestId);
  return sendToAdmin(
    ctx.telegram,
    ctx.adminId,
    t(
      "trusted",
      { guestId: relay.guestId, username: relay.guestUsername },
      ctx.lang,
    ),
  );
};

const replyUnblock = async (ctx, relay) => {
  await setGuestBlocked(ctx.kv, relay.guestId, false);
  return sendToAdmin(
    ctx.telegram,
    ctx.adminId,
    t("unblocked", { guestId: relay.guestId }, ctx.lang),
  );
};

const replyStatus = async (ctx, relay) => {
  const blocked = await isGuestBlocked(ctx.kv, relay.guestId);
  return sendToAdmin(
    ctx.telegram,
    ctx.adminId,
    t(
      "user_status",
      {
        guestId: relay.guestId,
        username: relay.guestUsername,
        blocked: blocked ? "Yes" : "No",
        status: relay.status,
      },
      ctx.lang,
    ),
  );
};

const replyCheck = async (ctx, relay, relayId, env) => {
  if (!relay.preview) {
    return sendToAdmin(
      ctx.telegram,
      ctx.adminId,
      t("no_text_to_check", {}, ctx.lang),
    );
  }
  const apiKeys = parseApiKeys(env.ENV_GEMINI_API_KEY);
  const result = await checkContentSafety(relay.preview, apiKeys);
  const status = result ? `UNSAFE: ${result}` : "SAFE";
  return sendToAdmin(
    ctx.telegram,
    ctx.adminId,
    t("content_check", { status }, ctx.lang),
  );
};

/** Reply command map */
const REPLY_COMMANDS = {
  "/block": { handler: replyBlock, needsRelayId: true },
  "/trust": { handler: replyTrust, needsRelayId: false },
  "/unblock": { handler: replyUnblock, needsRelayId: false },
  "/status": { handler: replyStatus, needsRelayId: false },
  "/check": { handler: replyCheck, needsRelayId: false, needsEnv: true },
};

// ============================================
// Callback Query Handlers
// ============================================

/**
 * Handle callback query from inline buttons.
 */
export async function handleCallbackQuery(query, telegram, kv, env) {
  try {
    const { ENV_ADMIN_UID } = env;
    const [action, ...params] = query.data.split(":");
    const callerId = query.from.id.toString();

    await telegram.answerCallbackQuery({ callback_query_id: query.id });

    // Language selection
    if (action === "lang") {
      const [lang, userId] = params;
      if (callerId !== userId) return;
      await setUserLanguage(kv, userId, lang);
      return telegram.sendMessage({
        chat_id: userId,
        text: t("lang_changed", {}, lang),
      });
    }

    const lang = await getUserLangOrDefault(kv, callerId);

    // Appeal actions
    if (action === "appeal") {
      const [decision, guestId] = params;
      const guestLang = await getUserLangOrDefault(kv, guestId);

      if (decision === "accept") {
        await setGuestBlocked(kv, guestId, false);
        await sendToAdmin(
          telegram,
          ENV_ADMIN_UID,
          t("appeal_accepted", { guestId }, lang),
        );
        return telegram.sendMessage({
          chat_id: guestId,
          text: t("guest_appeal_accepted", {}, guestLang),
        });
      }

      if (decision === "reject") {
        await sendToAdmin(
          telegram,
          ENV_ADMIN_UID,
          t("appeal_rejected", { guestId }, lang),
        );
        return telegram.sendMessage({
          chat_id: guestId,
          text: t("guest_appeal_rejected", {}, guestLang),
        });
      }
    }

    // Unban action
    if (action === "unban") {
      const [guestId] = params;
      await setGuestBlocked(kv, guestId, false);
      return sendToAdmin(
        telegram,
        ENV_ADMIN_UID,
        t("unbanned", { guestId }, lang),
      );
    }
  } catch (error) {
    console.error(`[Admin] Callback error: ${error.message}`, error.stack);
  }
}

// ============================================
// Main Admin Message Handler
// ============================================

/**
 * Handle admin text messages.
 * Uses command maps to dispatch to appropriate handlers.
 */
export async function handleAdminMessage(message, telegram, kv, env) {
  try {
    const { ENV_ADMIN_UID } = env;
    const text = message.text || "";
    const userId = message.from.id.toString();
    const lang = await getUserLangOrDefault(kv, userId);

    const ctx = { telegram, kv, adminId: ENV_ADMIN_UID, userId, lang };

    // Check exact match commands
    if (COMMANDS[text]) {
      return await COMMANDS[text](ctx);
    }

    // Check parameterized commands
    if (text.startsWith("/unban ")) {
      return await handleUnbanCommand(ctx, text);
    }
    if (text.startsWith("/trustid ")) {
      return await handleTrustIdCommand(ctx, text);
    }
    if (text.startsWith("/checktext ")) {
      return await handleCheckTextCommand(ctx, text, env);
    }

    // Handle reply-based commands
    if (message.reply_to_message) {
      const replyMsgId = message.reply_to_message.message_id;

      const replyCmd = REPLY_COMMANDS[text];
      if (replyCmd) {
        const { relay, relayId, error } = await getReplyRelay(
          kv,
          replyMsgId,
          telegram,
          ENV_ADMIN_UID,
          lang,
        );
        if (error) return;

        if (replyCmd.needsEnv) {
          return await replyCmd.handler(ctx, relay, relayId, env);
        }
        if (replyCmd.needsRelayId) {
          return await replyCmd.handler(ctx, relay, relayId);
        }
        return await replyCmd.handler(ctx, relay);
      }

      // Default: Forward admin's reply to guest
      const relayId = await getRelayByAdminMsg(kv, replyMsgId);
      if (!relayId) {
        return sendToAdmin(
          telegram,
          ENV_ADMIN_UID,
          t("cannot_find_sender", {}, lang),
        );
      }

      const relay = await getRelay(kv, relayId);
      if (!relay) {
        return sendToAdmin(
          telegram,
          ENV_ADMIN_UID,
          t("relay_data_not_found", {}, lang),
        );
      }

      const blocked = await isGuestBlocked(kv, relay.guestId);
      if (blocked) {
        return sendToAdmin(
          telegram,
          ENV_ADMIN_UID,
          t("user_blocked_cannot_reply", {}, lang),
        );
      }

      await telegram.copyMessage({
        chat_id: relay.guestId,
        from_chat_id: ENV_ADMIN_UID,
        message_id: message.message_id,
      });

      await updateRelayStatus(kv, relayId, "replied");
    }
  } catch (error) {
    console.error(
      `[Admin] Handler error for ${message.from?.id}: ${error.message}`,
      error.stack,
    );
  }
}
