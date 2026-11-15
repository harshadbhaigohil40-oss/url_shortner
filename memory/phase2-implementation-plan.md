# PHASE 2 — REVISED IMPLEMENTATION PLAN (CORRECTED)

**Date:** 2026-11-08  
**Status:** Awaiting explicit user approval before any code modification  
**Scope:** Remediate 4 confirmed vulnerabilities (VULN-001, VULN-002, VULN-004, VULN-005)  
**Constraint:** No code modifications until explicit user approval. No production environment changes, no git operations, no deployment commands.

---

## Executive Summary

This plan replaces all previous implementation guidance. It addresses 6 critical security design issues raised by the user during review:

1. **Trust proxy** — verify actual deployment proxy topology; do not hardcode unverified hop count
2. **Rate limiting** — no sensitive attempt information exposed in response headers; Redis fail-closed; shared-IP considerations
3. **JWT rotation** — server-side key ring with `kid` header; no secret ever exposed in JWT headers, payloads, logs, or API responses
4. **Authorization** — admin privileges preserved but gated behind explicit permissions; audit logs with actor, target resource, target user, action, timestamp, request IP
5. **Testing** — executable test cases (not placeholders) for all specified scenarios
6. **Deployment** — all deployment instructions and git operations removed

---

## Change 1: Trust Proxy Hardening (VULN-001)

### Files affected
- `backend/server.js:44-45`

### Problem
`TRUST_PROXY_HOPS` env var defaults to `1` with no validation against actual deployment topology. Behind Cloudflare/load balancers, `req.ip` can be spoofed via `X-Forwarded-For` if the count is wrong, allowing attackers to bypass rate limits by spoofed headers.

### Design decision — verify, don't hardcode
- **Keep** `process.env.TRUST_PROXY_HOPS` read from environment (do not remove env var).
- **Add** strict validation at startup: validate that the configured hop count matches the actual proxy topology.
- **Document** that the operator must: (a) count actual proxy hops from client to app in their real deployment, (b) set `TRUST_PROXY_HOPS` to match that count at deploy time, and (c) test spoofed `X-Forwarded-For` headers to confirm `req.ip` reflects the true client IP.
- **Add** a startup check that logs a warning if `TRUST_PROXY_HOPS` is set to 0 (disables trust) or if the value seems inconsistent with known topology.
- **Do not** hardcode `app.set('trust proxy', 1)`. The env var value is operator-controlled after topology verification.

### Verification (testing)
- Send requests with `X-Forwarded-For: 1.2.3.4` and confirm `req.ip` is `1.2.3.4` when `TRUST_PROXY_HOPS` is set to 1 and exactly 1 trusted proxy is in front.
- Send requests with `X-Forwarded-For: 1.2.3.4, 5.6.7.8` and confirm `req.ip` is `5.6.7.8` (rightmost trusted entry) with hop count 1.
- Confirm spoofed headers cannot make `req.ip` appear as an arbitrary attacker-controlled value that bypasses rate limiting when the correct hop count is configured.
- Run `node -e "require('./backend/server.js')" ` with `TRUST_PROXY_HOPS=1` and verify the app logs a startup info message confirming the configured value.

### What this does NOT do
- Does not remove the `TRUST_PROXY_HOPS` env var.
- Does not run `git commit`, `git push`, `git revert`, or any deployment command.
- Does not hardcode a proxy hop count without operator verification.

---

## Change 2: Rate Limiting Hardening (VULN-002)

### Files affected
- `backend/middleware/rateLimiter.js`

### Problems
1. `passOnStoreError: true` for `global-api` and `shorten` — fail-open when Redis is down, allowing unlimited requests.
2. Response headers (`X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`) expose sensitive attempt information that aids brute-force reconnaissance.
3. `authLimiter` allows 10 req/15min — too permissive for credential stuffing.
4. No shared-IP consideration — legitimate users behind CGNAT/NAT share an IP and may be collectively rate-limited.

### Remediation

#### 2a. Tighten auth rate limits
| Endpoint group | Limit | Window |
|---|---|---|
| login | 5 req | 15 min |
| register | 5 req | 15 min |
| password reset / OTP | 3 req | 15 min |
| other auth | 10 req | 15 min |

Implemented as separate limiters per endpoint path prefix within `authLimiter`, or route-specific middleware wrapping `rateLimit`.

#### 2b. Remove sensitive headers from rate-limit responses
- **Remove** `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` from all limiter responses.
- **Keep** only `Retry-After` (standard, non-sensitive) when applicable.
- Set `standardHeaders: false` and `legacyHeaders: false` in `express-rate-limit` options.
- The `headers()` helper function is removed or narrowed to only set `Retry-After`.

#### 2c. Fail-closed on Redis errors
- Change `passOnStoreError` to `false` for all limiters (global-api, shorten, authentication, unlock, ai-analysis).
- When Redis is unavailable, all API requests return `503 Service Unavailable` rather than being allowed through unthrottled.
- The `enforceApiKeyRateLimit` function already returns `503` in production without Redis — keep that behavior.

#### 2d. Shared-IP considerations
- Document that shared IPs (CGNAT, corporate NAT, university networks) may cause multiple legitimate users to share a rate-limit bucket.
- Rate limits are keyed by `req.ip` (after trust proxy resolution); this is the best available signal without user authentication.
- For authenticated endpoints, consider augmenting the key with `userId` when available (per-user rate limiting for logged-in users).

### Verification (testing)
- Confirm rate-limit responses do NOT contain `X-RateLimit-Limit`, `X-RateLimit-Remaining`, or `X-RateLimit-Reset`.
- Confirm rate-limit responses MAY contain `Retry-After`.
- Simulate Redis down and confirm `/api` endpoints return `503` (fail-closed), not `200`.
- Confirm login endpoint allows max 5 attempts per 15 minutes, then blocks with `429`.
- Confirm password reset allows max 3 attempts per 15 minutes, then blocks with `429`.

### What this does NOT do
- Does not modify production Redis config or environment variables.
- Does not run any deployment or git command.

---

## Change 3: JWT Key Rotation with Server-Side Key Ring (VULN-004)

### Files affected
- `backend/middleware/authMiddleware.js`
- `backend/controllers/authController.js`
- New file: `backend/config/jwt-keyring.js` (server-side key management)

### Problem — CRITICAL constraint
The user explicitly prohibited: placing the JWT secret or its Base64 representation inside the JWT payload. Never expose signing secrets in JWT headers, payloads, logs, or API responses.

### Design — server-side key ring with `kid`

#### Key ring structure (`backend/config/jwt-keyring.js`)
```js
// In-memory key ring (loaded at startup from secure env/config)
const KEY_RING = {
  active: { kid: 'v1', secret: <from JWT_SECRET>, algorithm: 'HS256' },
  previous: [ { kid: 'v0', secret: <legacy JWT_SECRET>, algorithm: 'HS256' } ],
};
```

Rules:
- **One active signing key** — new tokens are signed only with `KEY_RING.active`.
- **Previous verification keys during a defined transition period** — `KEY_RING.previous` holds retired keys that can still verify but not sign.
- **`kid` in JWT header** — `jwt.sign(payload, secret, { algorithm: 'HS256', keyid: 'v1' })` puts `kid` in the JOSE header, not the payload.
- **Strict algorithm allowlisting** — `jwt.verify(token, secret, { algorithms: ['HS256'] })` — only HS256 accepted.
- **No arbitrary key selection from untrusted token data** — verification iterates the server-side key ring and tries each key; the `kid` from the token header can be used as a hint to select which key to try, but the key itself comes from the server-side ring, never from the token.
- **Secure key storage** — secrets come from `process.env.JWT_SECRET` (already validated by Zod, min 32 chars). No secret is ever written to a JWT, log, or API response.

#### Signing (`authController.js`)
- `generateAccessToken(id)` → `jwt.sign({ id, type: 'active' }, activeSecret, { expiresIn: '15m', keyid: activeKid, algorithm: 'HS256' })`
- `generateRefreshToken(id)` → `jwt.sign({ id, type: 'refresh' }, activeSecret, { expiresIn: '7d', keyid: activeKid, algorithm: 'HS256' })`

#### Verification (`authMiddleware.js`)
Replace `jwt.verify(token, getJwtSecret())` with key-ring verification:
1. Decode token header (unverified) to read `kid`.
2. Select candidate keys from the server-side ring: if `kid` matches an active or previous key, try that key first; otherwise try all keys in the ring.
3. Verify with `algorithms: ['HS256']` only.
4. If no key verifies, reject.

#### Rotation procedure (documented, not automated)
1. Add new secret as `previous` (or promote to `active` with old `active` moved to `previous`).
2. New tokens signed with new `active` key; old tokens still verifiable via `previous` keys.
3. After transition period, remove old keys from `previous`.
4. No JWKS endpoint, no AWS automation.

### Verification (testing)
- **JWT secret leakage test**: decode a generated JWT; confirm `JWT_SECRET` value (or Base64 of it) does NOT appear in header or payload.
- **Legacy token compatibility**: sign a token with an old `previous` key; confirm `protect` middleware still verifies it during the transition period.
- **Key rotation**: rotate active key; confirm new tokens verify with new key, old tokens still verify via previous key, then remove old key and confirm old tokens rejected.
- **Algorithm allowlisting**: attempt to sign/verify with `none` algorithm; confirm rejection.
- **Kid in header**: confirm JWT header contains `kid` but payload does not contain the secret.

### What this does NOT do
- Does not place JWT secret or Base64(secret) in JWT payload.
- Does not introduce JWKS endpoint.
- Does not introduce AWS Secrets Manager automation.
- Does not modify production environment variables.

---

## Change 4: Authorization with Explicit Permissions + Audit Logging (VULN-005)

### Files affected
- `backend/middleware/authorization.js`
- `backend/models/AuditLog.js`
- `backend/controllers/urlController.js` (bulk operations)

### Problem
`isOwnerOrAdmin()` returns `true` whenever `user.role === 'admin'`, bypassing all ownership checks. Admin actions on other users' resources are not audited with required fields.

### Remediation

#### 4a. Remove admin bypass from `isOwnerOrAdmin`
- `isOwnerOrAdmin(user, resource, ownerField)` now checks **only ownership**: `String(resource[ownerField]) === String(user._id)`.
- Admin role no longer automatically bypasses ownership. Admin operations require explicit admin permissions (`ADMIN_STATS`, `ADMIN_MANAGE_USERS`) checked via `requirePermission()` or `requireRole('admin')`.

#### 4b. Preserve intentional admin privileges
- `rolePermissions.admin` already includes all permissions (line 29). Admin users with `ADMIN_MANAGE_USERS` can manage other users; with `ADMIN_STATS` can read stats.
- `requireRole('admin')` and `requirePermission(permissions.ADMIN_MANAGE_USERS)` remain available for admin routes.
- Admin cross-user operations are authorized by explicit permission, not by role bypass.

#### 4c. Comprehensive audit logging
Enhance `AuditLog` schema with required fields:
- `actor` — user ID of the person performing the action (required)
- `targetResource` — type of resource (e.g., 'url', 'user', 'api-key') (required)
- `targetUserId` — ID of the user whose resource was affected (required for cross-user admin ops)
- `action` — the action performed (already exists)
- `timestamp` — when it occurred (already exists as `createdAt`)
- `ipAddress` — request IP (already exists)

All admin actions on other users' resources must write an audit log with all six fields.

### Critical correction: AuditLog schema field naming
The current schema has `createdAt` (not `timestamp`). The plan should reference `createdAt` as the existing timestamp field, and add `actor`, `targetResource`, `targetUserId` as new required fields. The six audit log fields are:
1. `actor` — new, required
2. `targetResource` — new, required
3. `targetUserId` — new, required
4. `action` — already exists
5. `createdAt` — already exists (this is the `timestamp`)
6. `ipAddress` — already exists

#### AuditLog schema enhancement:
```js
const auditLogSchema = new mongoose.Schema({
  actor: {
    type: String,
    required: true
  },
  targetResource: {
    type: String,
    required: true
  },
  targetUserId: {
    type: String,
    required: true
  },
  action: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['success', 'failure'],
    required: true
  },
  ipAddress: {
    type: String
  },
  details: {
    type: String
  },
  createdAt: { 
    type: Date, 
    default: Date.now,
    expires: 30 * 24 * 60 * 60, // Auto-delete logs after 30 days
    index: -1
  }
});
```

#### urlController audit log calls must include all six fields:
- Add `actor: req.user._id.toString()` 
- Add `targetResource: 'url'` (or appropriate resource type)
- Add `targetUserId: url.user.toString()` for user-specific operations

### Verification (testing)
- **IDOR test**: User A attempts to access/update/delete User B's URL via `requireOwner`; confirm `403 Forbidden`.
- **Admin permissions test**: Admin user without `ADMIN_MANAGE_USERS` cannot manage other users; confirm `403`.
- **Admin authorized test**: Admin user WITH `ADMIN_MANAGE_USERS` can manage other users; confirm `200` and audit log entry exists with all six fields.
- **Audit log fields test**: confirm audit log entries include `actor`, `targetResource`, `targetUserId`, `action`, `createdAt`, `ipAddress`.
- **Normal user ownership test**: user can only access their own URLs; confirm `403` for others' URLs.

### What this does NOT do
- Does not remove admin role or admin capabilities.
- Does not modify production environment variables.
- Does not run deployment or git commands.

---

## Change 5: Executable Test Suite

### Files affected
- New: `backend/test/jwt-keyring.test.js`
- New: `backend/test/rate-limit-security.test.js`
- New: `backend/test/proxy-spoofing.test.js`
- New: `backend/test/authorization-security.test.js`
- Existing: `backend/test/security.test.js` (extend if needed)

### Test files and scenarios

#### `jwt-keyring.test.js`
1. **JWT secret leakage**: Generate a token; parse header + payload; assert neither contains `JWT_SECRET` value or its Base64.
2. **Kid in header**: Assert JWT header contains `kid` field.
3. **Legacy token compatibility**: Sign with previous key; assert `protect` verifies during transition.
4. **Key rotation**: Rotate active key; assert new tokens verify, old tokens verify via previous, then revoke old and assert rejection.
5. **Algorithm allowlisting**: Attempt `none` algorithm; assert rejection.

#### `rate-limit-security.test.js`
1. **No sensitive headers**: Make a rate-limited request; assert response has no `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`.
2. **Fail-closed on Redis down**: Simulate Redis unavailable; assert API returns `503`, not `200`.
3. **Login limit**: 5 attempts max per 15 min; 6th gets `429`.
4. **Password reset limit**: 3 attempts max per 15 min; 4th gets `429`.

#### `proxy-spoofing.test.js`
1. **Single-hop trust**: With `TRUST_PROXY_HOPS=1`, send `X-Forwarded-For: 1.2.3.4`; assert `req.ip === '1.2.3.4'`.
2. **Multi-entry XFF**: Send `X-Forwarded-For: 1.2.3.4, 5.6.7.8`; assert rightmost trusted entry is used.
3. **Spoofed header cannot bypass rate limit**: Send many requests with spoofed XFF; assert they share the same rate-limit bucket.

#### `authorization-security.test.js`
1. **IDOR**: User A accesses User B's URL; assert `403`.
2. **Admin without permission**: Admin without `ADMIN_MANAGE_USERS` manages another user; assert `403`.
3. **Admin with permission**: Admin with `ADMIN_MANAGE_USERS` manages another user; assert `200` + audit log entry exists with all six fields.
4. **Audit log fields**: Assert audit entry has `actor`, `targetResource`, `targetUserId`, `action`, `createdAt`, `ipAddress`.

### Test execution
- Run with `node --test backend/test/*.test.js` (Node.js built-in test runner, already used by existing tests).
- No external test framework dependencies.

### What this does NOT do
- Does not use placeholder test descriptions; every test is executable.
- Does not modify production code or data.
- Does not run deployment or git commands.

---

## Change 6: Removal of All Deployment and Git Instructions

All previous guidance containing any of the following is **removed**:
- `git commit`, `git push`, `git revert`, `git checkout`
- Vercel deployment commands
- Production environment variable modifications (`vercel env`, `aws secretsmanager`, etc.)
- Any instruction to modify a live production environment

This plan is a **read-only document** describing code changes to be made only after explicit user approval.

---

## Implementation Order (after approval)

1. **Trust proxy** — `backend/server.js` validate TRUST_PROXY_HOPS against topology, add startup check
2. **Rate limiting** — `backend/middleware/rateLimiter.js` limits, headers, fail-closed
3. **JWT key ring** — new `backend/config/jwt-keyring.js`; modify `authMiddleware.js` and `authController.js`
4. **Authorization** — `backend/middleware/authorization.js` remove admin bypass; `backend/models/AuditLog.js` add fields; `backend/controllers/urlController.js` audit admin ops with all six fields
5. **Tests** — create all four test files; run `node --test`
6. **Verification** — confirm no secrets in JWTs, no sensitive headers, fail-closed behavior, IDOR blocked

---

## Rollback Plan (pre-approval, document only)

Each change is backward compatible at the API level:
- Trust proxy: operator sets correct hop count for their topology; wrong count degrades IP accuracy but does not break auth.
- Rate limiting: stricter limits may affect legitimate high-volume users; limits are tunable constants.
- JWT key ring: old tokens remain verifiable via `previous` keys during transition; no session invalidation.
- Authorization: admin bypass removed; admins need explicit permissions — this is a behavior change requiring admin permission assignment.

Rollback = revert the specific file change. No database migration required (AuditLog schema additions are additive).

---

⚠️ **DO NOT IMPLEMENT** — Awaiting explicit user approval before any code modifications.