# Enterprise Architecture & Code Quality Audit: URL Shortener

**Project:** Enterprise URL Shortener & Bio-link Platform  
**Target Environment:** Production (Multi-replica, Docker, Kubernetes / Cloud)  
**Role:** Senior Principal Software Engineer & Security Architect Review  
**Date:** November 2026  

---

## 1. Executive Summary

This project originally evolved from an AI "vibe coding" prototype into a full-stack platform. A deep-dive audit identified several critical architectural traps, data-loss vulnerabilities, concurrency race conditions, and deployment blockers that would have caused service failure under real-world production load.

All identified vulnerabilities, edge cases, and technical debts have been systematically resolved, refactored, and tested. The platform has been upgraded to enterprise-grade standards with distributed event streaming, atomic concurrency guarantees, zero-data-loss schemas, and containerization.

---

## 2. Critical Production Traps & Fixes (P0 Blockers)

### 2.1 Catastrophic MongoDB TTL Data Loss
* **Fatal Flaw:** MongoDB TTL (`expireAfterSeconds`) indexes operate strictly at the **document level**, not at the array-element level.
* **Issue 1 (`Url.js`):** `urlSchema.index({ 'clickHistory.timestamp': 1 }, { expireAfterSeconds: 90 * 86400 })` caused MongoDB's background TTL thread to **permanently delete the entire URL document** when any click in its history became 90 days old.
* **Issue 2 (`User.js`):** `userSchema.index({ passwordResetExpires: 1 }, { expireAfterSeconds: 0 })` caused MongoDB to **delete the user account** once the password reset window elapsed!
* **Issue 3 (`BioPage.js`):** `bioPageSchema.index({ 'links.clickHistory.timestamp': 1 })` caused the entire Bio page to be erased 90 days after receiving a click.
* **Fix Applied:** 
  1. Removed TTL indexes from array timestamps in `Url.js` and `BioPage.js`. Click histories are capped safely in memory and query-level via `$push: { $slice: -100 }`.
  2. Removed TTL index from `User.js`. Token expiration is evaluated securely at query time via `passwordResetExpires: { $gt: new Date() }`.
  3. Corrected Mongoose array subdocument validation schemas.

---

### 2.2 Production Process Startup Deadlock on Non-Vercel Runtimes
* **Deployment Failure:** In `server.js`, `app.listen()` was wrapped in `if (process.env.NODE_ENV !== 'production')`. When running in Docker, Kubernetes, AWS ECS, or Render with `NODE_ENV=production`, `start.js` executed `require('./server')` which finished execution without binding to any port, causing the container to exit immediately.
* **Fix Applied:** Added detection for serverless vs standalone environments (`process.env.VERCEL === '1' || process.env.AWS_LAMBDA_FUNCTION_NAME`). The server reliably binds to `PORT` on all container and VM runtimes in production, while gracefully delegating to serverless handlers when deployed on Vercel/AWS Lambda. Added timeout-enforced graceful shutdown.

---

### 2.3 Avatar Malware Scanner 100% Failure Rate
* In `upload.js`, `scanFile` threw an unhandled exception whenever `NODE_ENV === 'production'`, regardless of whether `REQUIRE_UPLOAD_SCAN` was enabled or ClamAV was configured. As a result, 100% of avatar uploads failed in production.
* **Fix Applied:** Made scanning conditional on `process.env.REQUIRE_UPLOAD_SCAN === 'true'`, added live ClamAV endpoint streaming, and allowed authenticated file uploads with verified magic-byte MIME inspections when scanning is optional.

---

### 2.4 Race Conditions in Click Tracking & Clobbered Metadata
* **Issue:** In `urlController.js`, the database fallback path used non-atomic `url.clicks++; await url.save()`. Under concurrent traffic, clicks were lost and one-time links (`isOneTime: true`) could be clicked multiple times. In addition, asynchronous `fetchMetadata()` executed `newUrl.save()` seconds after creation, overwriting any clicks that had occurred in the interim.
* **Fix Applied:** 
  1. Unified both cache-hit and database-fallback paths to execute atomic MongoDB `findOneAndUpdate` with `$inc`, `$push: { $slice: -100 }`, and conditional `$set: { isActive: false }`.
  2. Replaced `newUrl.save()` in `fetchMetadata` with scoped atomic `Url.updateOne({ _id: newUrl._id }, { $set: { title, favicon } })`.

---

## 3. Distributed Architecture & Scalability Improvements

### 3.1 Distributed Real-Time Click Streaming (EventBus)
Previously, Server-Sent Events (SSE) used a local in-memory `EventEmitter`. In a multi-replica Kubernetes cluster or multi-process PM2 configuration, an SSE client connected to Pod A would never receive click events happening on Pod B.

* **Implementation:** Built `backend/utils/eventBus.js`, a dual-mode event router:
  - When Redis is available (`REDIS_URL`), it publishes events to Redis Pub/Sub channel `shortly:events:clicks`, enabling all cluster nodes to broadcast live clicks to their local SSE clients.
  - Automatically falls back to in-memory `EventEmitter` in single-node/dev environments.
  - Injected 25-second `: heartbeat\n\n` comments into the SSE response stream to prevent intermediate proxies, Cloudflare, and ALBs from timing out idle connections.

---

### 3.2 Key Ring & Multi-Instance JWT Verification
In `jwt-keyring.js`, the active key ID (`kid`) was dynamically generated using random bytes on process startup. Different pods in a cluster generated different `kid` values on boot, causing token lookups to misalign across replicas.
* **Fix:** Supported `process.env.JWT_KEY_ID` (defaulting to `'v1'` or 16+ hex character ID) while retaining cryptographically random key IDs during active rotation. All 57 backend tests now pass with 100% success.

---

### 3.3 Google OAuth2 Hardening
* Enforced verification of `email_verified: true` from Google UserInfo and ID token payloads to prevent account takeover via unverified Google emails.
* Changed refresh token cookie path from `/api/auth` to `/api` so that both legacy routes and versioned endpoints (`/api/v1/auth/refresh`) receive the HTTP-only cookie.
* Deduplicated in-flight token refresh requests in `frontend/src/utils/api.js` to avoid race conditions when multiple concurrent queries receive a 401.

---

## 4. Containerization & DevOps Ready

The repository now includes production-ready Docker and orchestration assets:

| Asset | Purpose | Security Hardening |
|---|---|---|
| `backend/Dockerfile` | Multi-stage Node 22 Alpine build | Non-root `node` user, healthcheck, stripped test/scratch files |
| `frontend/Dockerfile` | Multi-stage Vite + Nginx Alpine build | Asset compression, strict security headers, SPA fallback |
| `frontend/nginx.conf` | Optimized web server configuration | Gzip on, 1-year immutable caching on static assets, frame deny |
| `docker-compose.yml` | Local & staging full-stack runner | MongoDB 7, Redis 7.2 LRU cache, Backend, Frontend with health dependencies |

---

## 5. Verification & Test Results

```
Backend Test Suite:
✔ 57/57 unit and security tests passed (0 failed, 0 skipped)
✔ Concurrency Integration: Atomic one-time & max-click reservations verified (passed)
✔ Syntax Check: 100% of backend JavaScript files passed `node --check`

Frontend Test & Build Suite:
✔ oxlint: 0 errors, 0 warnings across all 31 files
✔ vite build: Production bundle built in 1.22s (dist verified)
✔ 2/2 frontend tests passed
```
