import { useState, useEffect, useCallback } from "react";
import type { DocumentInfo } from "../lib/api";
import {
  fetchDocuments,
  deleteDocument as apiDelete,
  moveDocument as apiMove,
} from "../lib/api";

export function useDocuments(folderId?: string | null) {
  const [documents, setDocuments] = useState<DocumentInfo[]>([]);
  const [error, setError] = useState<string | null>(null);

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

  const move = useCallback(
    async (filename: string, targetFolderId: string | null) => {
      try {
        await apiMove(filename, targetFolderId);
        setDocuments((prev) =>
          prev.filter((d) => d.source_filename !== filename)
        );
      } catch {
        setError("Failed to move document");
      }
    },
    []
  );

  const remove = useCallback(async (filename: string) => {
    try {
      await apiDelete(filename);
      setDocuments((prev) =>
        prev.filter((d) => d.source_filename !== filename)
      );
    } catch {
      setError("Failed to delete document");
    }
  }, []);

  return {
    documents,
    error,
    loadDocuments,
    move,
    remove,
  };
}
