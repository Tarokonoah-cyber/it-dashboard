import assert from "node:assert/strict";
import { createHmac, randomBytes, scrypt as nodeScrypt, timingSafeEqual } from "node:crypto";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { promisify } from "node:util";
import vm from "node:vm";

async function loadAuthModule() {
  const code = await readFile(new URL("../lib/auth.js", import.meta.url), "utf8");
  const sourceModule = new vm.SourceTextModule(code, { identifier: "auth.js" });
  await sourceModule.link(async (specifier) => {
    if (specifier === "server-only") {
      return new vm.SyntheticModule([], () => {}, { identifier: "server-only" });
    }
    if (specifier === "node:crypto") {
      return new vm.SyntheticModule(["createHmac"], function setExports() {
        this.setExport("createHmac", createHmac);
      }, { identifier: "node:crypto" });
    }
    throw new Error(`Unexpected test import: ${specifier}`);
  });
  await sourceModule.evaluate();
  return sourceModule.namespace;
}

async function loadSafeNavigationModule() {
  const code = await readFile(new URL("../lib/safe-navigation.js", import.meta.url), "utf8");
  const sourceModule = new vm.SourceTextModule(code, { identifier: "safe-navigation.js" });
  await sourceModule.link(() => {
    throw new Error("safe-navigation.js must not import other modules");
  });
  await sourceModule.evaluate();
  return sourceModule.namespace;
}

async function loadDashboardCredentialsModule(supabaseRequest) {
  const code = await readFile(new URL("../lib/dashboard-credentials.js", import.meta.url), "utf8");
  const sourceModule = new vm.SourceTextModule(code, { identifier: "dashboard-credentials.js" });
  await sourceModule.link(async (specifier) => {
    if (specifier === "server-only") {
      return new vm.SyntheticModule([], () => {}, { identifier: "server-only" });
    }
    if (specifier === "node:crypto") {
      return new vm.SyntheticModule(["randomBytes", "scrypt", "timingSafeEqual"], function setExports() {
        this.setExport("randomBytes", randomBytes);
        this.setExport("scrypt", nodeScrypt);
        this.setExport("timingSafeEqual", timingSafeEqual);
      }, { identifier: "node:crypto" });
    }
    if (specifier === "node:util") {
      return new vm.SyntheticModule(["promisify"], function setExports() {
        this.setExport("promisify", promisify);
      }, { identifier: "node:util" });
    }
    if (specifier === "./auth") {
      return new vm.SyntheticModule(["DASHBOARD_LOGIN_USER", "verifyDashboardCredentials"], function setExports() {
        this.setExport("DASHBOARD_LOGIN_USER", "taroko");
        this.setExport("verifyDashboardCredentials", () => false);
      }, { identifier: "auth-stub.js" });
    }
    if (specifier === "./supabase-rest") {
      return new vm.SyntheticModule(["supabaseRequest"], function setExports() {
        this.setExport("supabaseRequest", supabaseRequest);
      }, { identifier: "supabase-rest-stub.js" });
    }
    throw new Error(`Unexpected credential module import: ${specifier}`);
  });
  await sourceModule.evaluate();
  return sourceModule.namespace;
}

function withAuthEnv(values, callback) {
  const names = [
    "DASHBOARD_LOGIN_USER",
    "DASHBOARD_LOGIN_PASSWORD",
    "DASHBOARD_SESSION_SECRET",
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY"
  ];
  const previous = Object.fromEntries(names.map((name) => [name, process.env[name]]));
  for (const name of names) {
    if (values[name] === undefined) delete process.env[name];
    else process.env[name] = values[name];
  }
  try {
    return callback();
  } finally {
    for (const name of names) {
      if (previous[name] === undefined) delete process.env[name];
      else process.env[name] = previous[name];
    }
  }
}

function authRequest({ cookie = "", authorization = "" } = {}) {
  return {
    cookies: { get: () => cookie ? { value: cookie } : undefined },
    headers: new Headers({ host: "dashboard.example", authorization })
  };
}

function fakeNextResponseModule(cookieCalls) {
  const NextResponse = {
    json(body, options = {}) {
      return {
        body,
        status: options.status || 200,
        headers: new Headers(options.headers),
        cookies: {
          set(name, value, cookieOptions) {
            cookieCalls.push({ name, value, options: cookieOptions });
          }
        }
      };
    }
  };
  return new vm.SyntheticModule(["NextResponse"], function setExports() {
    this.setExport("NextResponse", NextResponse);
  }, { identifier: "next/server" });
}

async function loadLoginRoute(verifyCredentials) {
  const code = await readFile(new URL("../app/api/login/route.js", import.meta.url), "utf8");
  const cookieCalls = [];
  class PayloadTooLargeError extends Error {}
  const routeModule = new vm.SourceTextModule(code, { identifier: "login-route.js" });
  await routeModule.link(async (specifier) => {
    if (specifier === "next/server") return fakeNextResponseModule(cookieCalls);
    if (specifier === "../../../lib/auth") {
      return new vm.SyntheticModule([
        "createDashboardSessionToken",
        "DASHBOARD_SESSION_COOKIE",
        "DASHBOARD_SESSION_TTL_SECONDS",
        "dashboardAuthConfigured"
      ], function setExports() {
        this.setExport("createDashboardSessionToken", () => "signed-session-token");
        this.setExport("DASHBOARD_SESSION_COOKIE", "taroko_dashboard_session");
        this.setExport("DASHBOARD_SESSION_TTL_SECONDS", 28_800);
        this.setExport("dashboardAuthConfigured", () => true);
      }, { identifier: "auth-stub.js" });
    }
    if (specifier === "../../../lib/dashboard-credentials") {
      return new vm.SyntheticModule(["verifyDashboardLoginCredentials"], function setExports() {
        this.setExport("verifyDashboardLoginCredentials", verifyCredentials);
      }, { identifier: "credentials-stub.js" });
    }
    if (specifier === "../../../lib/request-body") {
      return new vm.SyntheticModule(["PayloadTooLargeError", "readLimitedText"], function setExports() {
        this.setExport("PayloadTooLargeError", PayloadTooLargeError);
        this.setExport("readLimitedText", async (request, limit) => {
          const text = await request.text();
          if (Buffer.byteLength(text, "utf8") > limit) throw new PayloadTooLargeError();
          return text;
        });
      }, { identifier: "request-body-stub.js" });
    }
    throw new Error(`Unexpected login route import: ${specifier}`);
  });
  await routeModule.evaluate();
  return { POST: routeModule.namespace.POST, cookieCalls };
}

async function loadLogoutRoute() {
  const code = await readFile(new URL("../app/api/logout/route.js", import.meta.url), "utf8");
  const cookieCalls = [];
  const routeModule = new vm.SourceTextModule(code, { identifier: "logout-route.js" });
  await routeModule.link(async (specifier) => {
    if (specifier === "next/server") return fakeNextResponseModule(cookieCalls);
    if (specifier === "../../../lib/auth") {
      return new vm.SyntheticModule(["DASHBOARD_SESSION_COOKIE"], function setExports() {
        this.setExport("DASHBOARD_SESSION_COOKIE", "taroko_dashboard_session");
      }, { identifier: "auth-stub.js" });
    }
    throw new Error(`Unexpected logout route import: ${specifier}`);
  });
  await routeModule.evaluate();
  return { POST: routeModule.namespace.POST, cookieCalls };
}

test("dashboard auth fails closed when production settings are absent", async () => {
  const auth = await loadAuthModule();
  withAuthEnv({}, () => {
    assert.equal(auth.dashboardAuthConfigured(), false);
    assert.equal(auth.verifyDashboardCredentials("taroko", "123456"), false);
    assert.equal(auth.verifyDashboardSessionCookie("anything"), false);
  });
});

test("only taroko can use the environment credential fallback", async () => {
  const auth = await loadAuthModule();
  withAuthEnv({
    DASHBOARD_LOGIN_USER: "taroko",
    DASHBOARD_LOGIN_PASSWORD: "a-strong-password",
    DASHBOARD_SESSION_SECRET: "0123456789abcdef0123456789abcdef"
  }, () => {
    assert.equal(auth.dashboardLoginUser(), "taroko");
    assert.equal(auth.dashboardAuthConfigured(), true);
    assert.equal(auth.verifyDashboardCredentials("taroko", "a-strong-password"), true);
    assert.equal(auth.verifyDashboardCredentials("taroko", "wrong"), false);
    assert.equal(auth.verifyDashboardCredentials("admin", "a-strong-password"), false);
  });

  withAuthEnv({
    DASHBOARD_LOGIN_USER: "admin",
    DASHBOARD_LOGIN_PASSWORD: "a-strong-password",
    DASHBOARD_SESSION_SECRET: "0123456789abcdef0123456789abcdef"
  }, () => {
    assert.equal(auth.dashboardAuthConfigured(), false);
  });
});

test("stored credentials authenticate only taroko and password updates remain hashed", async () => {
  const salt = "fixed-test-salt";
  const passwordHash = Buffer.from(
    await promisify(nodeScrypt)("stored-password", salt, 64)
  ).toString("base64url");
  const writes = [];
  const credentials = await loadDashboardCredentialsModule(async (table, query, options) => {
    assert.equal(table, "dashboard_login_credentials");
    if (!options) {
      assert.match(query, /id=eq\.1/);
      return [{ username: "taroko", password_salt: salt, password_hash: passwordHash }];
    }
    writes.push({ query, options });
    return [{ updated_at: "2026-08-12T00:00:00.000Z" }];
  });

  assert.equal(await credentials.verifyDashboardLoginCredentials("taroko", "stored-password"), true);
  assert.equal(await credentials.verifyDashboardLoginCredentials("taroko", "wrong"), false);
  assert.equal(await credentials.verifyDashboardLoginCredentials("admin", "stored-password"), false);

  await credentials.updateDashboardPassword("taroko", "new-stored-password");
  assert.equal(writes.length, 1);
  assert.equal(writes[0].options.body.username, "taroko");
  assert.notEqual(writes[0].options.body.password_hash, "new-stored-password");
  assert.equal("password" in writes[0].options.body, false);
});

test("dashboard session survives refresh, expires after eight hours, and protects requests", async () => {
  const auth = await loadAuthModule();
  withAuthEnv({
    DASHBOARD_LOGIN_USER: "taroko",
    DASHBOARD_LOGIN_PASSWORD: "a-strong-password",
    DASHBOARD_SESSION_SECRET: "0123456789abcdef0123456789abcdef"
  }, () => {
    const now = Date.now();
    const token = auth.createDashboardSessionToken(now);
    assert.equal(auth.verifyDashboardSessionCookie(token, now), true);
    assert.equal(auth.verifyDashboardSessionCookie(token, now + 60 * 60 * 1000), true);
    assert.equal(auth.requireDashboardAuth(authRequest({ cookie: token })), null);
    assert.equal(auth.requireDashboardAuth(authRequest()).status, 401);
    assert.equal(
      auth.verifyDashboardSessionCookie(token, now + auth.DASHBOARD_SESSION_TTL_SECONDS * 1000 + 1),
      false
    );
    assert.equal(auth.verifyDashboardSessionCookie(`${token}tampered`, now), false);

    const basic = Buffer.from("taroko:a-strong-password").toString("base64");
    assert.equal(auth.requireDashboardAuth(authRequest({ authorization: `Basic ${basic}` })).status, 401);
  });
});

test("login route accepts taroko, rejects other credentials, and keeps secure cookie settings", async () => {
  const verified = [];
  const { POST, cookieCalls } = await loadLoginRoute(async (user, password) => {
    verified.push({ user, password });
    return user === "taroko" && password === "correct-password";
  });

  const success = await POST(new Request("https://dashboard.test/api/login", {
    method: "POST",
    body: JSON.stringify({ user: "taroko", password: "correct-password" })
  }));
  assert.equal(success.status, 200);
  assert.deepEqual(verified[0], { user: "taroko", password: "correct-password" });
  assert.equal(success.headers.get("cache-control"), "no-store");
  assert.equal(cookieCalls.length, 1);
  assert.equal(cookieCalls[0].name, "taroko_dashboard_session");
  assert.equal(cookieCalls[0].value, "signed-session-token");
  assert.equal(cookieCalls[0].options.httpOnly, true);
  assert.equal(cookieCalls[0].options.sameSite, "lax");
  assert.equal(cookieCalls[0].options.maxAge, 28_800);
  assert.equal(cookieCalls[0].options.priority, "high");

  const rejected = await POST(new Request("https://dashboard.test/api/login", {
    method: "POST",
    body: JSON.stringify({ user: "admin", password: "correct-password" })
  }));
  assert.equal(rejected.status, 401);
  assert.equal(cookieCalls.length, 1);

  const invalidJson = await POST(new Request("https://dashboard.test/api/login", {
    method: "POST",
    body: "{invalid"
  }));
  assert.equal(invalidJson.status, 400);

  const oversized = await POST(new Request("https://dashboard.test/api/login", {
    method: "POST",
    body: "x".repeat(16 * 1024 + 1)
  }));
  assert.equal(oversized.status, 413);
});

test("logout clears the session cookie without caching the response", async () => {
  const { POST, cookieCalls } = await loadLogoutRoute();
  const response = await POST();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(cookieCalls.length, 1);
  assert.equal(cookieCalls[0].name, "taroko_dashboard_session");
  assert.equal(cookieCalls[0].value, "");
  assert.equal(cookieCalls[0].options.maxAge, 0);
  assert.equal(cookieCalls[0].options.httpOnly, true);
  assert.equal(cookieCalls[0].options.priority, "high");
});

test("login return path accepts only same-origin dashboard paths", async () => {
  const { safeInternalPath } = await loadSafeNavigationModule();
  assert.equal(safeInternalPath("/work?q=network#today"), "/work?q=network#today");
  assert.equal(safeInternalPath("//attacker.example/path"), "/");
  assert.equal(safeInternalPath("/\\attacker.example/path"), "/");
  assert.equal(safeInternalPath("https://attacker.example/path"), "/");
  assert.equal(safeInternalPath("javascript:alert(1)"), "/");
});
