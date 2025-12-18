/**
 * kokosa-forward - Telegram Message Forwarding Bot
 * Copyright (c) 2025, 秦心桜
 * Licensed under BSD 2-Clause License
 *
 * @fileoverview Internationalization module with message translations.
 * Add new languages by creating a new object in the messages constant.
 */

import { LANGUAGE } from "./config.js";
import { getUserLanguage } from "./storage.js";

/**
 * Language definitions.
 * Each language object must contain all message keys.
 */
const messages = {
  en: {
    lang_name: "English",
    lang_flag: "🇺🇸",

    // Admin messages
    admin_online: "Admin Online. Use the Menu button for commands.",
    no_blocked_users: "No blocked users.",
    blocked_users_title: "Blocked Users ({count}):\n\n",
    blocked_user_item:
      "{index}. {guestId}\n   Reason: {reason}\n   Date: {date}\n\n",
    unban_button: "Unban {guestId}",
    stats_title: "Statistics:\n\n",
    stats_content:
      "Total Relays: {totalRelays}\nBlocked Users: {totalBlocked}\nAI Blocks: {aiBlocks}\n",
    api_usage_title: "\nAPI Usage:\n",
    api_usage_item: "  #{index}: {calls} calls ({masked})\n",
    unban_usage: "Usage: /unban <ID>",
    unbanned: "Unbanned: {guestId}",
    blocked: "Blocked: {guestId} ({username})",
    trusted:
      "Trusted: {guestId} ({username})\nThis user will skip AI moderation.",
    unblocked: "Unblocked: {guestId}",
    user_status:
      "User: {guestId} ({username})\nBlocked: {blocked}\nRelay: {status}",
    content_check: "Content Check: {status}",
    no_text_to_check: "No text content to check.",
    cannot_find_user: "Cannot find user info for this message.",
    relay_not_found: "Relay not found.",
    cannot_find_sender: "Cannot find original sender for this message.",
    relay_data_not_found: "Relay data not found.",
    user_blocked_cannot_reply: "This user is blocked. Unblock first to reply.",
    appeal_accepted: "Appeal accepted. Unbanned: {guestId}",
    appeal_rejected: "Appeal rejected for: {guestId}",
    trustid_usage: "Usage: /trustid <UID>",
    trustid_success: "Trusted: {guestId}\nThis user will skip AI moderation.",
    checktext_usage: "Usage: /checktext <content>",
    invalid_user_id: "Invalid user ID format. ID must be a number.",

    // Guest messages
    guest_welcome: "Hello. You can contact me via this bot.",
    guest_blocked:
      "You are blocked.\n\nUse /appeal to submit an appeal.\nTip: Reply to your blocked message with /appeal to attach evidence.",
    guest_not_blocked: "You are not blocked. No need to appeal.",
    guest_appeal_submitted:
      "Your appeal has been submitted. Please wait for admin review.",
    guest_appeal_accepted:
      "Your appeal has been accepted. You are now unbanned.",
    guest_appeal_rejected: "Your appeal has been rejected.",
    guest_rate_limited: "Too many messages. Please wait {seconds} seconds.",
    guest_message_blocked:
      "Message blocked.\nReason: {reason}\n\nUse /appeal to submit an appeal.\nTip: Reply to this message with /appeal to attach evidence.",
    guest_error: "An error occurred. Please try again later.",

    // Appeal format
    appeal_title: "[APPEAL]\n",
    appeal_from: "From: @{username} ({guestId})\n",
    appeal_blocked: "Blocked: {date}\n",
    appeal_reason: "Reason: {reason}\n",
    appeal_separator: "---\n",
    appeal_message: "Appeal message: {content}",
    appeal_no_message: "(No appeal message provided)",
    appeal_accept_button: "Accept (Unban)",
    appeal_reject_button: "Reject",

    // Language selection
    lang_select_prompt: "Select your language:",
    lang_changed: "Language changed to English.",
  },

  zh: {
    lang_name: "中文",
    lang_flag: "🇨🇳",

    // Admin messages
    admin_online: "管理员已上线，请使用菜单按钮查看命令。",
    no_blocked_users: "没有被封禁的用户。",
    blocked_users_title: "已封禁用户 ({count}):\n\n",
    blocked_user_item:
      "{index}. {guestId}\n   原因: {reason}\n   时间: {date}\n\n",
    unban_button: "解封 {guestId}",
    stats_title: "统计信息:\n\n",
    stats_content:
      "消息总数: {totalRelays}\n封禁用户: {totalBlocked}\nAI拦截: {aiBlocks}\n",
    api_usage_title: "\nAPI使用情况:\n",
    api_usage_item: "  #{index}: {calls} 次调用 ({masked})\n",
    unban_usage: "用法: /unban <用户ID>",
    unbanned: "已解封: {guestId}",
    blocked: "已封禁: {guestId} ({username})",
    trusted: "已信任: {guestId} ({username})\n该用户将跳过AI审核。",
    unblocked: "已解封: {guestId}",
    user_status:
      "用户: {guestId} ({username})\n封禁状态: {blocked}\n会话状态: {status}",
    content_check: "内容检查: {status}",
    no_text_to_check: "没有可检查的文本内容。",
    cannot_find_user: "无法找到此消息的用户信息。",
    relay_not_found: "会话记录未找到。",
    cannot_find_sender: "无法找到此消息的原始发送者。",
    relay_data_not_found: "会话数据未找到。",
    user_blocked_cannot_reply: "该用户已被封禁，请先解封再回复。",
    appeal_accepted: "申诉已通过，已解封: {guestId}",
    appeal_rejected: "申诉已拒绝: {guestId}",
    trustid_usage: "用法: /trustid <用户ID>",
    trustid_success: "已信任: {guestId}\n该用户将跳过AI审核。",
    checktext_usage: "用法: /checktext <内容>",
    invalid_user_id: "用户ID格式无效，ID必须为数字。",

    // Guest messages
    guest_welcome: "你好，你可以通过这个机器人联系我。",
    guest_blocked:
      "你已被封禁。\n\n使用 /appeal 提交申诉。\n提示: 回复被封禁的消息并发送 /appeal 可附加证据。",
    guest_not_blocked: "你没有被封禁，无需申诉。",
    guest_appeal_submitted: "你的申诉已提交，请等待管理员审核。",
    guest_appeal_accepted: "你的申诉已通过，封禁已解除。",
    guest_appeal_rejected: "你的申诉已被拒绝。",
    guest_rate_limited: "发送过于频繁，请等待 {seconds} 秒。",
    guest_message_blocked:
      "消息被拦截。\n原因: {reason}\n\n使用 /appeal 提交申诉。\n提示: 回复此消息并发送 /appeal 可附加证据。",
    guest_error: "发生错误，请稍后重试。",

    // Appeal format
    appeal_title: "[申诉]\n",
    appeal_from: "来自: @{username} ({guestId})\n",
    appeal_blocked: "封禁时间: {date}\n",
    appeal_reason: "封禁原因: {reason}\n",
    appeal_separator: "---\n",
    appeal_message: "申诉内容: {content}",
    appeal_no_message: "(未提供申诉内容)",
    appeal_accept_button: "通过 (解封)",
    appeal_reject_button: "拒绝",

    // Language selection
    lang_select_prompt: "请选择语言:",
    lang_changed: "语言已切换为中文。",
  },
};

const defaultLanguage = LANGUAGE || "en";

/**
 * Get available language codes.
 * @returns {string[]} Array of language codes (e.g., ["en", "zh"])
 */
export function getAvailableLanguages() {
  return Object.keys(messages);
}

/**
 * Get language display info.
 * @param {string} lang - Language code
 * @returns {{name: string, flag: string}} Language name and flag emoji
 */
export function getLanguageInfo(lang) {
  const m = messages[lang];
  if (!m) return { name: lang, flag: "🌐" };
  return { name: m.lang_name, flag: m.lang_flag };
}

/**
 * Build inline keyboard for language selection.
 * @param {string} userId - User ID for callback data
 * @returns {Object} Telegram inline_keyboard markup
 */
export function buildLanguageKeyboard(userId) {
  const langs = getAvailableLanguages();
  const buttons = langs.map((lang) => {
    const info = getLanguageInfo(lang);
    return {
      text: `${info.flag} ${info.name}`,
      callback_data: `lang:${lang}:${userId}`,
    };
  });

  return { inline_keyboard: [buttons] };
}

/**
 * Get a translated message with variable substitution.
 *
 * @param {string} key - Message key from language definitions
 * @param {Object} vars - Variables to substitute (e.g., {count: 5})
 * @param {string|null} lang - Language code, uses default if null
 * @returns {string} Translated message with variables substituted
 *
 * @example
 * t("blocked_users_title", { count: 3 }, "en")
 * // Returns: "Blocked Users (3):\n\n"
 */
export function t(key, vars = {}, lang = null) {
  const useLang = lang || defaultLanguage;
  const langMessages = messages[useLang] || messages.en;
  let message = langMessages[key] || messages.en[key] || key;

  for (const [varName, value] of Object.entries(vars)) {
    message = message.replace(new RegExp(`\\{${varName}\\}`, "g"), value);
  }

  return message;
}

/**
 * Get the default language code.
 * @returns {string} Default language code from config
 */
export function getDefaultLanguage() {
  return defaultLanguage;
}

/**
 * Get user's language preference with fallback to default.
 * Shared utility to eliminate duplicate getLang helpers.
 * @param {KVNamespace} kv - Cloudflare KV namespace
 * @param {string} userId - User ID
 * @returns {Promise<string>} Language code
 */
export async function getUserLangOrDefault(kv, userId) {
  return (await getUserLanguage(kv, userId)) || defaultLanguage;
}

/**
 * Validate if a string is a valid Telegram user ID.
 * @param {string} id - ID to validate
 * @returns {boolean} True if valid
 */
export function isValidUserId(id) {
  return id && /^\d+$/.test(id);
}
