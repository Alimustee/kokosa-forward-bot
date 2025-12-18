# kfb (kokosa-forward-bot)

[🇨🇳 中文文档](README_CN.md)

A Telegram message forwarding bot with AI-powered content moderation, built on Cloudflare Workers.

## Features

- **Message Forwarding**: Guest messages are forwarded to admin, admin replies are sent back to guests
- **AI Content Moderation**: Automatic content safety checking using Google Gemini API (text, images, stickers)
- **Trust Whitelist**: Users who pass 3 AI checks are trusted and skip future moderation
- **Content Caching**: Same content is cached for 24 hours to avoid redundant API calls
- **User Management**: Block/unblock/whitelist users with admin commands
- **Appeal System**: Blocked users can submit appeals with one-click admin approval/rejection
- **Internationalization**: Multi-language support (English, Chinese) with per-user preference
- **Rate Limiting**: Protect against spam with per-user request throttling (10 requests/minute)
- **Multi-API Rotation**: Support multiple Gemini API keys with automatic failover
- **Statistics Tracking**: Track total messages, blocked users, AI blocks, and API usage
- **Lightweight**: Zero external dependencies, runs on Cloudflare Workers with KV storage

## Prerequisites

- **Node.js** >= 18.0.0
- **pnpm** (or npm/yarn)
- **Cloudflare account** (free tier works)

## Setup

### Step 1: Clone and Install

```bash
git clone https://github.com/hatanokokosa/kokosa-forward-bot.git
cd kokosa-forward-bot
pnpm install # npm install / yarn install
```

### Step 2: Create KV Namespace

```bash
pnpm wrangler kv namespace create kfb
```

This outputs a namespace ID like:

```
{ binding = "kfb", id = "xxxx-xxxx-xxxx-xxxx" }
```

Copy this ID for the next step.

### Step 3: Configure wrangler.toml

Edit `wrangler.toml` with your settings (see Configuration section below).

### Step 4: Deploy

```bash
pnpm wrangler deploy
```

And you can run `pnpm wrangler tail` to see logs.

### Step 5: Register Webhook and Commands

Visit these URLs in your browser (replace with your worker URL):

```
https://your-worker.workers.dev/registerWebhook
https://your-worker.workers.dev/registerCommands
```

You should see success messages. Your bot is now ready!

### Environment Variables

| Variable             | Description                                                           |
| -------------------- | --------------------------------------------------------------------- |
| `ENV_BOT_TOKEN`      | Get from [@BotFather](https://t.me/BotFather)                         |
| `ENV_BOT_SECRET`     | Any random string for webhook security                                |
| `ENV_ADMIN_UID`      | Your Telegram user ID (from [@userinfobot](https://t.me/userinfobot)) |
| `ENV_GEMINI_API_KEY` | Get from [Google AI Studio](https://aistudio.google.com/app/apikey)   |

> **Tip**: For multiple Gemini API keys, use comma-separated values:
> `ENV_GEMINI_API_KEY = "key1,key2,key3"`

## Commands

### Admin Commands

| Command             | Description                                      |
| ------------------- | ------------------------------------------------ |
| `/start`            | Initialize bot                                   |
| `/block`            | Block user (reply to their message)              |
| `/unblock`          | Unblock user (reply to their message)            |
| `/trust`            | Whitelist user (reply to their message)          |
| `/trustid <UID>`    | Whitelist user by UID                            |
| `/status`           | Check user block status (reply to their message) |
| `/check`            | AI check (reply to forwarded message)            |
| `/checktext <text>` | AI check any text directly                       |
| `/unban <UID>`      | Unblock user by UID                              |
| `/list`             | View all banned users with unban buttons         |
| `/stats`            | View bot statistics and API usage                |
| `/lang`             | Change language                                  |

### Guest Commands

| Command   | Description                                                |
| --------- | ---------------------------------------------------------- |
| `/start`  | Start the bot and get welcome message                      |
| `/appeal` | Submit an appeal if blocked (can reply to blocked message) |
| `/lang`   | Change language                                            |

## Project Structure

```
src/
├── index.js      # Entry point, webhook handling, routing
├── config.js     # Configuration constants
├── telegram.js   # Telegram API client
├── ai.js         # Gemini AI content moderation
├── i18n.js       # Internationalization (translations)
├── storage.js    # KV storage, rate limiting, caching
└── handlers/
    ├── admin.js  # Admin message & callback handling
    └── guest.js  # Guest message handling, appeals
```

## Features Detail

### AI Content Moderation

- Checks text messages, image captions, photos, and static stickers
- Uses Google Gemini Flash Lite model for fast, low-cost moderation
- Distinguishes between real and 2D/anime content to reduce false positives
- Detects: nudity, spam, QR codes, gambling, gore, scams, phishing

### Trust Whitelist System

- Users who pass **3 consecutive AI checks** become "trusted"
- Trusted users skip AI moderation entirely (saves API calls)
- Trust score resets when user is banned
- Admin can manually whitelist via `/trust` or `/trustid`

### Content Caching

- Text content is hashed with SHA-256 for caching
- Moderation results cached for **24 hours**
- Same content blocked/allowed without calling API again
- Significantly reduces API usage for repeat content

### Appeal System

- Blocked users can use `/appeal` to request unban
- Can reply to their blocked message with `/appeal` to attach evidence
- Admin receives appeal with Accept/Reject inline buttons
- One-click approval or rejection with user notification

### Rate Limiting

- 10 requests per user per minute
- Prevents API quota exhaustion from spam
- Automatic reset after time window
- Friendly error message with countdown timer

### Internationalization (i18n)

The bot supports multiple languages with per-user preferences:

```
/lang  →  Select: 🇺🇸 English | 🇨🇳 中文
```

Default language can be set in `config.js`:

```javascript
export const LANGUAGE = "zh"; // 'en' or 'zh'
```

To add a new language, add a new object to `messages` in `src/i18n.js`.

### Multi-API Rotation

- Supports single or multiple Gemini API keys (comma-separated)
- Round-robin rotation algorithm
- Automatic failover on API errors
- Usage statistics tracking per API key

### Statistics Tracking

- Total messages forwarded (relays)
- Total banned users
- AI-triggered blocks count
- API usage per key

## License

BSD 2-Clause "Simplified" License - see [LICENSE](LICENSE) file for details.

## Acknowledgements

- [telegram-bot-cloudflare](https://github.com/cvzi/telegram-bot-cloudflare) (CC0)
- [nfd](https://github.com/LloydAsp/nfd) (GPL v3)
- [Google Antigravity](https://antigravity.google/) (Unfree)
