import { useState, useEffect, useCallback } from "react";
import {
  Box,
  Typography,
  IconButton,
  Paper,
  Alert,
  alpha,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import MemoryIcon from "@mui/icons-material/Memory";
import {
  fetchContext,
  fetchRootFolders,
  deleteContextEntry,
  clearAllContext,
  type ContextEntry,
  type Folder,
} from "../lib/api";

function timeUntil(dateStr: string): string {
  const diff = new Date(dateStr).getTime() - Date.now();
  if (diff <= 0) return "expired";
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  if (days > 0) return `${days}d ${hours}h`;
  return `${hours}h`;
}

export default function ContextPage() {
  const [entries, setEntries] = useState<ContextEntry[]>([]);
  const [scopes, setScopes] = useState<Folder[]>([]);
  const [selectedScope, setSelectedScope] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setError(null);
      const [contextData, scopesData] = await Promise.all([
        fetchContext(selectedScope || null),
        fetchRootFolders(),
      ]);
      setEntries(contextData);
      setScopes(scopesData);
    } catch {
      setError("Failed to load context.");
    } finally {
      setLoading(false);
    }
  }, [selectedScope]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      await deleteContextEntry(deleteConfirm);
      setEntries((prev) => prev.filter((e) => e.id !== deleteConfirm));
      setDeleteConfirm(null);
    } catch {
      setError("Failed to delete context entry.");
      setDeleteConfirm(null);
    }
  };

  const getScopeName = (rootFolderId: string | null) => {
    if (!rootFolderId) return "None";
    const scope = scopes.find((s) => s.id === rootFolderId);
    return scope?.name || "Unknown";
  };

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        flex: 1,
        p: 3,
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 3 }}>
        <MemoryIcon sx={{ color: "#7c3aed" }} />
        <Typography variant="h6" sx={{ fontWeight: 600, flex: 1 }}>
          Context
        </Typography>
      </Box>

      <FormControl size="small" sx={{ mb: 3, minWidth: 200 }}>
        <InputLabel>Filter by scope</InputLabel>
        <Select
          value={selectedScope}
          label="Filter by scope"
          onChange={(e) => setSelectedScope(e.target.value)}
        >
          <MenuItem value="">All scopes</MenuItem>
          {scopes.map((s) => (
            <MenuItem key={s.id} value={s.id}>
              {s.name}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {selectedScope && entries.length > 0 && (
        <Button
          variant="outlined"
          color="error"
          size="small"
          sx={{ mb: 2 }}
          onClick={async () => {
            try {
              await clearAllContext(selectedScope);
              setEntries([]);
            } catch {
              setError("Failed to clear context.");
            }
          }}
        >
          Clear all for this scope
        </Button>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {!loading && entries.length === 0 && (
        <Paper
          sx={{
            p: 4,
            textAlign: "center",
            bgcolor: alpha("#ffffff", 0.02),
          }}
        >
          <Typography variant="body2" sx={{ color: alpha("#ffffff", 0.5) }}>
            No active context entries. Context is managed by Claude during MCP
            sessions.
          </Typography>
        </Paper>
      )}

      {entries.length > 0 && (
        <TableContainer
          component={Paper}
          sx={{ bgcolor: alpha("#ffffff", 0.03) }}
        >
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Key</TableCell>
                <TableCell>Value</TableCell>
                <TableCell>Scope</TableCell>
                <TableCell>Expires</TableCell>
                <TableCell width={50} />
              </TableRow>
            </TableHead>
            <TableBody>
              {entries.map((entry) => (
                <TableRow
                  key={entry.id}
                  sx={{ "&:hover": { bgcolor: alpha("#7c3aed", 0.05) } }}
                >
                  <TableCell>
                    <Typography
                      variant="body2"
                      sx={{ fontWeight: 500, fontFamily: "monospace" }}
                    >
                      {entry.key}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography
                      variant="body2"
                      sx={{
                        color: alpha("#ffffff", 0.7),
                        maxWidth: 400,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {entry.value}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={getScopeName(entry.root_folder_id)}
                      size="small"
                      sx={{ height: 20, fontSize: "0.7rem" }}
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption">
                      {timeUntil(entry.expires_at)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <IconButton
                      size="small"
                      onClick={() => setDeleteConfirm(entry.id)}
                      sx={{ opacity: 0.4, "&:hover": { opacity: 1 } }}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)}>
        <DialogTitle>Delete Context Entry</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This context entry will be permanently deleted. Continue?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirm(null)}>Cancel</Button>
          <Button onClick={handleDelete} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
