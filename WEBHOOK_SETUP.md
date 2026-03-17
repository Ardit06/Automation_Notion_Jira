# Notion webhook setup

## 1. Create the webhook

1. Open [Notion → My integrations](https://www.notion.so/my-integrations) → your integration.
2. Go to **Webhooks** → add a webhook.
3. Set the **URL** to your public HTTPS endpoint (see below).
4. Subscribe to events your databases need (e.g. page updates on User Stories / Epics).
5. Copy the **webhook secret** into `.env` as `NOTION_WEBHOOK_SECRET` (must match exactly).

## 2. Which URL to use

The app accepts Notion deliveries on:

| URL | Use case |
|-----|----------|
| `https://your-host/` | Root POST (some setups send verification/events here) |
| `https://your-host/webhook/notion` | Standard webhook path |

Use the same base URL you expose publicly (ngrok, Cloud Run, K8s LoadBalancer, etc.). Example with ngrok:

```text
https://xxxx.ngrok-free.app/
```

or

```text
https://xxxx.ngrok-free.app/webhook/notion
```

## 3. Verification

When you save the webhook, Notion sends a **verification** request. The server responds with the token/challenge in the format Notion expects.

If verification fails:

- Confirm the URL is reachable over **HTTPS** from the internet.
- Confirm `NOTION_WEBHOOK_SECRET` in `.env` matches the secret shown in Notion.
- Check logs under `logs/combined.log`.

## 4. Signed events

For real page events, Notion sends header `x-notion-signature-v2`. In **production** (`NODE_ENV=production`), the body is verified with `NOTION_WEBHOOK_SECRET`.

For **local testing** without real signatures, use `NODE_ENV=development` and `ALLOW_UNSIGNED_WEBHOOKS=true` in `.env`. See [CONFIG_GUIDE.md](CONFIG_GUIDE.md).

## 5. Integration access

The integration must have access to every Notion database that should trigger automation (share each database with the integration).
