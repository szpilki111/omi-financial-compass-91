
# Problem: 2FA bypass through existing sessions

## Root cause

The 2FA check only runs inside `handleSubmit` on the Login page. But users with existing Supabase auth sessions never reach `handleSubmit`:

1. `AuthContext.initializeAuth()` loads the session → sets `user` + `isAuthenticated`
2. `ProtectedRoute` sees `user` exists → grants access
3. Login page `useEffect` sees `isAuthenticated` → auto-redirects to dashboard

Clearing `trusted_devices` did nothing because auth sessions are independent.

## Fix

### 1. Add device trust check in `AuthContext.tsx` (`initializeAuth`)

After loading a session, check if 2FA is enabled and device is trusted. If not, sign out the user:

```text
initializeAuth:
  1. getSession()
  2. if session exists:
     a. fetch app_settings.two_factor_auth_enabled
     b. if 2FA enabled:
        - generate device fingerprint
        - check trusted_devices for this user+fingerprint
        - if NOT trusted → signOut() + setIsLoading(false) + return
     c. proceed with fetchUserProfile as before
```

This ensures that ANY existing session from an untrusted device gets terminated immediately on app load.

### 2. Same check in `onAuthStateChange` handler

For the `SIGNED_IN` event, do the same trust check before calling `fetchUserProfile`. This prevents the brief authenticated state after `signInWithPassword` in the login flow (which signs in, then signs out for untrusted devices).

### 3. Login page `useEffect` (line 110-113) — no change needed

Once AuthContext properly signs out untrusted sessions, `isAuthenticated` will be `false` and the redirect won't fire.

### Files changed

| File | Change |
|------|--------|
| `src/context/AuthContext.tsx` | Add device trust verification in `initializeAuth` and `onAuthStateChange` before setting user state |

No new migrations needed — the `trusted_devices` table is already empty, and `app_settings.two_factor_auth_enabled` is already `true`.
