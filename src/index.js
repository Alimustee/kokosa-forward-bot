/**
 * kokosa-forward - Telegram Message Forwarding Bot
 * Copyright (c) 2025, 秦心桜
 * Licensed under BSD 2-Clause License
 *
 * @fileoverview Main entry point for Cloudflare Worker.
 * Handles webhook requests and routes messages to appropriate handlers.
 */

import { WEBHOOK_PATH } from "./config.js";
import { createTelegramClient } from "./telegram.js";
import { handleAdminMessage, handleCallbackQuery } from "./handlers/admin.js";
import { handleGuestMessage } from "./handlers/guest.js";

// ============================================
// Bot Menu Commands
// ============================================

/**
 * Commands shown in admin's bot menu.
 * Includes all management and moderation commands.
 */
const ADMIN_COMMANDS = [
  { command: "start", description: "Start the bot" },
  { command: "list", description: "View blocked users" },
  { command: "stats", description: "View statistics" },
  { command: "block", description: "Block user (reply to message)" },
  { command: "unblock", description: "Unblock user (reply to message)" },
  { command: "trust", description: "Whitelist user (reply to message)" },
  { command: "trustid", description: "Whitelist user by ID" },
  { command: "status", description: "Check user status (reply to message)" },
  { command: "check", description: "AI content check (reply to message)" },
  { command: "checktext", description: "AI check any text" },
  { command: "lang", description: "Change language" },
];

/**
 * Commands shown in guest's bot menu.
 * Limited to basic user functions.
 */
const GUEST_COMMANDS = [
  { command: "start", description: "Start the bot" },
  { command: "appeal", description: "Appeal if blocked" },
  { command: "lang", description: "Change language" },
];

// ============================================
// Update Handlers
// ============================================

/**
 * Registry mapping update types to handler functions.
 * Used by processUpdate for dispatch.
 */
const updateHandlers = {
  message: handleMessageUpdate,
  callback_query: handleCallbackUpdate,
  edited_message: handleEditedMessage,
};

/**
 * Handle incoming message updates.
 * Routes to admin or guest handler based on sender.
 *
 * @param {Object} update - Telegram update object
 * @param {Object} telegram - Telegram client
 * @param {KVNamespace} kv - Cloudflare KV storage
 * @param {Object} env - Environment variables
 */
async function handleMessageUpdate(update, telegram, kv, env) {
  const message = update.message;
  const chatId = message.chat.id.toString();
  const { ENV_ADMIN_UID } = env;

  // Log message for debugging
  console.log(`[Message] From ${chatId}: ${message.text || "[Media]"}`);

  // Route to appropriate handler
  if (chatId === ENV_ADMIN_UID) {
    return await handleAdminMessage(message, telegram, kv, env);
  } else {
    return await handleGuestMessage(message, telegram, kv, env);
  }
}

/**
 * Handle callback query updates from inline button clicks.
 *
 * @param {Object} update - Telegram update object
 * @param {Object} telegram - Telegram client
 * @param {KVNamespace} kv - Cloudflare KV storage
 * @param {Object} env - Environment variables
 */
async function handleCallbackUpdate(update, telegram, kv, env) {
  const query = update.callback_query;
  console.log(`[Callback] Action: ${query.data}`);

  return await handleCallbackQuery(query, telegram, kv, env);
}

/**
 * Handle edited message updates.
 * Called when a user modifies a previously sent message.
 *
 * Current implementation: logging only.
 * Potential enhancements:
 * - Re-check edited content for policy violations
 * - Forward edited content to admin with [EDITED] tag
 * - Update relay record with new preview
 *
 * @param {Object} update - Telegram update object
 * @param {Object} telegram - Telegram client
 * @param {KVNamespace} kv - Cloudflare KV storage
 * @param {Object} env - Environment variables
 */
async function handleEditedMessage(update, telegram, kv, env) {
  const message = update.edited_message;
  console.log(`[Edit] Message ${message.message_id} was edited`);
  // TODO: Implement edited message handling if needed
}

/**
 * Process incoming Telegram update.
 * Dispatches to appropriate handler based on update type.
 *
 * @param {Object} update - Telegram update object
 * @param {Object} telegram - Telegram client
 * @param {KVNamespace} kv - Cloudflare KV storage
 * @param {Object} env - Environment variables
 */
async function processUpdate(update, telegram, kv, env) {
  // Find matching handler for this update type
  for (const [type, handler] of Object.entries(updateHandlers)) {
    if (type in update) {
      await handler(update, telegram, kv, env);
      return;
    }
  }
  // Unknown update type - silently ignore
}

// ============================================
// Webhook Handlers
// ============================================

/**
 * Handle incoming webhook POST requests from Telegram.
 * Validates secret token and processes update asynchronously.
 *
 * @param {Request} request - Incoming HTTP request
 * @param {Object} env - Environment variables
 * @param {ExecutionContext} ctx - Cloudflare execution context
 * @returns {Response} HTTP response
 */
async function handleWebhook(request, env, ctx) {
  const { ENV_BOT_SECRET, ENV_BOT_TOKEN } = env;

  // Validate webhook secret token
  if (
    request.headers.get("X-Telegram-Bot-Api-Secret-Token") !== ENV_BOT_SECRET
  ) {
    console.log("[Auth] Unauthorized webhook attempt");
    return new Response("Unauthorized", { status: 403 });
  }

  // Parse update and create client
  const update = await request.json();
  const telegram = createTelegramClient(ENV_BOT_TOKEN);

  // Process update in background (non-blocking)
  ctx.waitUntil(processUpdate(update, telegram, env.kfb, env));

  // Return immediately to Telegram
  return new Response("Ok");
}

/**
 * Register webhook URL with Telegram.
 * Called once to set up the bot.
 *
 * @param {Request} request - Incoming HTTP request
 * @param {Object} env - Environment variables
 * @returns {Response} JSON response with result
 */
async function registerWebhook(request, env) {
  // Build webhook URL from request URL
  const url = new URL(request.url);
  const webhookUrl = `${url.protocol}//${url.hostname}${WEBHOOK_PATH}`;

  // Call Telegram API to set webhook
  const telegram = createTelegramClient(env.ENV_BOT_TOKEN);
  const result = await telegram.setWebhook({
    url: webhookUrl,
    secret_token: env.ENV_BOT_SECRET,
    allowed_updates: ["message", "callback_query", "edited_message"],
  });

  return new Response(JSON.stringify(result), {
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * Unregister webhook from Telegram.
 * Useful for switching to polling or removing bot.
 *
 * @param {Object} env - Environment variables
 * @returns {Response} JSON response with result
 */
async function unregisterWebhook(env) {
  const telegram = createTelegramClient(env.ENV_BOT_TOKEN);
  const result = await telegram.setWebhook({ url: "" });

  return new Response(JSON.stringify(result), {
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * Register bot menu commands with Telegram.
 * Sets up different command menus for admin vs regular users.
 *
 * @param {Object} env - Environment variables
 * @returns {Response} JSON response with results
 */
async function registerCommands(env) {
  const telegram = createTelegramClient(env.ENV_BOT_TOKEN);
  const results = {};

  // Set admin-specific commands (visible only to admin)
  results.admin = await telegram.setMyCommands({
    commands: ADMIN_COMMANDS,
    scope: { type: "chat", chat_id: parseInt(env.ENV_ADMIN_UID) },
  });

  // Set default commands (visible to all other users)
  results.default = await telegram.setMyCommands({
    commands: GUEST_COMMANDS,
    scope: { type: "default" },
  });

  return new Response(JSON.stringify(results), {
    headers: { "Content-Type": "application/json" },
  });
}

// ============================================
// Cloudflare Worker Entry Point
// ============================================

/**
 * Main request handler for Cloudflare Worker.
 * Routes requests to appropriate handlers based on URL path.
 */
export default {
  /**
   * Handle incoming fetch requests.
   *
   * @param {Request} request - Incoming HTTP request
   * @param {Object} env - Environment variables and bindings
   * @param {ExecutionContext} ctx - Cloudflare execution context
   * @returns {Response} HTTP response
   */
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Route based on pathname
    switch (url.pathname) {
      case WEBHOOK_PATH:
        return handleWebhook(request, env, ctx);
      case "/registerWebhook":
        return registerWebhook(request, env);
      case "/unRegisterWebhook":
        return unregisterWebhook(env);
      case "/registerCommands":
        return registerCommands(env);
      default:
        return new Response("Not Found", { status: 404 });
    }
  },
};
