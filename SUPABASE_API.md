# RevUpTime Supabase API

Project API URL: `https://rdmpjlaffzudjcchkxuh.supabase.co`

Client publishable API key (safe for frontend configuration; not an administrator credential):

```text
sb_publishable_qsEw_evLREwEut4E2hVPdg__uw-Au4R
```

Every request needs the `apikey` header containing this publishable key. Authenticated data requests also need `Authorization: Bearer <user access token>` returned by Supabase Auth. Do not use the publishable key as the user access token.

| Operation | Method and path |
| --- | --- |
| Create account | `POST /auth/v1/signup` |
| Password login | `POST /auth/v1/token?grant_type=password` |
| Verify signup code | `POST /auth/v1/verify` with `email`, `token`, `type: signup` |
| Resend verification | `POST /auth/v1/resend` with `email`, `type: signup` |
| Verified profile/workspace | `POST /rest/v1/rpc/revuptime_account_profile` |
| Assets | `GET /rest/v1/assets?organization_id=eq.<organization UUID>` |
| Create work order | `POST /rest/v1/rpc/revuptime_mobile_create_work_order` |
| Update work order | `POST /rest/v1/rpc/revuptime_mobile_update_work_order` |
| Complete work order | `POST /rest/v1/rpc/revuptime_mobile_complete_work_order` |

Data access is governed by RLS and verified workspace membership. A publishable key alone cannot grant access to another user's plant data. SMTP credentials, service-role keys, and AI-provider secrets are not client API keys and must remain server-side.

Email rate limits and sender restrictions are configured in Supabase Auth, not through this client key. See `SUPABASE_SETUP.md` for delivery setup.
