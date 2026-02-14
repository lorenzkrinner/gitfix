import { spawn } from "node:child_process";

const repo = "lorenzkrinner/gitfix-testing";
const title = "TypeError when session expires: Cannot read property 'userId' of null";
const body = `**What happened**

When a user's session expires during a request, the app crashes instead of returning a proper error.

**Error**

TypeError: Cannot read property 'userId' of null

**Where**

Happens in the auth flow when calling \`getUser(token)\` with an expired or invalid token. Stack trace points to src/utils/auth.ts (around the line that uses the decoded token).

**Steps to reproduce**
1. Log in so you have a valid session/token.
2. Wait for the token to expire (or manually invalidate it).
3. Make any authenticated request that goes through \`getUser()\`.
4. Server throws the TypeError above.

**Expected**

We should get a clear auth error (e.g. 401) and a message like "Invalid or expired token", not a 500 and a stack trace.

**Environment**

Node 20, latest main.`;

const args = ["issue", "create", "--repo", repo, "--title", title, "--body", body];

const proc = spawn("gh", args, { stdio: "inherit" });
proc.on("exit", (code) => process.exit(code ?? 0));
