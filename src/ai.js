/**
 * kokosa-forward - Telegram Message Forwarding Bot
 * Copyright (c) 2025, 秦心桜
 * Licensed under BSD 2-Clause License
 *
 * @fileoverview AI content moderation module using Google Gemini API.
 * Provides text and image safety checking with multi-key rotation support.
 */

import { GEMINI_MODEL } from "./config.js";

// ============================================
// API Key Management
// ============================================

/**
 * Current index for round-robin API key rotation.
 * Increments with each API call to distribute load across keys.
 */
let apiKeyIndex = 0;

/**
 * Tracks API usage statistics per key.
 * Keys are API key strings, values are call counts.
 * @type {Object.<string, number>}
 */
let apiUsageStats = {};

/**
 * Get next API key using round-robin rotation.
 * Distributes API calls evenly across all available keys.
 *
 * @param {string|Array<string>} apiKeys - Single key or array of keys
 * @returns {string} Selected API key
 * @throws {Error} If no API keys provided
 */
function getNextApiKey(apiKeys) {
  // Handle single key (string) case
  if (typeof apiKeys === "string") {
    return apiKeys;
  }

  // Validate array input
  if (!Array.isArray(apiKeys) || apiKeys.length === 0) {
    throw new Error("No API keys provided");
  }

  // Round-robin selection
  const key = apiKeys[apiKeyIndex % apiKeys.length];
  apiKeyIndex++;

  // Track usage statistics
  apiUsageStats[key] = (apiUsageStats[key] || 0) + 1;
  console.log(
    `[AI] Using API key #${(apiKeyIndex % apiKeys.length) + 1}, Total uses: ${apiUsageStats[key]}`,
  );

  return key;
}

// ============================================
// Content Moderation Prompt
// ============================================

/**
 * System prompt for content moderation.
 * Instructs the AI to classify content as SAFE or UNSAFE.
 * Designed for minimal token usage with one-word output.
 */
const MODERATION_PROMPT = `
# Role
Content Moderator API. Output one word only.

# Rules
UNSAFE if:
- Real human nudity/sex
- QR codes/spam/ads/gambling promotion
- Real gore/shock content
- Illegal content promotion
- Scam/phishing attempts

SAFE if:
- 2D/Anime/Cartoon (even suggestive)
- Normal photos/text/screenshots
- Regular conversation

# Output
One word: "SAFE" or "UNSAFE"

Analyze the content:`;

// ============================================
// Text Content Moderation
// ============================================

/**
 * Check text content safety using Google Gemini.
 * Returns null if safe, or a reason string if unsafe.
 *
 * @param {string} text - Text content to check
 * @param {string|Array<string>} apiKeys - Gemini API key(s)
 * @param {string} [model=GEMINI_MODEL] - Model to use
 * @returns {Promise<string|null>} Reason if unsafe, null if safe
 *
 * @example
 * const result = await checkContentSafety("Hello world", apiKeys);
 * if (result) {
 *   console.log("Unsafe:", result);
 * }
 */
export async function checkContentSafety(text, apiKeys, model = GEMINI_MODEL) {
  // Skip check for empty or very short text
  if (!text || text.length < 2 || !apiKeys) {
    return null;
  }

  // Normalize keys to array
  const keys = Array.isArray(apiKeys) ? apiKeys : [apiKeys];
  const maxRetries = keys.length;

  console.log(`[AI] Checking text: "${text.substring(0, 30)}..."`);

  // Build request payload with text content
  const payload = {
    contents: [
      {
        parts: [
          {
            text: `${MODERATION_PROMPT} ${JSON.stringify(text)}`,
          },
        ],
      },
    ],
  };

  return await callGeminiApi(payload, keys, maxRetries, model);
}

// ============================================
// Image Content Moderation
// ============================================

/**
 * Check image content safety using Google Gemini vision model.
 * Downloads image, converts to base64, and sends for analysis.
 *
 * @param {string} imageUrl - URL of the image to check
 * @param {string|Array<string>} apiKeys - Gemini API key(s)
 * @param {string} [caption=""] - Optional caption text
 * @param {string} [model=GEMINI_MODEL] - Model to use (must support vision)
 * @returns {Promise<string|null>} Reason if unsafe, null if safe
 */
export async function checkImageSafety(
  imageUrl,
  apiKeys,
  caption = "",
  model = GEMINI_MODEL,
) {
  // Validate required parameters
  if (!imageUrl || !apiKeys) {
    return null;
  }

  // Normalize keys to array
  const keys = Array.isArray(apiKeys) ? apiKeys : [apiKeys];
  const maxRetries = keys.length;

  console.log(`[AI] Checking image: ${imageUrl.substring(0, 50)}...`);

  try {
    // Step 1: Download image from URL
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      console.log(`[AI] Failed to download image: ${imageResponse.status}`);
      return null;
    }

    // Step 2: Convert to base64
    const imageBuffer = await imageResponse.arrayBuffer();
    const uint8Array = new Uint8Array(imageBuffer);

    // Convert to base64 in chunks to avoid stack overflow on large images
    let binary = "";
    const chunkSize = 8192;
    for (let i = 0; i < uint8Array.length; i += chunkSize) {
      const chunk = uint8Array.subarray(i, i + chunkSize);
      binary += String.fromCharCode.apply(null, chunk);
    }
    const base64Image = btoa(binary);

    // Step 3: Detect MIME type from URL or magic bytes
    let mimeType = "image/jpeg"; // Default fallback

    // Try URL extension first
    if (imageUrl.includes(".png")) {
      mimeType = "image/png";
    } else if (imageUrl.includes(".gif")) {
      mimeType = "image/gif";
    } else if (imageUrl.includes(".webp")) {
      mimeType = "image/webp";
    } else {
      // Fallback: detect from magic bytes (file signature)
      if (uint8Array[0] === 0x89 && uint8Array[1] === 0x50) {
        mimeType = "image/png"; // PNG signature: 89 50
      } else if (uint8Array[0] === 0x47 && uint8Array[1] === 0x49) {
        mimeType = "image/gif"; // GIF signature: 47 49 (GI)
      } else if (uint8Array[0] === 0x52 && uint8Array[1] === 0x49) {
        mimeType = "image/webp"; // WebP signature: 52 49 (RI)
      }
    }

    console.log(
      `[AI] Image downloaded, size: ${imageBuffer.byteLength} bytes, type: ${mimeType}`,
    );

    // Step 4: Build multimodal payload
    const parts = [
      {
        inline_data: {
          mime_type: mimeType,
          data: base64Image,
        },
      },
      {
        text: caption
          ? `${MODERATION_PROMPT} (Caption: ${caption})`
          : MODERATION_PROMPT,
      },
    ];

    const payload = {
      contents: [
        {
          parts: parts,
        },
      ],
    };

    return await callGeminiApi(payload, keys, maxRetries, model);
  } catch (e) {
    console.log(`[AI] Image processing error: ${e.message}`);
    return null;
  }
}

// ============================================
// Gemini API Client
// ============================================

/**
 * Call Gemini API with automatic retry and key rotation.
 * On failure, rotates to next API key and retries.
 *
 * @param {Object} payload - Request payload
 * @param {Array<string>} keys - Array of API keys
 * @param {number} maxRetries - Maximum retry attempts
 * @param {string} model - Model name
 * @returns {Promise<string|null>} Reason if unsafe, null if safe or error
 */
async function callGeminiApi(payload, keys, maxRetries, model) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    // Get next API key in rotation
    const apiKey = getNextApiKey(keys);
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    try {
      // Make API request
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      // Handle API errors
      if (!response.ok) {
        console.log(
          `[AI] API Error (attempt ${attempt + 1}): ${response.status}`,
        );
        const errText = await response.text();
        console.log(`[AI] Details: ${errText.substring(0, 200)}`);

        // Retry with next key if attempts remaining
        if (attempt < maxRetries - 1) {
          console.log(`[AI] Switching to next API key...`);
          continue;
        }
        return null;
      }

      // Parse response and extract result
      const data = await response.json();
      const result = data.candidates?.[0]?.content?.parts?.[0]?.text
        ?.trim()
        .toUpperCase();

      console.log(`[AI] Result: ${result}`);

      // Check for unsafe verdict
      if (result && result.includes("UNSAFE")) {
        return "Content policy violation";
      }
      return null;
    } catch (e) {
      console.log(`[AI] Exception (attempt ${attempt + 1}): ${e.message}`);

      // Retry with next key if attempts remaining
      if (attempt < maxRetries - 1) {
        console.log(`[AI] Switching to next API key...`);
        continue;
      }
      return null;
    }
  }

  // All retries exhausted
  return null;
}

// ============================================
// Utility Functions
// ============================================

/**
 * Get API usage statistics for monitoring.
 * Returns a copy to prevent external modification.
 *
 * @returns {Object.<string, number>} Map of API key to call count
 */
export function getApiUsageStats() {
  return { ...apiUsageStats };
}

/**
 * Parse API keys from environment variable string.
 * Supports both single key and comma-separated multiple keys.
 *
 * @param {string} keyString - API key string
 * @returns {string|Array<string>|null} Single key, array of keys, or null
 *
 * @example
 * parseApiKeys("key1") // returns "key1"
 * parseApiKeys("key1,key2,key3") // returns ["key1", "key2", "key3"]
 */
export function parseApiKeys(keyString) {
  if (!keyString) return null;

  // Check for comma-separated format
  if (keyString.includes(",")) {
    return keyString.split(",").map((k) => k.trim());
  }

  return keyString;
}
