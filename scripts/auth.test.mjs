import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
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

function withAuthEnv(values, callback) {
  const names = ["DASHBOARD_LOGIN_USER", "DASHBOARD_LOGIN_PASSWORD", "DASHBOARD_SESSION_SECRET"];
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

test("dashboard auth fails closed when production settings are absent", async () => {
  const auth = await loadAuthModule();
  withAuthEnv({}, () => {
    assert.equal(auth.dashboardAuthConfigured(), false);
    assert.equal(auth.verifyDashboardCredentials("taroko", "123456"), false);
    assert.equal(auth.verifyDashboardSessionCookie("anything"), false);
  });
});

test("dashboard session is signed and expires after eight hours", async () => {
  const auth = await loadAuthModule();
  withAuthEnv({
    DASHBOARD_LOGIN_USER: "admin",
    DASHBOARD_LOGIN_PASSWORD: "a-strong-password",
    DASHBOARD_SESSION_SECRET: "0123456789abcdef0123456789abcdef"
  }, () => {
    const now = Date.parse("2026-07-15T00:00:00.000Z");
    const token = auth.createDashboardSessionToken(now);
    assert.equal(auth.dashboardAuthConfigured(), true);
    assert.equal(auth.verifyDashboardCredentials("admin", "a-strong-password"), true);
    assert.equal(auth.verifyDashboardCredentials("admin", "wrong"), false);
    assert.equal(auth.verifyDashboardSessionCookie(token, now), true);
    assert.equal(
      auth.verifyDashboardSessionCookie(token, now + auth.DASHBOARD_SESSION_TTL_SECONDS * 1000 + 1),
      false
    );
    assert.equal(auth.verifyDashboardSessionCookie(`${token}tampered`, now), false);
  });
});
