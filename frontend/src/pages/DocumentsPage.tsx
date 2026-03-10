import { useRef, useState, useCallback } from "react";
import {
  Box,
  Typography,
  Button,
  List,
  ListItem,
  ListItemText,
  IconButton,
  Alert,
  CircularProgress,
  Chip,
  alpha,
} from "@mui/material";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import DeleteIcon from "@mui/icons-material/Delete";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { useNavigate } from "react-router-dom";
import { useDocuments } from "../hooks/useDocuments";

const ACCEPTED_TYPES = ".txt,.text,.md,.markdown,.pdf,.docx,.html,.htm";

export default function DocumentsPage() {
  const { documents, uploading, error, upload, remove } = useDocuments();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const [dragOver, setDragOver] = useState(false);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await upload(file);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) {
        await upload(file);
      }
    },
    [upload],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOver(false);
  }, []);

  return (
    <Box sx={{ maxWidth: 800, mx: "auto", p: 4 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 3 }}>
        <IconButton onClick={() => navigate("/")}>
          <ArrowBackIcon />
        </IconButton>
        <Typography
          variant="h5"
          sx={{
            flex: 1,
            fontWeight: 700,
            background: "linear-gradient(135deg, #6366f1, #818cf8)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          Documents
        </Typography>
        <input
          type="file"
          ref={fileInputRef}
          hidden
          accept={ACCEPTED_TYPES}
          onChange={handleFileSelect}
        />
        <Button
          variant="contained"
          startIcon={uploading ? <CircularProgress size={20} /> : <UploadFileIcon />}
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? "Processing..." : "Upload File"}
        </Button>
      </Box>

      <Box
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        sx={{
          border: 2,
          borderStyle: "dashed",
          borderColor: dragOver ? "primary.main" : alpha("#ffffff", 0.1),
          borderRadius: 3,
          p: 4,
          mb: 3,
          textAlign: "center",
          bgcolor: dragOver ? alpha("#6366f1", 0.08) : alpha("#1a1a2e", 0.3),
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          transition: "all 0.2s ease-in-out",
        }}
      >
        <Typography color="text.secondary">
          Drag and drop files here — PDF, DOCX, HTML, Markdown, or text
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {uploading && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Processing document — parsing, chunking, and embedding...
        </Alert>
      )}

      {documents.length === 0 && !uploading ? (
        <Typography color="text.secondary" sx={{ textAlign: "center", mt: 4 }}>
          No documents uploaded yet. Upload a file to get started.
        </Typography>
      ) : (
        <List>
          {documents.map((doc) => (
            <ListItem
              key={doc.source_filename}
              secondaryAction={
                <IconButton edge="end" onClick={() => remove(doc.source_filename)}>
                  <DeleteIcon />
                </IconButton>
              }
            >
              <ListItemText
                primary={
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    {doc.source_filename}
                    {doc.status !== "completed" && (
                      <Chip
                        label={doc.status}
                        size="small"
                        color={doc.status === "processing" ? "info" : "error"}
                      />
                    )}
                  </Box>
                }
                secondary={`${doc.chunks} chunks · uploaded ${new Date(doc.created_at).toLocaleDateString()}`}
              />
            </ListItem>
          ))}
        </List>
      )}
    </Box>
  );
}
