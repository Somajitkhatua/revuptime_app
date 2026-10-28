# RevUpTime live account setup

The app is connected to the existing RevUpTime Supabase project. Its existing normalized tables are preserved. `EXPO_PUBLIC_BACKEND_SCHEMA=canonical` enables the adapters; public configuration is also included in the preview APK profile so a future cloud build does not silently revert to demo mode.

## Account flow

Create account → verification email → email link or code → verified workspace provisioning → dashboard. Passwords must have at least ten characters. Resend uses a cooldown and Supabase's server rate limits. Workspace roles come from protected membership rows, not user-editable metadata. Existing memberships remain unchanged. Unverified accounts cannot provision a workspace; inactive accounts and memberships cannot regain access through onboarding.

The account-profile RPC uses a transaction lock to prevent duplicate workspaces. Public clients receive only the project URL and publishable key. No service-role key is present in the app.

## Email configuration required in the Supabase dashboard

1. Open Authentication → Email / SMTP and configure a verified sender with your email provider. Supabase's built-in mail service is restricted and is unsuitable for general public signup.
2. Keep Email enabled, Confirm email enabled, and signup enabled.
3. In Authentication → Email Templates → Confirm signup, include a code so verification works directly inside the mobile app:

The ready-to-copy template is `supabase/email-templates/confirm-signup.html`. This is the **Confirm signup** template, separate from the password-recovery template. Changing recovery emails does not add codes to signup emails. Save the template in the dashboard; the database connector cannot update Auth email settings.

```html
<h2>Verify your RevUpTime account</h2>
<p>Your verification code is:</p>
<p style="font-size:28px;font-weight:bold">{{ .Token }}</p>
<p>If you did not request this account, ignore this email.</p>
```

4. For clickable links, retain `{{ .ConfirmationURL }}` and add `revuptime://auth/confirm` and `revuptime://forgot-password` to Authentication → URL Configuration → Redirect URLs. For the PC browser preview add `http://localhost:8082/auth/confirm` and `http://localhost:8082/forgot-password`. Expo Go links vary with the server address; code verification avoids that dependency. A deployed web URL must be added separately before public web use.
5. Set appropriate password requirements, enable leaked-password protection if available on your plan, and configure abuse controls/CAPTCHA before public launch.

Never put SMTP credentials into `.env` or send them in chat; enter them directly into Supabase.

## Verification performed

- Browser account journey uses intercepted network responses: matching-password validation, signup, invalid code rejection, verified session, and dashboard access. It sends no real email.
- Transactional live database checks exercise verified onboarding, idempotence, unverified rejection, Viewer write rejection, checklist enforcement, atomic completion/history, duplicate closure, and closed-checklist protection. Synthetic users/data are rolled back.
- TypeScript and domain tests are run alongside native/web export checks.

Real inbox delivery and confirmation must still be verified using your sender and an account you control. The database security advisor reports leaked-password protection disabled; no missing-RLS findings were returned.

## Remaining service setup

New live workspaces start with no machines or telemetry. Add real sites/assets and configure ingestion; demo machine data is not inserted into real accounts. Document files save to private storage, with metadata in `asset_documents`; processing remains queued until a compatible processor and AI/embedding/OCR provider are configured. Existing server-function source targets the original fresh schema and must not be deployed unchanged against the canonical project. Remote push dispatch also requires deployment/provider configuration.

No APK is claimed complete at this stage. Account/email verification is the current prerequisite before release.
