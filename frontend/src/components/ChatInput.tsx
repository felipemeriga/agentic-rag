import { useState, useRef } from "react";
import { Box, TextField, IconButton, CircularProgress, Chip } from "@mui/material";
import SendIcon from "@mui/icons-material/Send";
import AttachFileIcon from "@mui/icons-material/AttachFile";
import { uploadDocument } from "../lib/api";

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled: boolean;
}

export default function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [input, setInput] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setInput("");
    setUploadedFile(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      await uploadDocument(file);
      setUploadedFile(file.name);
    } catch {
      // Error handled silently — user sees no chip appear
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <Box sx={{ p: 2, borderTop: 1, borderColor: "divider" }}>
      {uploadedFile && (
        <Chip
          label={`Uploaded: ${uploadedFile}`}
          size="small"
          onDelete={() => setUploadedFile(null)}
          sx={{ mb: 1 }}
        />
      )}
      <Box sx={{ display: "flex", gap: 1 }}>
        <input
          type="file"
          ref={fileInputRef}
          hidden
          accept=".txt,.md,.text,.markdown"
          onChange={handleFileSelect}
        />
        <IconButton
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || uploading}
        >
          {uploading ? <CircularProgress size={20} /> : <AttachFileIcon />}
        </IconButton>
        <TextField
          fullWidth
          multiline
          maxRows={4}
          placeholder="Type a message..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          size="small"
        />
        <IconButton
          color="primary"
          onClick={handleSend}
          disabled={disabled || !input.trim()}
        >
          <SendIcon />
        </IconButton>
      </Box>
    </Box>
  );
}
