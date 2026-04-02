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
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import NoteIcon from "@mui/icons-material/StickyNote2";
import {
  fetchNotes,
  fetchRootFolders,
  deleteNote,
  type Note,
  type Folder,
} from "../lib/api";

export default function NotesPage() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [scopes, setScopes] = useState<Folder[]>([]);
  const [selectedScope, setSelectedScope] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setError(null);
      const [notesData, scopesData] = await Promise.all([
        fetchNotes(selectedScope || null),
        fetchRootFolders(),
      ]);
      setNotes(notesData);
      setScopes(scopesData);
    } catch {
      setError("Failed to load notes.");
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
      await deleteNote(deleteConfirm);
      setNotes((prev) => prev.filter((n) => n.id !== deleteConfirm));
      setDeleteConfirm(null);
    } catch {
      setError("Failed to delete note.");
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
        <NoteIcon sx={{ color: "#7c3aed" }} />
        <Typography variant="h6" sx={{ fontWeight: 600, flex: 1 }}>
          Notes
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

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {!loading && notes.length === 0 && (
        <Paper
          sx={{
            p: 4,
            textAlign: "center",
            bgcolor: alpha("#ffffff", 0.02),
          }}
        >
          <Typography variant="body2" sx={{ color: alpha("#ffffff", 0.5) }}>
            No notes yet. Notes are created by Claude during MCP sessions.
          </Typography>
        </Paper>
      )}

      {notes.map((note) => (
        <Accordion
          key={note.id}
          sx={{
            bgcolor: alpha("#ffffff", 0.03),
            mb: 1,
            "&:before": { display: "none" },
          }}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1,
                flex: 1,
                mr: 1,
              }}
            >
              <Typography variant="body2" sx={{ fontWeight: 500, flex: 1 }}>
                {note.title}
              </Typography>
              <Chip
                label={getScopeName(note.root_folder_id)}
                size="small"
                sx={{ height: 20, fontSize: "0.7rem" }}
              />
              <Typography
                variant="caption"
                sx={{ color: alpha("#ffffff", 0.4) }}
              >
                {new Date(note.created_at).toLocaleDateString()}
              </Typography>
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  setDeleteConfirm(note.id);
                }}
                sx={{ opacity: 0.4, "&:hover": { opacity: 1 } }}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <Typography
              variant="body2"
              sx={{ color: alpha("#ffffff", 0.7), whiteSpace: "pre-wrap" }}
            >
              {note.content}
            </Typography>
          </AccordionDetails>
        </Accordion>
      ))}

      <Dialog open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)}>
        <DialogTitle>Delete Note</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This note will be permanently deleted. Continue?
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
