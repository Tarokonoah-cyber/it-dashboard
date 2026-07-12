import "server-only";
import { getSupabaseEnv } from "./supabase-rest";

export const KNOWLEDGE_IMAGE_BUCKET = "knowledge-images";

function encodeStoragePath(path) {
  return String(path || "").split("/").map(encodeURIComponent).join("/");
}

async function readStorageJson(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function storageHeaders(extra = {}) {
  const env = getSupabaseEnv();
  return {
    apikey: env.serviceRoleKey,
    Authorization: `Bearer ${env.serviceRoleKey}`,
    ...extra
  };
}

export async function uploadStorageObject(bucket, path, body, contentType) {
  const env = getSupabaseEnv();
  const response = await fetch(`${env.url}/storage/v1/object/${bucket}/${encodeStoragePath(path)}`, {
    method: "POST",
    headers: storageHeaders({
      "Content-Type": contentType,
      "Cache-Control": "private, max-age=0",
      "x-upsert": "false"
    }),
    body,
    cache: "no-store"
  });

  if (!response.ok) {
    const detail = await readStorageJson(response);
    throw new Error(`Storage upload failed: ${detail?.message || JSON.stringify(detail) || response.statusText}`);
  }
  return readStorageJson(response);
}

export async function deleteStorageObjects(bucket, paths) {
  const cleanPaths = Array.from(new Set((paths || []).map((path) => String(path || "").trim()).filter(Boolean)));
  if (!cleanPaths.length) return null;

  const env = getSupabaseEnv();
  const response = await fetch(`${env.url}/storage/v1/object/${bucket}`, {
    method: "DELETE",
    headers: storageHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ prefixes: cleanPaths }),
    cache: "no-store"
  });

  if (!response.ok) {
    const detail = await readStorageJson(response);
    throw new Error(`Storage delete failed: ${detail?.message || JSON.stringify(detail) || response.statusText}`);
  }
  return readStorageJson(response);
}

export async function createSignedStorageUrl(bucket, path, expiresIn = 300) {
  if (!path) return "";
  const env = getSupabaseEnv();
  const response = await fetch(`${env.url}/storage/v1/object/sign/${bucket}/${encodeStoragePath(path)}`, {
    method: "POST",
    headers: storageHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ expiresIn }),
    cache: "no-store"
  });

  if (!response.ok) return "";
  const data = await readStorageJson(response);
  if (!data?.signedURL) return "";
  return data.signedURL.startsWith("http") ? data.signedURL : `${env.url}/storage/v1${data.signedURL}`;
}
