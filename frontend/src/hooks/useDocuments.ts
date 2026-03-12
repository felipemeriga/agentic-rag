import { useState, useEffect, useCallback } from "react";
import type { DocumentInfo } from "../lib/api";
import {
  fetchDocuments,
  uploadDocument as apiUpload,
  deleteDocument as apiDelete,
  moveDocument as apiMove,
} from "../lib/api";

export interface UploadTask {
  id: string;
  filename: string;
  status: "uploading" | "processing" | "done" | "error" | "duplicate";
  chunks?: number;
  errorMessage?: string;
}

export function useDocuments(folderId?: string | null) {
  const [documents, setDocuments] = useState<DocumentInfo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [uploads, setUploads] = useState<UploadTask[]>([]);

  const hasActiveUploads = uploads.some(
    (u) => u.status === "uploading" || u.status === "processing",
  );

  const loadDocuments = useCallback(async () => {
    try {
      const docs = await fetchDocuments(folderId);
      setDocuments(docs);
    } catch {
      setError("Failed to load documents");
    }
  }, [folderId]);

  useEffect(() => {
    let active = true;
    fetchDocuments(folderId).then((docs) => {
      if (active) setDocuments(docs);
    });
    return () => {
      active = false;
    };
  }, [folderId]);

  // Auto-refresh document list while uploads are active
  useEffect(() => {
    if (!hasActiveUploads) return;
    const interval = setInterval(() => {
      fetchDocuments(folderId).then(setDocuments).catch(() => {});
    }, 3000);
    return () => clearInterval(interval);
  }, [hasActiveUploads, folderId]);

  const upload = useCallback(
    async (file: File, targetFolderId?: string | null) => {
      const uploadToFolder = targetFolderId ?? folderId;
      const taskId = crypto.randomUUID();
      const task: UploadTask = {
        id: taskId,
        filename: file.name,
        status: "uploading",
      };
      setUploads((prev) => [...prev, task]);
      setError(null);

      try {
        setUploads((prev) =>
          prev.map((u) =>
            u.id === taskId ? { ...u, status: "processing" } : u,
          ),
        );
        const result = await apiUpload(file, uploadToFolder);

        if (result.duplicate) {
          setUploads((prev) =>
            prev.map((u) =>
              u.id === taskId ? { ...u, status: "duplicate" } : u,
            ),
          );
        } else {
          setUploads((prev) =>
            prev.map((u) =>
              u.id === taskId
                ? { ...u, status: "done", chunks: result.chunks }
                : u,
            ),
          );
        }
        await loadDocuments();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Upload failed";
        setUploads((prev) =>
          prev.map((u) =>
            u.id === taskId
              ? { ...u, status: "error", errorMessage: msg }
              : u,
          ),
        );
        // Refresh list anyway — backend may have succeeded despite timeout
        await loadDocuments();
      }
    },
    [folderId, loadDocuments],
  );

  const clearUploads = useCallback(() => {
    setUploads((prev) =>
      prev.filter(
        (u) => u.status === "uploading" || u.status === "processing",
      ),
    );
  }, []);

  const move = useCallback(
    async (filename: string, targetFolderId: string | null) => {
      try {
        await apiMove(filename, targetFolderId);
        setDocuments((prev) =>
          prev.filter((d) => d.source_filename !== filename),
        );
      } catch {
        setError("Failed to move document");
      }
    },
    [],
  );

  const remove = useCallback(async (filename: string) => {
    try {
      await apiDelete(filename);
      setDocuments((prev) =>
        prev.filter((d) => d.source_filename !== filename),
      );
    } catch {
      setError("Failed to delete document");
    }
  }, []);

  return {
    documents,
    uploads,
    hasActiveUploads,
    error,
    upload,
    move,
    remove,
    loadDocuments,
    clearUploads,
  };
}
