/**
 * kokosa-forward - Telegram Message Forwarding Bot
 * Copyright (c) 2025, 秦心桜
 * Licensed under BSD 2-Clause License
 *
 * @fileoverview Telegram Bot API client wrapper.
 * Provides a simple interface for common Telegram bot operations.
 */

/**
 * Create a Telegram API client instance.
 * Returns an object with methods for common bot operations.
 *
 * All methods return the parsed JSON response from Telegram.
 * Check response.ok to determine if the request succeeded.
 *
 * @param {string} token - Bot token from BotFather
 * @returns {Object} API client with the following methods:
 *   - sendMessage(params): Send a text message
 *   - copyMessage(params): Copy a message to another chat
 *   - forwardMessage(params): Forward a message
 *   - setWebhook(params): Configure webhook URL
 *   - answerCallbackQuery(params): Respond to inline button clicks
 *   - setMyCommands(params): Set bot menu commands
 *   - getFile(params): Get file download info
 *   - getFileUrl(filePath): Get direct download URL for a file
 *
 * @example
 * const telegram = createTelegramClient(process.env.BOT_TOKEN);
 * await telegram.sendMessage({
 *   chat_id: 123456,
 *   text: "Hello!"
 * });
 */
export function createTelegramClient(token) {
  /**
   * Build API endpoint URL for a given method.
   * @param {string} method - Telegram Bot API method name
   * @returns {string} Full API URL
   */
  const apiUrl = (method) => `https://api.telegram.org/bot${token}/${method}`;

  /**
   * Make a POST request to Telegram Bot API.
   * Logs request details for debugging.
   *
   * @param {string} method - API method name
   * @param {Object} body - Request parameters
   * @returns {Promise<Object>} Parsed JSON response
   */
  async function request(method, body) {
    // Log request for debugging (truncate long bodies)
    console.log(
      `[Telegram API] ${method}`,
      JSON.stringify(body).substring(0, 100) + "...",
    );

    // Make the API call
    const response = await fetch(apiUrl(method), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });

    // Return parsed response
    return response.json();
  }

  // Return client object with method wrappers
  return {
    /**
     * Send a text message.
     * @see https://core.telegram.org/bots/api#sendmessage
     */
    sendMessage: (params) => request("sendMessage", params),

    /**
     * Copy a message without the "Forwarded from" header.
     * @see https://core.telegram.org/bots/api#copymessage
     */
    copyMessage: (params) => request("copyMessage", params),

    /**
     * Forward a message with "Forwarded from" header.
     * @see https://core.telegram.org/bots/api#forwardmessage
     */
    forwardMessage: (params) => request("forwardMessage", params),

    /**
     * Set or delete webhook URL.
     * @see https://core.telegram.org/bots/api#setwebhook
     */
    setWebhook: (params) => request("setWebhook", params),

    /**
     * Respond to callback query (inline button click).
     * @see https://core.telegram.org/bots/api#answercallbackquery
     */
    answerCallbackQuery: (params) => request("answerCallbackQuery", params),

    /**
     * Set bot menu commands.
     * @see https://core.telegram.org/bots/api#setmycommands
     */
    setMyCommands: (params) => request("setMyCommands", params),

    /**
     * Get file info for downloading.
     * @see https://core.telegram.org/bots/api#getfile
     */
    getFile: (params) => request("getFile", params),

    /**
     * Get direct download URL for a file.
     * Use with file_path from getFile response.
     *
     * @param {string} filePath - File path from getFile result
     * @returns {string} Direct download URL
     */
    getFileUrl: (filePath) =>
      `https://api.telegram.org/file/bot${token}/${filePath}`,
  };
}
