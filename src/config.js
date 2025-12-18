/**
 * kokosa-forward - Telegram Message Forwarding Bot
 * Copyright (c) 2025, 秦心桜
 * Licensed under BSD 2-Clause License
 *
 * @fileoverview Application configuration constants.
 * All configuration options are defined here for easy customization.
 */

// ============================================
// Webhook Configuration
// ============================================

/**
 * URL path for Telegram webhook endpoint.
 * This is where Telegram sends updates.
 * Keep it secret/random for security.
 */
export const WEBHOOK_PATH = "/endpoint";

// ============================================
// AI Configuration
// ============================================

/**
 * Google Gemini model name for content moderation.
 */
export const GEMINI_MODEL = "gemini-flash-lite-latest";

// ============================================
// Feature Flags
// ============================================

/**
 * Enable AI content filtering.
 * When true, messages are checked by Gemini before forwarding.
 * Requires ENV_GEMINI_API_KEY to be set.
 */
export const ENABLE_FILTER = true;

/**
 * Automatically block users who send unsafe content.
 * When true, users are blocked immediately after AI detection.
 * When false, content is rejected but user remains unblocked.
 */
export const AUTO_BLOCK = true;

// ============================================
// Internationalization
// ============================================

/**
 * Default language for new users.
 * Available options:
 * - "en" - English
 * - "zh" - Chinese (中文)
 *
 * Users can change their language with /lang command.
 */
export const LANGUAGE = "en";
