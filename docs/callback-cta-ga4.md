# Callback CTA conversion (GA4 + Supabase)

Event tracked in frontend:
- `request_callback`

GA4 setup:
1. Open GA4 Admin -> Events.
2. Find event `request_callback`.
3. Mark it as **Key event** (conversion).

Manual checklist:
1. Open a public page and click **Etre rappelee**.
2. Submit phone + email + consent.
3. Verify DB insert:
   `select * from public.lead order by created_at desc limit 5;`
4. Verify email notification (if `RESEND_API_KEY` is configured).
5. Verify GA4 event in DebugView (`request_callback`).
