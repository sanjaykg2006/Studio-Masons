"use server";
// Durable document storage for the procurement / finance flows. Files go to a
// PRIVATE Supabase Storage bucket (service-role upload, like uploadAvatar in
// settings/actions.ts, but not public) and only the storage PATH is persisted on
// the record. Reading a document mints a short-lived signed URL on demand, so the
// financial documents are never world-readable.
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth";

const BUCKET = "documents";
const MAX_BYTES = 20 * 1024 * 1024; // 20 MB — comfortably above BOQ/PO/invoice sizes.

// Keeps the original filename as the last path segment (so docName() can show it)
// while stripping anything that isn't storage-key safe.
function safeName(name: string): string {
  const cleaned = name.replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/_+/g, "_");
  return cleaned.slice(-90) || "file";
}

export type UploadResult = { ok: true; path: string; name: string } | { ok: false; error: string };

// Uploads one file and returns its storage path (e.g. "intent-quote/<uuid>/quote.pdf").
// Store the returned `path` on the model; pass it back to getDocumentUrl to download.
export async function uploadDocument(formData: FormData): Promise<UploadResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  const file = formData.get("file");
  const folderRaw = String(formData.get("folder") ?? "misc");
  const folder = folderRaw.replace(/[^a-zA-Z0-9/_-]+/g, "") || "misc";
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "No file provided." };
  if (file.size > MAX_BYTES) return { ok: false, error: "File must be under 20 MB." };

  const admin = createAdminClient();
  // Ensure the bucket exists (private). If it already exists this errors — ignore it.
  await admin.storage.createBucket(BUCKET, { public: false }).catch(() => {});

  const path = `${folder}/${crypto.randomUUID()}/${safeName(file.name)}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const { error } = await admin.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType: file.type || "application/octet-stream", upsert: false });
  if (error) return { ok: false, error: error.message };

  return { ok: true, path, name: file.name };
}

export type UrlResult = { ok: true; url: string } | { ok: false; error: string };

// Mints a signed URL (valid 1 hour) for a stored document path.
export async function getDocumentUrl(path: string): Promise<UrlResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not authenticated." };
  if (!path || !path.includes("/")) return { ok: false, error: "Not a stored document." };

  const admin = createAdminClient();
  const { data, error } = await admin.storage.from(BUCKET).createSignedUrl(path, 3600);
  if (error || !data) return { ok: false, error: error?.message ?? "Couldn't create a download link." };
  return { ok: true, url: data.signedUrl };
}
