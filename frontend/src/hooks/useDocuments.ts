import { useState, useEffect, useCallback } from "react";
import type { DocumentInfo } from "../lib/api";
import {
  fetchDocuments,
  uploadDocument as apiUpload,
  deleteDocument as apiDelete,
} from "../lib/api";

export function useDocuments() {
  const [documents, setDocuments] = useState<DocumentInfo[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDocuments = useCallback(async () => {
    try {
      const docs = await fetchDocuments();
      setDocuments(docs);
    } catch {
      setError("Failed to load documents");
    }
  }, []);

  useEffect(() => {
    let active = true;
    fetchDocuments().then((docs) => {
      if (active) setDocuments(docs);
    });
    return () => {
      active = false;
    };
  }, []);

  const upload = useCallback(
    async (file: File) => {
      setUploading(true);
      setError(null);
      try {
        await apiUpload(file);
        await loadDocuments();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed");
      } finally {
        setUploading(false);
      }
    },
    [loadDocuments],
  );

  const remove = useCallback(
    async (filename: string) => {
      try {
        await apiDelete(filename);
        setDocuments((prev) => prev.filter((d) => d.source_filename !== filename));
      } catch {
        setError("Failed to delete document");
      }
    },
    [],
  );

  return { documents, uploading, error, upload, remove, loadDocuments };
}
