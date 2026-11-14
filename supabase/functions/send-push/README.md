# send-push

Fires Expo Push when a row is inserted into `public.notifications`.

## Deploy

```bash
supabase functions deploy send-push
supabase secrets set PUSH_WEBHOOK_SECRET=...
```

## Webhook

In Supabase Dashboard → Database → Webhooks:

- Table: `notifications`
- Events: `INSERT`
- URL: `https://<project>.supabase.co/functions/v1/send-push`
  (or production `https://www.game-tennis.space/api/push/dispatch`)
- Header: `x-push-secret: <PUSH_WEBHOOK_SECRET>`

The function loads `push_tokens`, checks `notification_kind_enabled`, and skips muted preferences / users without tokens.
