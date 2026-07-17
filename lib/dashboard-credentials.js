import "server-only";
import { randomBytes, scrypt as nodeScrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { verifyDashboardCredentials } from "./auth";
import { supabaseRequest } from "./supabase-rest";

const scrypt = promisify(nodeScrypt);
const CREDENTIALS_TABLE = "dashboard_login_credentials";
const PASSWORD_KEY_LENGTH = 64;

function isMissingCredentialsTable(error) {
  const message = String(error?.message || error || "").toLowerCase();
  return message.includes(CREDENTIALS_TABLE) && (
    message.includes("does not exist") ||
    message.includes("schema cache") ||
    message.includes("could not find")
  );
}

async function derivePasswordHash(password, salt) {
  return Buffer.from(await scrypt(password, salt, PASSWORD_KEY_LENGTH));
}

function safeEqualBuffers(left, right) {
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export async function getStoredDashboardCredentials() {
  try {
    const rows = await supabaseRequest(
      CREDENTIALS_TABLE,
      "id=eq.1&select=username,password_salt,password_hash&limit=1"
    );
    return rows?.[0] || null;
  } catch (error) {
    if (isMissingCredentialsTable(error)) return null;
    throw error;
  }
}

export async function verifyDashboardLoginCredentials(user, password) {
  const stored = await getStoredDashboardCredentials();
  if (!stored) return verifyDashboardCredentials(user, password);
  if (String(user || "").trim() !== String(stored.username || "").trim()) return false;

  try {
    const actual = await derivePasswordHash(String(password || ""), stored.password_salt);
    const expected = Buffer.from(stored.password_hash, "base64url");
    return safeEqualBuffers(actual, expected);
  } catch {
    return false;
  }
}

export async function updateDashboardPassword(user, nextPassword) {
  const salt = randomBytes(16).toString("base64url");
  const passwordHash = (await derivePasswordHash(nextPassword, salt)).toString("base64url");
  const rows = await supabaseRequest(CREDENTIALS_TABLE, "on_conflict=id&select=updated_at", {
    method: "POST",
    prefer: "resolution=merge-duplicates,return=representation",
    body: {
      id: 1,
      username: String(user || "").trim(),
      password_salt: salt,
      password_hash: passwordHash,
      updated_at: new Date().toISOString()
    }
  });
  return rows?.[0] || null;
}
