# Twilio WhatsApp Setup

Guide to connecting Iten Forge to WhatsApp via Twilio. Covers both the
sandbox (quick testing) and a dedicated purchased number (production).

---

## 1. Create a Twilio account

Sign up at <https://www.twilio.com/try-twilio>. Free trial works.

After signup you land on the Console Dashboard. Note two values:

- **Account SID** -- starts with `AC`, looks like `AC01652b2b19...`
- **Auth Token** -- click "Show" to reveal, looks like `e830660...`

Add them to your `.env`:

```bash
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

---

## 2a. Quick start with the Sandbox

The sandbox is fastest for testing. Skip to **2b** if you already have a
purchased number.

1. In the left sidebar, click **Messaging**
2. Click **Try it out** > **Send a WhatsApp message**
3. You will see a sandbox phone number and a join code (e.g. `join example-word`)
4. On your phone, open WhatsApp and send that join code to the sandbox number
5. You should get a confirmation reply

Set your `.env`:

```bash
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
MY_WHATSAPP_NUMBER=whatsapp:+1XXXXXXXXXX
```

Configure the webhook (see section 3 below), then test.

Sandbox limitations:

- Disconnects after 72h of inactivity (re-send the join code to reconnect)
- Only the phone number that joined can send/receive
- Cannot send template messages (Twilio-initiated outbound)

---

## 2b. Using a purchased Twilio number

This removes all sandbox limitations. Your number works permanently, supports
multiple recipients, and can send outbound template messages.

### Buy a number

1. Go to **Phone Numbers** > **Manage** > **Buy a number**
   (or: Console sidebar > search "Buy a number")
2. Search for a number with **SMS** and **MMS** capabilities
3. Purchase it

### Connect the number to WhatsApp

This is the part Twilio buries. The number you bought is a regular phone
number -- it needs to be registered as a WhatsApp Sender.

1. Go to **Messaging** > **Senders** > **WhatsApp senders**
   (direct URL: Console > search "WhatsApp senders")
2. Click **Add WhatsApp Sender** (or "New WhatsApp Sender")
3. Select your purchased number from the dropdown
4. Fill in the required profile fields:
   - **Display name**: `Iten Forge` (or whatever you want your bot to show as)
   - **Profile picture**: optional
   - **Business category**: choose the closest fit
5. Submit for approval

Meta (WhatsApp) reviews the sender profile. This usually takes a few minutes
to a few hours. You will get an email when approved. While waiting, the status
shows as "Pending" in the WhatsApp senders list.

Once approved, the status changes to **Ready**.

### Update your `.env`

Replace the sandbox number with your purchased number:

```bash
TWILIO_WHATSAPP_FROM=whatsapp:+1YOURNUMBER
MY_WHATSAPP_NUMBER=whatsapp:+1YOURPERSONALNUMBER
```

### Set the webhook on the purchased number

This is different from the sandbox webhook location.

1. Go to **Phone Numbers** > **Manage** > **Active numbers**
2. Click your purchased number
3. Scroll to the **Messaging** section
4. Under **"A message comes in"**, set:
   - URL: `https://YOUR-DOMAIN/webhook/whatsapp`
   - Method: **POST**
5. Click **Save**

For local dev, use your ngrok URL. For production, use your Railway URL.

### Message templates (optional, for outbound)

WhatsApp requires pre-approved templates for bot-initiated messages (messages
sent outside the 24h reply window). The daily reminder script needs this.

1. Go to **Messaging** > **Content Template Builder**
   (or: Console > search "Content Template Builder")
2. Click **Create new**
3. Template name: `daily_workout`
4. Category: **Utility**
5. Body: `{{1}}` (single variable that receives the full workout message)
6. Submit for approval

Once approved, update `scripts/send_reminder.py` to use the template SID.
Without a template, the daily reminder only works if you have messaged the
bot within the last 24 hours.

---

## 3. Configure the Webhook

This tells Twilio where to forward incoming WhatsApp messages.

### Local development (ngrok)

1. Start the server:

```bash
make serve
```

2. In another terminal, start the tunnel:

```bash
make tunnel
```

3. ngrok prints a URL like:

```text
Forwarding  https://a1b2-34-56-78.ngrok-free.app -> http://localhost:8000
```

4. Copy the `https://...ngrok-free.app` URL

5. Set the webhook:
   - **Sandbox**: Messaging > Try it out > Send a WhatsApp message > Sandbox settings > "When a message comes in"
   - **Purchased number**: Phone Numbers > Active numbers > click your number > Messaging > "A message comes in"
   - Paste: `https://YOUR-NGROK-URL/webhook/whatsapp`
   - Method: **POST**
   - Save

### Production

Same steps, use your production URL:

```text
https://your-app.railway.app/webhook/whatsapp
```

---

## 4. Test it

Send these messages from your phone to the Twilio number:

| Message    | Expected reply              |
| ---------- | --------------------------- |
| `help`     | List of all commands        |
| `today`    | Today's workout details     |
| `tomorrow` | Tomorrow's workout details  |

If you get replies, the webhook is working.

Without a database, journal commands (`rpe 7`, `note ...`) return a
"database not connected" message. Plan commands work without a database.

---

## 5. Daily reminders (GitHub Actions)

The daily reminder script sends tomorrow's workout every evening.

1. Go to your repo > **Settings** > **Secrets and variables** > **Actions**
2. Add **Repository Secrets**:
   - `TWILIO_ACCOUNT_SID`
   - `TWILIO_AUTH_TOKEN`
   - `TWILIO_WHATSAPP_FROM` (e.g. `whatsapp:+18581234567`)
   - `MY_WHATSAPP_NUMBER` (e.g. `whatsapp:+18582429062`)
3. Optionally add **Repository Variables**:
   - `ITEN_FORGE_GOAL_TIME` (default: `2:50:00`)
   - `ITEN_FORGE_START_DATE` (default: `2026-03-09`)
   - `ITEN_FORGE_UNIT` (default: `mi`)
4. The cron fires at 03:00 UTC daily (7pm PT). Edit
   `.github/workflows/daily-workout-reminder.yml` to change the schedule.
5. Test manually: Actions tab > Daily Workout Reminder > Run workflow

---

## Troubleshooting

### Cannot authenticate

- Double-check Account SID and Auth Token in `.env`
- SID starts with `AC`, not `US` or anything else

### No reply from WhatsApp

- Confirm ngrok is running and the webhook URL matches
- Check ngrok inspector at <http://localhost:4040> to see incoming requests
- Check terminal running `make serve` for errors

### Sandbox expires

- Re-send the `join xxx-xxx` code from your phone to reconnect
- This only applies to sandbox, not purchased numbers

### Purchased number not receiving messages

- Confirm the WhatsApp sender status is **Ready** (not Pending/Rejected)
- Confirm the webhook is set on the **number** (Active numbers page), not just
  the sandbox settings
- Check that the URL ends with `/webhook/whatsapp` and method is POST

### Messages not delivering (outbound)

- WhatsApp has a 24h session window for free-form replies
- Outside 24h, you need an approved message template
- For sandbox: send any message from your phone first to reopen the session

### Meta rejected the sender profile

- Make sure the display name follows WhatsApp guidelines (no all-caps,
  no special characters, must represent a real entity)
- Try a simpler name and resubmit
