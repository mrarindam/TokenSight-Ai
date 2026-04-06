# Phase 1.5: Telegram Alert Setup

## What's New

✅ Real-time Telegram notifications for token price alerts  
✅ Automated price checker running every 5 minutes  
✅ Link your Telegram account to receive instant DMs  

---

## Setup Instructions

### Step 1: Create Telegram Bot (One-time setup)

1. Open Telegram and search for **@BotFather**
2. Send `/newbot`
3. Give it a name: `TokenSight AI Alerts`
4. Give it username: `tokensight_ai_bot` (must be unique, you can use your own namespace)
5. **Copy the API Token** (looks like `123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11`)
6. Add to `.env.local`:
```
TELEGRAM_BOT_TOKEN=123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11
CRON_SECRET=your-secret-here
```

### Step 2: Update Supabase Schema

In Supabase SQL Editor, run:

```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_id TEXT UNIQUE;
CREATE INDEX IF NOT EXISTS idx_telegram_id ON users(telegram_id);
```

### Step 3: Deploy to Vercel

The `vercel.json` file is already configured to run alerts check every 5 minutes:

```json
{
  "crons": [
    {
      "path": "/api/cron/check-alerts",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

**To activate:**
- Deploy to Vercel
- Go to Vercel Dashboard → Project Settings → Crons
- Set `CRON_SECRET` environment variable
- Enable the cron

### Step 3.5: Set up Telegram Webhook

Your app now exposes a webhook endpoint at `/api/telegram/webhook`.

1. Deploy to Vercel so this endpoint is live.
2. Run this URL in your browser or use `curl` to verify it returns `404` for GET and accepts POST updates.
3. Register the webhook with Telegram using the bot token:

```bash
curl -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook" \
  -d "url=https://your-app.vercel.app/api/telegram/webhook"
```

4. Confirm Telegram returns `true`.

This makes `/start` work properly.

### Step 4: Users Link Their Telegram

1. Users go to `/settings/telegram`
2. Search for `@tokensight_ai_bot` in Telegram
3. Send `/start` command
4. Bot responds with their Telegram ID
5. Paste ID on the settings page
6. Done! They'll receive alerts via Telegram

---

## How It Works

**Every 5 minutes:**
1. Cron job runs `/api/cron/check-alerts`
2. Fetches all active alerts from database
3. Gets current price from DexScreener for each token
4. Compares price vs threshold
5. If triggered → sends Telegram message to user
6. Updates alert trigger count

**Alert Types:**
- 📉 **PRICE_DROP**: Sends when price falls below threshold
- 📈 **PRICE_RISE**: Sends when price rises above threshold
- ⚠️ **SCORE_CHANGE**: Sends when prediction score changes significantly

---

## Files Added

- `src/lib/telegram.ts` - Telegram bot client
- `src/app/api/user/telegram/link/route.ts` - Link user Telegram ID
- `src/app/api/cron/check-alerts/route.ts` - Main alert checker (runs every 5 min)
- `src/app/settings/telegram/page.tsx` - User Telegram settings page
- `vercel.json` - Cron configuration

---

## Testing

### Manual Test:
```bash
# Test the alert checker
curl -H "Authorization: Bearer YOUR_CRON_SECRET" \
  https://your-app.vercel.app/api/cron/check-alerts
```

### Expected Response:
```json
{
  "checked": 5,
  "triggered": 2
}
```

---

## Environment Variables

```
TELEGRAM_BOT_TOKEN=your-bot-token
CRON_SECRET=your-cron-secret
```

---

## Next Steps

- Users link Telegram → receive alerts instantly
- Create alerts in `/alerts` page
- Alerts trigger automatically via Telegram
- Ready for Phase 2!
