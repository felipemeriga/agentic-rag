import { useRef, useState, useCallback, useEffect } from "react";
import {
  Box,
  Typography,
  Button,
  List,
  ListItem,
  ListItemText,
  ListItemButton,
  ListItemIcon,
  IconButton,
  Alert,
  CircularProgress,
  Chip,
  Breadcrumbs,
  Link,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  alpha,
} from "@mui/material";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import DeleteIcon from "@mui/icons-material/Delete";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import FolderIcon from "@mui/icons-material/Folder";
import CreateNewFolderIcon from "@mui/icons-material/CreateNewFolder";
import HomeIcon from "@mui/icons-material/Home";
import { useNavigate } from "react-router-dom";
import { useDocuments } from "../hooks/useDocuments";
import {
  fetchFolders,
  createFolder,
  deleteFolder,
  fetchBreadcrumbs,
} from "../lib/api";
import type { Folder, Breadcrumb } from "../lib/api";

const ACCEPTED_TYPES = ".txt,.text,.md,.markdown,.pdf,.docx,.html,.htm";

export default function DocumentsPage() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  // Folder navigation state
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [breadcrumbs, setBreadcrumbs] = useState<Breadcrumb[]>([]);
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");

  const { documents, uploading, error, upload, remove } =
    useDocuments(currentFolderId);

  // Load folders and breadcrumbs whenever currentFolderId changes
  useEffect(() => {
    fetchFolders(currentFolderId).then(setFolders).catch(() => {});
    const loadBreadcrumbs = currentFolderId
      ? fetchBreadcrumbs(currentFolderId)
      : Promise.resolve([]);
    loadBreadcrumbs.then(setBreadcrumbs).catch(() => {});
  }, [currentFolderId]);

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

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    await createFolder(newFolderName.trim(), currentFolderId);
    setNewFolderName("");
    setNewFolderOpen(false);
    fetchFolders(currentFolderId).then(setFolders).catch(() => {});
  };

  const handleDeleteFolder = async (folderId: string) => {
    await deleteFolder(folderId);
    setFolders((prev) => prev.filter((f) => f.id !== folderId));
  };

  const navigateToFolder = (folderId: string | null) => {
    setCurrentFolderId(folderId);
  };

  const isEmpty = folders.length === 0 && documents.length === 0 && !uploading;

  return (
    <Box sx={{ maxWidth: 800, mx: "auto", p: 4 }}>
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 2 }}>
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
          variant="outlined"
          startIcon={<CreateNewFolderIcon />}
          onClick={() => setNewFolderOpen(true)}
        >
          New Folder
        </Button>
        <Button
          variant="contained"
          startIcon={
            uploading ? <CircularProgress size={20} /> : <UploadFileIcon />
          }
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? "Processing..." : "Upload"}
        </Button>
      </Box>

      {/* Breadcrumbs */}
      <Breadcrumbs sx={{ mb: 2, ml: 6 }}>
        <Link
          component="button"
          underline="hover"
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 0.5,
            color: currentFolderId ? "text.secondary" : "primary.main",
            cursor: "pointer",
            fontWeight: currentFolderId ? 400 : 600,
          }}
          onClick={() => navigateToFolder(null)}
        >
          <HomeIcon fontSize="small" />
          Root
        </Link>
        {breadcrumbs.map((bc, index) => {
          const isLast = index === breadcrumbs.length - 1;
          return (
            <Link
              key={bc.id}
              component="button"
              underline="hover"
              sx={{
                color: isLast ? "primary.main" : "text.secondary",
                cursor: "pointer",
                fontWeight: isLast ? 600 : 400,
              }}
              onClick={() => navigateToFolder(bc.id)}
            >
              {bc.name}
            </Link>
          );
        })}
      </Breadcrumbs>

      {/* Drop zone */}
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
          bgcolor: dragOver
            ? alpha("#6366f1", 0.08)
            : alpha("#1a1a2e", 0.3),
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

      {/* Folders */}
      {folders.length > 0 && (
        <List>
          {folders.map((folder) => (
            <ListItem
              key={folder.id}
              disablePadding
              secondaryAction={
                <IconButton
                  edge="end"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteFolder(folder.id);
                  }}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              }
            >
              <ListItemButton onClick={() => navigateToFolder(folder.id)}>
                <ListItemIcon>
                  <FolderIcon sx={{ color: "#6366f1" }} />
                </ListItemIcon>
                <ListItemText primary={folder.name} />
              </ListItemButton>
            </ListItem>
          ))}
        </List>
      )}

      {/* Documents */}
      {documents.length > 0 && (
        <List>
          {documents.map((doc) => (
            <ListItem
              key={doc.source_filename}
              secondaryAction={
                <IconButton
                  edge="end"
                  onClick={() => remove(doc.source_filename)}
                >
                  <DeleteIcon />
                </IconButton>
              }
            >
              <ListItemText
                primary={
                  <Box
                    sx={{ display: "flex", alignItems: "center", gap: 1 }}
                  >
                    {doc.source_filename}
                    {doc.status !== "completed" && (
                      <Chip
                        label={doc.status}
                        size="small"
                        color={
                          doc.status === "processing" ? "info" : "error"
                        }
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

      {/* Empty state */}
      {isEmpty && (
        <Typography
          color="text.secondary"
          sx={{ textAlign: "center", mt: 4 }}
        >
          This folder is empty. Upload files or create subfolders.
        </Typography>
      )}

      {/* New Folder Dialog */}
      <Dialog
        open={newFolderOpen}
        onClose={() => setNewFolderOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>New Folder</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            label="Folder name"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreateFolder();
            }}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNewFolderOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleCreateFolder}
            disabled={!newFolderName.trim()}
          >
            Create
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
