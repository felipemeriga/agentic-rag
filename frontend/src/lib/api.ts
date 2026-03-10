import { supabase } from "./supabase";

export async function getAuthHeaders(): Promise<Record<string, string>> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error("Not authenticated");
  return {
    Authorization: `Bearer ${session.access_token}`,
    "Content-Type": "application/json",
  };
}

export async function apiFetch(path: string, options: RequestInit = {}) {
  const headers = await getAuthHeaders();
  const response = await fetch(path, {
    ...options,
    headers: { ...headers, ...(options.headers as Record<string, string>) },
  });
  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }
  return response;
}

export interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export async function fetchConversations(): Promise<Conversation[]> {
  const res = await apiFetch("/api/conversations");
  return res.json();
}

export async function createConversation(): Promise<Conversation> {
  const res = await apiFetch("/api/conversations", { method: "POST" });
  return res.json();
}

export async function deleteConversation(id: string): Promise<void> {
  await apiFetch(`/api/conversations/${id}`, { method: "DELETE" });
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

export interface ConversationWithMessages extends Conversation {
  messages: Message[];
}

export async function fetchConversation(
  id: string
): Promise<ConversationWithMessages> {
  const res = await apiFetch(`/api/conversations/${id}`);
  return res.json();
}

export async function streamChat(
  conversationId: string,
  content: string,
  onToken: (token: string) => void,
  onDone: () => void
): Promise<void> {
  const headers = await getAuthHeaders();
  const response = await fetch("/api/chat", {
    method: "POST",
    headers,
    body: JSON.stringify({ conversation_id: conversationId, content }),
  });

  if (!response.ok) {
    throw new Error(`Chat error: ${response.status}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error("No response body");

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const data = JSON.parse(line.slice(6));
        if (data.done) {
          onDone();
          return;
        }
        if (data.token) {
          onToken(data.token);
        }
      }
    }
  }
  onDone();
}

export interface DocumentInfo {
  source_filename: string;
  chunks: number;
  status: "processing" | "completed" | "failed";
  created_at: string;
}

export interface UploadResult {
  filename: string;
  duplicate: boolean;
  chunks: number;
  document_ids: string[];
}

export async function fetchDocuments(): Promise<DocumentInfo[]> {
  const res = await apiFetch("/api/documents");
  return res.json();
}

export async function uploadDocument(file: File): Promise<UploadResult> {
  const { Authorization } = await getAuthHeaders();
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch("/api/documents/upload", {
    method: "POST",
    headers: { Authorization },
    body: formData,
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: "Upload failed" }));
    throw new Error(err.detail || `Upload error: ${response.status}`);
  }
  return response.json();
}

export async function deleteDocument(filename: string): Promise<void> {
  await apiFetch(`/api/documents/${encodeURIComponent(filename)}`, {
    method: "DELETE",
  });
}
