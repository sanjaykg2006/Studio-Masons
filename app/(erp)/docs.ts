"use client";
// Client-side helpers for durable documents. Pure helpers (docName / isStored /
// docExt) plus thin wrappers over the server actions in documents.ts. A stored
// value is a storage PATH (contains "/"); a legacy value is just a filename.
import { uploadDocument, getDocumentUrl } from "./documents";

// Uploads a File and returns its storage path. Throws on failure so callers can
// surface a toast.
export async function uploadFileToStorage(file: File, folder: string): Promise<string> {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("folder", folder);
  const res = await uploadDocument(fd);
  if (!res.ok) throw new Error(res.error);
  return res.path;
}

// True when the value is a real storage path (vs. a legacy filename-only value).
export function isStored(value?: string | null): boolean {
  return !!value && value.includes("/");
}

// Human-friendly name for display: the last path segment, or the value itself.
export function docName(value?: string | null): string {
  if (!value) return "";
  return value.includes("/") ? value.split("/").pop() || value : value;
}

// Lowercased file extension, for choosing a preview mode.
export function docExt(value?: string | null): string {
  const name = docName(value);
  const i = name.lastIndexOf(".");
  return i === -1 ? "" : name.slice(i + 1).toLowerCase();
}

// Resolves a stored path to a signed URL (valid 1 hour). Throws on failure.
export async function resolveDocumentUrl(path: string): Promise<string> {
  const res = await getDocumentUrl(path);
  if (!res.ok) throw new Error(res.error);
  return res.url;
}

// Opens a stored document in a new tab via a fresh signed URL.
export async function openDocument(path: string): Promise<void> {
  const url = await resolveDocumentUrl(path);
  window.open(url, "_blank", "noopener,noreferrer");
}
