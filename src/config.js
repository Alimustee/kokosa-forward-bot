/**
 * kokosa-forward - Telegram Message Forwarding Bot
 * Copyright (c) 2025, 秦心桜
 * Licensed under BSD 2-Clause License
 *
 * @fileoverview Application configuration constants.
 */

/** Webhook endpoint path. Keep this secret for security. */
export const WEBHOOK_PATH = "/endpoint";

/** 模型名称 - Google Gemini model for content moderation */
export const GEMINI_MODEL = "gemini-flash-lite-latest";

/** 启用AI内容过滤 - Enable AI content filtering. Requires ENV_GEMINI_API_KEY. */
export const ENABLE_FILTER = true;

/** 自动拉黑 - Auto-block users who send unsafe content */
export const AUTO_BLOCK = true;

/**
 * 默认语言 - Default language for new users.
 * Available: "en" (English), "zh" (Chinese)
 * Users can change with /lang command.
 */
export const LANGUAGE = "en";

// ============================================
// Rate Limiting Configuration
// ============================================

/** 频率限制 - Maximum requests per time window */
export const RATE_LIMIT_MAX_REQUESTS = 10;

/** Time window in milliseconds (1 minute) */
export const RATE_LIMIT_WINDOW_MS = 60000;

// ============================================
// Trust System Configuration
// ============================================

/** 信任阈值 - Messages needed to become trusted (skip AI moderation) */
export const TRUST_THRESHOLD = 3;
