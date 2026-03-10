import { useRef } from "react";
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
} from "@mui/material";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import DeleteIcon from "@mui/icons-material/Delete";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { useNavigate } from "react-router-dom";
import { useDocuments } from "../hooks/useDocuments";

export default function DocumentsPage() {
  const { documents, uploading, error, upload, remove } = useDocuments();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await upload(file);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <Box sx={{ maxWidth: 800, mx: "auto", p: 4 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 3 }}>
        <IconButton onClick={() => navigate("/")}>
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h5" sx={{ flex: 1 }}>
          Documents
        </Typography>
        <input
          type="file"
          ref={fileInputRef}
          hidden
          accept=".txt,.md,.text,.markdown"
          onChange={handleFileSelect}
        />
        <Button
          variant="contained"
          startIcon={uploading ? <CircularProgress size={20} /> : <UploadFileIcon />}
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? "Uploading..." : "Upload File"}
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {uploading && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Uploading and processing document. This may take a while due to embedding rate limits...
        </Alert>
      )}

      {documents.length === 0 && !uploading ? (
        <Typography color="text.secondary" sx={{ textAlign: "center", mt: 4 }}>
          No documents uploaded yet. Upload a .txt or .md file to get started.
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
                primary={doc.source_filename}
                secondary={`${doc.chunks} chunks · uploaded ${new Date(doc.created_at).toLocaleDateString()}`}
              />
            </ListItem>
          ))}
        </List>
      )}
    </Box>
  );
}
