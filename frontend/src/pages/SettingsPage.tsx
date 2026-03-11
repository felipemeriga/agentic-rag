import { useState, useEffect, useCallback } from "react";
import {
  Box,
  Typography,
  Button,
  Paper,
  Alert,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  TextField,
  alpha,
  Tooltip,
  Chip,
} from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import KeyIcon from "@mui/icons-material/Key";
import DeleteIcon from "@mui/icons-material/Delete";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { useNavigate } from "react-router-dom";
import {
  fetchApiKey,
  createApiKey,
  revokeApiKey,
  type ApiKeyInfo,
} from "../lib/api";

export default function SettingsPage() {
  const navigate = useNavigate();
  const [keyInfo, setKeyInfo] = useState<ApiKeyInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [revokeOpen, setRevokeOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadKey = useCallback(async () => {
    try {
      setError(null);
      const data = await fetchApiKey();
      setKeyInfo(data);
    } catch {
      setError("Failed to load API key. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadKey();
  }, [loadKey]);

  const handleGenerate = async () => {
    try {
      setError(null);
      const result = await createApiKey("Default");
      setNewKey(result.key);
      setKeyInfo({ name: result.name, created_at: result.created_at });
    } catch {
      setError("Failed to generate API key. Please try again.");
    }
  };

  const handleCopy = async () => {
    if (newKey) {
      await navigator.clipboard.writeText(newKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleRevoke = async () => {
    try {
      setError(null);
      await revokeApiKey();
      setKeyInfo(null);
      setNewKey(null);
      setRevokeOpen(false);
    } catch {
      setError("Failed to revoke API key. Please try again.");
      setRevokeOpen(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        bgcolor: "#0a0a12",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header */}
      <Box
        sx={{
          p: 2,
          display: "flex",
          alignItems: "center",
          gap: 1,
          borderBottom: 1,
          borderColor: "divider",
        }}
      >
        <IconButton onClick={() => navigate("/")} size="small">
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          Settings
        </Typography>
      </Box>

      {/* Content */}
      <Box sx={{ p: 3, maxWidth: 600, mx: "auto", width: "100%" }}>
        <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
          MCP API Key
        </Typography>
        <Typography
          variant="body2"
          sx={{ mb: 3, color: alpha("#ffffff", 0.6) }}
        >
          Generate an API key to connect MCP clients like Claude Code or Cursor
          to your knowledge base. Only one key is active at a time — generating a
          new one replaces the old one.
        </Typography>

        {/* Error alert */}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Existing key info */}
        {keyInfo && !newKey && (
          <Paper
            sx={{
              p: 2,
              mb: 2,
              bgcolor: alpha("#ffffff", 0.03),
              border: 1,
              borderColor: alpha("#ffffff", 0.08),
            }}
          >
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <KeyIcon sx={{ fontSize: 18, color: "#6366f1" }} />
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                  {keyInfo.name}
                </Typography>
                <Chip
                  label="Active"
                  size="small"
                  color="success"
                  sx={{ height: 20, fontSize: "0.7rem" }}
                />
              </Box>
              <Typography
                variant="caption"
                sx={{ color: alpha("#ffffff", 0.4) }}
              >
                Created{" "}
                {new Date(keyInfo.created_at).toLocaleDateString()}
              </Typography>
            </Box>
          </Paper>
        )}

        {/* Newly generated key */}
        {newKey && (
          <Alert
            severity="warning"
            sx={{ mb: 2 }}
            action={
              <Tooltip title={copied ? "Copied!" : "Copy"}>
                <IconButton size="small" onClick={handleCopy}>
                  <ContentCopyIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            }
          >
            <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
              Copy your API key now — it won't be shown again
            </Typography>
            <TextField
              fullWidth
              size="small"
              value={newKey}
              slotProps={{ input: { readOnly: true } }}
              sx={{
                mt: 1,
                "& .MuiInputBase-input": {
                  fontFamily: "monospace",
                  fontSize: "0.8rem",
                },
              }}
            />
          </Alert>
        )}

        {/* Actions */}
        <Box sx={{ display: "flex", gap: 1 }}>
          <Button
            variant="contained"
            startIcon={<KeyIcon />}
            onClick={handleGenerate}
            disabled={loading}
          >
            {keyInfo ? "Regenerate Key" : "Generate API Key"}
          </Button>
          {keyInfo && (
            <Button
              variant="outlined"
              color="error"
              startIcon={<DeleteIcon />}
              onClick={() => setRevokeOpen(true)}
            >
              Revoke
            </Button>
          )}
        </Box>

        {/* MCP connection instructions */}
        <Typography
          variant="h6"
          sx={{ mt: 4, mb: 2, fontWeight: 600 }}
        >
          Connect MCP Client
        </Typography>
        <Typography
          variant="body2"
          sx={{ mb: 2, color: alpha("#ffffff", 0.6) }}
        >
          Add this to your MCP client configuration (e.g.,{" "}
          <code>.mcp.json</code> for Claude Code):
        </Typography>
        <Paper
          sx={{
            p: 2,
            bgcolor: alpha("#000000", 0.3),
            border: 1,
            borderColor: alpha("#ffffff", 0.08),
            fontFamily: "monospace",
            fontSize: "0.8rem",
            whiteSpace: "pre",
            overflow: "auto",
          }}
        >
          {`{
  "mcpServers": {
    "agentic-rag": {
      "type": "sse",
      "url": "http://localhost:8001/sse",
      "headers": {
        "Authorization": "Bearer <your-api-key>"
      }
    }
  }
}`}
        </Paper>

        {/* Revoke confirmation dialog */}
        <Dialog open={revokeOpen} onClose={() => setRevokeOpen(false)}>
          <DialogTitle>Revoke API Key</DialogTitle>
          <DialogContent>
            <DialogContentText>
              This will immediately disconnect any MCP clients using this key.
              You can generate a new key afterward.
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setRevokeOpen(false)}>Cancel</Button>
            <Button onClick={handleRevoke} color="error" variant="contained">
              Revoke
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </Box>
  );
}
