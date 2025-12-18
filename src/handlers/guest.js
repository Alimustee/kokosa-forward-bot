/**
 * kokosa-forward - Telegram Message Forwarding Bot
 * Copyright (c) 2025, 秦心桜
 * Licensed under BSD 2-Clause License
 */

import { checkContentSafety, checkImageSafety, parseApiKeys } from "../ai.js";
import {
  createRelay,
  linkAdminMessage,
  isGuestBlocked,
  setGuestBlocked,
  incrementCounter,
  getBlockInfo,
  checkRateLimit,
  isUserTrusted,
  incrementTrustScore,
  getCachedModerationResult,
  cacheModerationResult,
  getUserLanguage,
} from "../storage.js";
import { ENABLE_FILTER, AUTO_BLOCK } from "../config.js";
import { t, buildLanguageKeyboard, getDefaultLanguage } from "../i18n.js";

// ============================================
// Helper Functions
// ============================================

/**
 * Get user's language with fallback to default
 * @param {KVNamespace} kv - KV storage
 * @param {string} userId - User ID
 * @returns {Promise<string>} Language code
 */
async function getLang(kv, userId) {
  return (await getUserLanguage(kv, userId)) || getDefaultLanguage();
}

/**
 * Send message to guest with consistent error handling
 * @param {Object} telegram - Telegram client
 * @param {string} chatId - Chat ID
 * @param {string} text - Message text
 * @param {Object} options - Additional options
 * @returns {Promise<Object>} Telegram response
 */
async function sendToGuest(telegram, chatId, text, options = {}) {
  return telegram.sendMessage({ chat_id: chatId, text, ...options });
}

/**
 * Get file URL from Telegram (unified handler for images/stickers)
 * @param {Object} telegram - Telegram client
 * @param {string} fileId - File ID
 * @param {string} logPrefix - Log prefix for errors
 * @returns {Promise<string|null>} File URL or null
 */
async function getFileUrl(telegram, fileId, logPrefix = "File") {
  const fileResult = await telegram.getFile({ file_id: fileId });
  if (!fileResult.ok) {
    console.log(`[Guest] Failed to get ${logPrefix}:`, fileResult);
    return null;
  }
  return telegram.getFileUrl(fileResult.result.file_path);
}

/**
 * Get image URL from message
 * @param {Object} message - Telegram message
 * @param {Object} telegram - Telegram client
 * @returns {Promise<string|null>} Image URL or null
 */
async function getImageUrl(message, telegram) {
  if (!message.photo?.length) return null;
  const photo = message.photo[message.photo.length - 1];
  return getFileUrl(telegram, photo.file_id, "photo");
}

/**
 * Get sticker URL from message (static stickers only)
 * @param {Object} message - Telegram message
 * @param {Object} telegram - Telegram client
 * @returns {Promise<string|null>} Sticker URL or null
 */
async function getStickerUrl(message, telegram) {
  const sticker = message.sticker;
  if (!sticker) return null;

  // Skip animated/video stickers
  if (sticker.is_animated || sticker.is_video) {
    console.log("[Guest] Skipping animated/video sticker");
    return null;
  }

  return getFileUrl(telegram, sticker.file_id, "sticker");
}

/**
 * Build appeal action keyboard
 * @param {string} guestId - Guest ID
 * @param {string} lang - Language code
 * @returns {Object} Inline keyboard markup
 */
function buildAppealKeyboard(guestId, lang) {
  return {
    inline_keyboard: [
      [
        {
          text: t("appeal_accept_button", {}, lang),
          callback_data: `appeal:accept:${guestId}`,
        },
        {
          text: t("appeal_reject_button", {}, lang),
          callback_data: `appeal:reject:${guestId}`,
        },
      ],
    ],
  };
}

// ============================================
// Command Handlers
// ============================================

/**
 * Handle /lang command
 */
async function handleLangCommand(telegram, guestId, lang) {
  return sendToGuest(telegram, guestId, t("lang_select_prompt", {}, lang), {
    reply_markup: buildLanguageKeyboard(guestId),
  });
}

/**
 * Handle /start command
 */
async function handleStartCommand(telegram, guestId, lang) {
  return sendToGuest(telegram, guestId, t("guest_welcome", {}, lang));
}

/**
 * Handle /appeal command
 */
async function handleAppealCommand(message, telegram, kv, env) {
  const { ENV_ADMIN_UID } = env;
  const guestId = message.chat.id.toString();
  const username =
    message.from?.username || message.from?.first_name || "Unknown";
  const guestLang = await getLang(kv, guestId);
  const adminLang = await getLang(kv, ENV_ADMIN_UID);

  // Get block info
  const blockInfo = await getBlockInfo(kv, guestId);
  const blockReason = blockInfo?.reason || "Unknown";
  const blockDate = blockInfo?.blockedAt
    ? new Date(blockInfo.blockedAt).toLocaleString()
    : "Unknown";

  // Build appeal message
  let appealText = t("appeal_title", {}, adminLang);
  appealText += t("appeal_from", { username, guestId }, adminLang);
  appealText += t("appeal_blocked", { date: blockDate }, adminLang);
  appealText += t("appeal_reason", { reason: blockReason }, adminLang);
  appealText += t("appeal_separator", {}, adminLang);

  const appealContent = message.text?.replace("/appeal", "").trim();
  appealText += appealContent
    ? t("appeal_message", { content: appealContent }, adminLang)
    : t("appeal_no_message", {}, adminLang);

  // Send to admin
  await telegram.sendMessage({
    chat_id: ENV_ADMIN_UID,
    text: appealText,
    reply_markup: buildAppealKeyboard(guestId, adminLang),
  });

  // Forward attached message if present
  if (message.reply_to_message) {
    await telegram.forwardMessage({
      chat_id: ENV_ADMIN_UID,
      from_chat_id: guestId,
      message_id: message.reply_to_message.message_id,
    });
  }

  return sendToGuest(
    telegram,
    guestId,
    t("guest_appeal_submitted", {}, guestLang),
  );
}

// ============================================
// Content Moderation
// ============================================

/**
 * Check message content against AI filters
 * @param {Object} message - Telegram message
 * @param {Object} telegram - Telegram client
 * @param {KVNamespace} kv - KV storage
 * @param {Array} apiKeys - Gemini API keys
 * @returns {Promise<string|null>} Filter result or null if safe
 */
async function checkMessageContent(message, telegram, kv, apiKeys) {
  // Check text content (with caching)
  const textContent = message.text || message.caption;
  if (textContent) {
    const cached = await getCachedModerationResult(kv, textContent);
    if (cached.hit) {
      console.log("[Guest] Cache hit for text content");
      return cached.result;
    }

    const result = await checkContentSafety(textContent, apiKeys);
    await cacheModerationResult(kv, textContent, result);
    if (result) return result;
  }

  // Check image content
  if (message.photo) {
    const imageUrl = await getImageUrl(message, telegram);
    if (imageUrl) {
      const result = await checkImageSafety(imageUrl, apiKeys, message.caption);
      if (result) return result;
    }
  }

  // Check sticker content
  if (message.sticker) {
    const stickerUrl = await getStickerUrl(message, telegram);
    if (stickerUrl) {
      const result = await checkImageSafety(stickerUrl, apiKeys);
      if (result) return result;
    }
  }

  return null;
}

/**
 * Handle unsafe content detection
 * @param {Object} telegram - Telegram client
 * @param {KVNamespace} kv - KV storage
 * @param {string} guestId - Guest ID
 * @param {string} filterResult - Filter result
 * @param {string} lang - Language code
 */
async function handleUnsafeContent(telegram, kv, guestId, filterResult, lang) {
  await incrementCounter(kv, "ai-blocks");

  if (AUTO_BLOCK) {
    await setGuestBlocked(kv, guestId, true, `AI Filter: ${filterResult}`);
  }

  return sendToGuest(
    telegram,
    guestId,
    t("guest_message_blocked", { reason: filterResult }, lang),
  );
}

// ============================================
// Main Handler
// ============================================

/**
 * Handle guest messages
 * Flow: Check blocks -> Commands -> Rate limit -> AI filter -> Forward
 *
 * @param {Object} message - Telegram message object
 * @param {Object} telegram - Telegram client
 * @param {KVNamespace} kv - KV storage
 * @param {Object} env - Environment variables
 */
export async function handleGuestMessage(message, telegram, kv, env) {
  try {
    const { ENV_ADMIN_UID, ENV_GEMINI_API_KEY } = env;
    const guestId = message.chat.id.toString();
    const lang = await getLang(kv, guestId);
    const text = message.text || "";

    // Check block status first
    const blocked = await isGuestBlocked(kv, guestId);

    // /lang is always allowed
    if (text === "/lang") {
      return handleLangCommand(telegram, guestId, lang);
    }

    // /appeal for blocked users
    if (text.startsWith("/appeal")) {
      if (!blocked) {
        return sendToGuest(telegram, guestId, t("guest_not_blocked", {}, lang));
      }
      return handleAppealCommand(message, telegram, kv, env);
    }

    // Blocked users cannot proceed further
    if (blocked) {
      return sendToGuest(telegram, guestId, t("guest_blocked", {}, lang));
    }

    // /start command
    if (text === "/start") {
      return handleStartCommand(telegram, guestId, lang);
    }

    // Rate limiting check
    const rateLimit = await checkRateLimit(kv, guestId);
    if (!rateLimit.allowed) {
      console.log(`[Guest] Rate limited: ${guestId}`);
      return sendToGuest(
        telegram,
        guestId,
        t("guest_rate_limited", { seconds: rateLimit.resetIn }, lang),
      );
    }

    // AI content filter (skip for trusted users)
    if (ENABLE_FILTER && ENV_GEMINI_API_KEY) {
      const trusted = await isUserTrusted(kv, guestId);

      if (trusted) {
        console.log(`[Guest] Trusted user, skipping AI check: ${guestId}`);
      } else {
        const apiKeys = parseApiKeys(ENV_GEMINI_API_KEY);
        const filterResult = await checkMessageContent(
          message,
          telegram,
          kv,
          apiKeys,
        );

        if (filterResult) {
          return handleUnsafeContent(telegram, kv, guestId, filterResult, lang);
        }

        // Passed moderation - increment trust score
        await incrementTrustScore(kv, guestId);
      }
    }

    // Create relay and forward message
    const relay = await createRelay(kv, guestId, message);
    const fwd = await telegram.forwardMessage({
      chat_id: ENV_ADMIN_UID,
      from_chat_id: message.chat.id,
      message_id: message.message_id,
    });

    if (fwd.ok) {
      await linkAdminMessage(kv, fwd.result.message_id, relay.id);
    }
  } catch (error) {
    console.error(
      `[Guest] Handler error for ${message.chat?.id}: ${error.message}`,
      error.stack,
    );

    // Try to send generic error message
    try {
      const lang = await getLang(kv, message.chat.id.toString());
      await sendToGuest(telegram, message.chat.id, t("guest_error", {}, lang));
    } catch {
      // Ignore secondary errors
    }
  }
}
