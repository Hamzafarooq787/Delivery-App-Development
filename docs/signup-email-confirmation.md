GoDrop signup sends email links to the same-origin /auth/confirm route. The default Supabase Confirm signup template continues to work: Supabase verifies the address and GoDrop sends the user to sign in. This flow does not require the original browser's PKCE verifier.

If changing the hosted Confirm signup template, use this optional link instead:
`<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&amp;type=email">Confirm your email</a>`

Keep the production Site URL at https://godrop.uk and permit https://godrop.uk/auth/confirm in the redirect settings if the Site URL changes. Do not change the password recovery or Google OAuth templates or callbacks. The confirm route verifies the hash without setting a session; the user signs in with their password and is routed using the stored account role.
