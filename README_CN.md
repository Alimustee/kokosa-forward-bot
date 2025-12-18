# kfb (kokosa-forward-bot)

基于 Cloudflare Workers 的 Telegram 消息转发机器人，内置 AI 内容审核功能。

## 功能特性

- **消息转发**：访客消息转发给管理员，管理员回复直接发送给访客
- **AI 内容审核**：使用 Google Gemini API 自动检测文本、图片和贴纸
- **信任白名单**：通过 3 次 AI 检查的用户自动加入白名单，跳过后续审核
- **内容缓存**：相同内容缓存 24 小时，避免重复 API 调用
- **用户管理**：管理员可拉黑/解封/加白用户
- **申诉系统**：被封禁用户可提交申诉，管理员一键审批
- **多语言支持**：支持中英文，按用户偏好显示
- **频率限制**：每用户每分钟 10 次请求，防止滥用
- **多 API 轮换**：支持多个 Gemini API 密钥自动切换
- **统计功能**：追踪总消息数、封禁用户数、AI 封禁次数和 API 使用量
- **轻量部署**：零外部依赖，运行于 Cloudflare Workers + KV 存储

## 前置要求

- **Node.js** >= 18.0.0
- **pnpm**（或 npm/yarn）
- **Cloudflare 账号**（免费套餐即可）

## 快速开始

### 第一步：克隆并安装

```bash
git clone https://github.com/hatanokokosa/kokosa-forward-bot
cd kokosa-forward-bot
pnpm install # npm install / yarn install
```

### 第二步：创建 KV 命名空间

```bash
pnpm wrangler kv namespace create kfb
```

输出类似：

```
{ binding = "kfb", id = "xxxx-xxxx-xxxx-xxxx" }
```

记下这个 ID。

### 第三步：配置 wrangler.toml

用你的配置编辑 `wrangler.toml`（参见下方配置说明）。

### 第四步：部署

```bash
pnpm wrangler deploy
```

可使用 `pnpm wrangler tail` 查看日志。

### 第五步：注册 Webhook 和命令

在浏览器中访问（替换为你的 Worker URL）：

```
https://your-worker.workers.dev/registerWebhook
https://your-worker.workers.dev/registerCommands
```

看到成功提示后，机器人就可以使用了！

### 环境变量

| 变量                 | 说明                                                                      |
| -------------------- | ------------------------------------------------------------------------- |
| `ENV_BOT_TOKEN`      | 从 [@BotFather](https://t.me/BotFather) 获取                              |
| `ENV_BOT_SECRET`     | 任意随机字符串，用于 Webhook 安全验证                                     |
| `ENV_ADMIN_UID`      | 你的 Telegram 用户 ID（从 [@userinfobot](https://t.me/userinfobot) 获取） |
| `ENV_GEMINI_API_KEY` | 从 [Google AI Studio](https://aistudio.google.com/app/apikey) 获取        |

> **提示**：如需使用多个 Gemini API 密钥，用逗号分隔：
> `ENV_GEMINI_API_KEY = "key1,key2,key3"`

## 命令说明

### 管理员命令

| 命令                | 说明                             |
| ------------------- | -------------------------------- |
| `/start`            | 初始化机器人                     |
| `/block`            | 拉黑用户（回复该用户的消息）     |
| `/unblock`          | 解封用户（回复该用户的消息）     |
| `/trust`            | 加白用户（回复该用户的消息）     |
| `/trustid <UID>`    | 通过 UID 加白用户                |
| `/status`           | 查看用户状态（回复该用户的消息） |
| `/check`            | AI 检查（回复转发的消息）        |
| `/checktext <文本>` | 直接 AI 检查任意文本             |
| `/unban <UID>`      | 通过 UID 解封用户                |
| `/list`             | 查看所有被封禁用户（带解封按钮） |
| `/stats`            | 查看机器人统计和 API 使用情况    |
| `/lang`             | 切换语言                         |

### 访客命令

| 命令      | 说明                                           |
| --------- | ---------------------------------------------- |
| `/start`  | 启动机器人并获取欢迎消息                       |
| `/appeal` | 如果被封禁，提交申诉（可回复被封消息作为证据） |
| `/lang`   | 切换语言                                       |

## 项目结构

```
src/
├── index.js      # 入口文件，Webhook 处理，路由分发
├── config.js     # 配置常量
├── telegram.js   # Telegram API 客户端
├── ai.js         # Gemini AI 内容审核
├── i18n.js       # 国际化（翻译）
├── storage.js    # KV 存储、频率限制、缓存
└── handlers/
    ├── admin.js  # 管理员消息和回调处理
    └── guest.js  # 访客消息处理、申诉
```

## 功能详解

### AI 内容审核

- 检查文本消息、图片说明、照片和静态贴纸
- 使用 Google Gemini Flash Lite 模型，快速且低成本
- 区分真人和二次元内容以减少误判（其实是作者的小巧思，不得不品）
- 检测：裸露、垃圾信息、二维码、赌博、血腥、诈骗、钓鱼等

### 信任白名单系统

- 连续通过 **3 次 AI 检查** 的用户成为"可信用户"
- 可信用户完全跳过 AI 审核（节省 API 调用）
- 用户被封禁时信任分重置
- 管理员可通过 `/trust` 或 `/trustid` 手动加白名单

### 内容缓存

- 文本内容使用 SHA-256 哈希缓存
- 审核结果缓存 **24 小时**
- 相同内容无需再次调用 API

### 申诉系统

- 被封禁用户可使用 `/appeal` 申请解封
- 可回复被封消息并附加 `/appeal` 作为证据
- 管理员收到申诉后有"接受/拒绝"快捷按钮
- 一键审批，用户收到结果通知

### 频率限制

- 每用户每分钟 10 次请求
- 防止垃圾信息耗尽 API 配额
- 时间窗口后自动重置
- 友好的错误提示（含倒计时）

### 多语言支持（i18n）

机器人支持多语言，按用户偏好显示：

```
/lang  →  选择: 🇺🇸 English | 🇨🇳 中文
```

默认语言可在 `config.js` 中设置：

```javascript
export const LANGUAGE = "zh"; // 'en' 或 'zh'
```

添加新语言请在 `src/i18n.js` 的 `messages` 中添加新对象。

### 多 API 轮换

- 支持单个或多个 Gemini API 密钥（逗号分隔）
- 轮询调度算法
- API 错误时自动切换
- 按密钥追踪使用统计

### 统计追踪

- 总转发消息数（relays）
- 总封禁用户数
- AI 触发的封禁次数
- 每个 API 密钥的使用量

## 许可证

BSD 2-Clause "Simplified" License - 详见 [LICENSE](LICENSE) 文件。

## 致谢

- [telegram-bot-cloudflare](https://github.com/cvzi/telegram-bot-cloudflare) (CC0)
- [nfd](https://github.com/LloydAsp/nfd) (GPL v3)
- [Google Antigravity](https://antigravity.google/) (Unfree)
