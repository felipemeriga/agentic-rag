import { useRef, useState, useCallback, useEffect } from "react";
import {
  Box,
  Typography,
  Button,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  IconButton,
  Alert,
  Breadcrumbs,
  Link,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  alpha,
  Chip,
  LinearProgress,
  Paper,
  Badge,
  Tooltip,
} from "@mui/material";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import DeleteIcon from "@mui/icons-material/Delete";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import FolderIcon from "@mui/icons-material/Folder";
import CreateNewFolderIcon from "@mui/icons-material/CreateNewFolder";
import HomeIcon from "@mui/icons-material/Home";
import InsertDriveFileIcon from "@mui/icons-material/InsertDriveFile";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorIcon from "@mui/icons-material/Error";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import CloseIcon from "@mui/icons-material/Close";
import { useNavigate } from "react-router-dom";
import { useDocuments } from "../hooks/useDocuments";
import type { UploadTask } from "../hooks/useDocuments";
import {
  fetchFolders,
  createFolder,
  deleteFolder,
  fetchBreadcrumbs,
} from "../lib/api";
import type { Folder, Breadcrumb } from "../lib/api";

const ACCEPTED_TYPES = ".txt,.text,.md,.markdown,.pdf,.docx,.html,.htm";

function UploadStatusIcon({ status }: { status: UploadTask["status"] }) {
  switch (status) {
    case "uploading":
    case "processing":
      return null;
    case "done":
      return <CheckCircleIcon fontSize="small" sx={{ color: "success.main" }} />;
    case "error":
      return <ErrorIcon fontSize="small" sx={{ color: "error.main" }} />;
    case "duplicate":
      return <ContentCopyIcon fontSize="small" sx={{ color: "warning.main" }} />;
  }
}

function statusLabel(status: UploadTask["status"]): string {
  switch (status) {
    case "uploading":
      return "Uploading...";
    case "processing":
      return "Parsing, chunking & embedding...";
    case "done":
      return "Completed";
    case "error":
      return "Failed";
    case "duplicate":
      return "Duplicate";
  }
}

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

  // Upload dialog
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);

  const {
    documents,
    uploads,
    hasActiveUploads,
    error,
    upload: rawUpload,
    remove,
    clearUploads,
  } = useDocuments(currentFolderId);

  // Wrap upload to auto-open the dialog
  const upload = useCallback(
    (file: File) => {
      setUploadDialogOpen(true);
      return rawUpload(file);
    },
    [rawUpload],
  );

  // Load folders and breadcrumbs whenever currentFolderId changes
  useEffect(() => {
    fetchFolders(currentFolderId).then(setFolders).catch(() => {});
    const loadBreadcrumbs = currentFolderId
      ? fetchBreadcrumbs(currentFolderId)
      : Promise.resolve([]);
    loadBreadcrumbs.then(setBreadcrumbs).catch(() => {});
  }, [currentFolderId]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    for (const file of Array.from(files)) {
      upload(file);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const files = Array.from(e.dataTransfer.files);
      for (const file of files) {
        upload(file);
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

  const handleDeleteFolder = async (
    e: React.MouseEvent,
    folderId: string,
  ) => {
    e.stopPropagation();
    await deleteFolder(folderId);
    setFolders((prev) => prev.filter((f) => f.id !== folderId));
  };

  const navigateToFolder = (folderId: string | null) => {
    setCurrentFolderId(folderId);
  };

  const isEmpty =
    folders.length === 0 && documents.length === 0 && !hasActiveUploads;

  return (
    <Box sx={{ maxWidth: 900, mx: "auto", p: 4 }}>
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
          multiple
          accept={ACCEPTED_TYPES}
          onChange={handleFileSelect}
        />
        {uploads.length > 0 && (
          <Tooltip title="Upload progress">
            <IconButton onClick={() => setUploadDialogOpen(true)}>
              <Badge
                badgeContent={
                  uploads.filter(
                    (u) =>
                      u.status === "uploading" || u.status === "processing",
                  ).length || undefined
                }
                color="primary"
              >
                <CloudUploadIcon />
              </Badge>
            </IconButton>
          </Tooltip>
        )}
        <Button
          variant="outlined"
          startIcon={<CreateNewFolderIcon />}
          onClick={() => setNewFolderOpen(true)}
          size="small"
        >
          New Folder
        </Button>
        <Button
          variant="contained"
          startIcon={<UploadFileIcon />}
          onClick={() => fileInputRef.current?.click()}
          size="small"
        >
          Upload
        </Button>
      </Box>

      {/* Breadcrumbs */}
      <Breadcrumbs sx={{ mb: 3, ml: 6 }}>
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
          My Documents
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
          p: 3,
          mb: 3,
          textAlign: "center",
          bgcolor: dragOver
            ? alpha("#6366f1", 0.08)
            : alpha("#1a1a2e", 0.3),
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          transition: "all 0.2s ease-in-out",
          cursor: "pointer",
          "&:hover": {
            borderColor: alpha("#6366f1", 0.4),
            bgcolor: alpha("#6366f1", 0.04),
          },
        }}
        onClick={() => fileInputRef.current?.click()}
      >
        <CloudUploadIcon
          sx={{ fontSize: 40, color: alpha("#6366f1", 0.5), mb: 1 }}
        />
        <Typography color="text.secondary" variant="body2">
          Drag and drop files here, or click to browse
        </Typography>
        <Typography
          color="text.secondary"
          variant="caption"
          sx={{ mt: 0.5, display: "block" }}
        >
          PDF, DOCX, HTML, Markdown, or text
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Folders — Grid */}
      {folders.length > 0 && (
        <Box sx={{ mb: 3 }}>
          <Typography
            variant="overline"
            sx={{
              color: alpha("#ffffff", 0.4),
              mb: 1,
              display: "block",
              letterSpacing: 1.5,
            }}
          >
            Folders
          </Typography>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
              gap: 2,
            }}
          >
            {folders.map((folder) => (
              <Paper
                key={folder.id}
                sx={{
                  p: 2,
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 1,
                  borderRadius: 3,
                  bgcolor: alpha("#1a1a2e", 0.5),
                  border: `1px solid ${alpha("#ffffff", 0.06)}`,
                  transition:
                    "transform 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease",
                  "&:hover": {
                    transform: "translateY(-2px)",
                    borderColor: alpha("#6366f1", 0.3),
                    boxShadow: `0 4px 20px ${alpha("#6366f1", 0.15)}`,
                    "& .folder-delete": { opacity: 0.6 },
                  },
                  position: "relative",
                  overflow: "hidden",
                }}
                onClick={() => navigateToFolder(folder.id)}
              >
                <IconButton
                  className="folder-delete"
                  size="small"
                  sx={{
                    position: "absolute",
                    top: 10,
                    right: 10,
                    opacity: 0,
                    transition: "opacity 0.15s ease",
                    bgcolor: alpha("#000000", 0.3),
                    "&:hover": { opacity: 1, bgcolor: alpha("#ef4444", 0.2) },
                    p: 0.5,
                  }}
                  onClick={(e) => handleDeleteFolder(e, folder.id)}
                >
                  <DeleteIcon sx={{ fontSize: 14 }} />
                </IconButton>
                <FolderIcon sx={{ fontSize: 48, color: "#6366f1" }} />
                <Typography
                  variant="body2"
                  noWrap
                  sx={{
                    maxWidth: "100%",
                    fontWeight: 500,
                    textAlign: "center",
                  }}
                >
                  {folder.name}
                </Typography>
              </Paper>
            ))}
          </Box>
        </Box>
      )}

      {/* Documents — List */}
      {documents.length > 0 && (
        <Box>
          <Typography
            variant="overline"
            sx={{
              color: alpha("#ffffff", 0.4),
              mb: 1,
              display: "block",
              letterSpacing: 1.5,
            }}
          >
            Files
          </Typography>
          <List disablePadding>
            {documents.map((doc) => (
              <ListItem
                key={doc.source_filename}
                sx={{
                  borderRadius: 2,
                  mb: 0.5,
                  bgcolor: alpha("#1a1a2e", 0.3),
                  border: `1px solid ${alpha("#ffffff", 0.04)}`,
                  "&:hover": {
                    bgcolor: alpha("#1a1a2e", 0.5),
                    borderColor: alpha("#ffffff", 0.08),
                  },
                  transition: "all 0.15s ease",
                }}
                secondaryAction={
                  <IconButton
                    edge="end"
                    onClick={() => remove(doc.source_filename)}
                    sx={{ opacity: 0.5, "&:hover": { opacity: 1 } }}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                }
              >
                <ListItemIcon sx={{ minWidth: 40 }}>
                  <InsertDriveFileIcon
                    sx={{ color: alpha("#ffffff", 0.4) }}
                  />
                </ListItemIcon>
                <ListItemText
                  primary={
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 1,
                      }}
                    >
                      <Typography variant="body2" noWrap>
                        {doc.source_filename}
                      </Typography>
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
                  secondary={`${doc.chunks} chunks · ${new Date(doc.created_at).toLocaleDateString()}`}
                />
              </ListItem>
            ))}
          </List>
        </Box>
      )}

      {/* Empty state */}
      {isEmpty && (
        <Box sx={{ textAlign: "center", mt: 6 }}>
          <FolderIcon
            sx={{ fontSize: 64, color: alpha("#ffffff", 0.1), mb: 2 }}
          />
          <Typography color="text.secondary">
            This folder is empty. Upload files or create subfolders.
          </Typography>
        </Box>
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

      {/* Upload Progress Dialog */}
      <Dialog
        open={uploadDialogOpen && uploads.length > 0}
        onClose={
          hasActiveUploads
            ? undefined
            : () => {
                setUploadDialogOpen(false);
                clearUploads();
              }
        }
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            bgcolor: alpha("#12121a", 0.95),
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
          },
        }}
      >
        <DialogTitle
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <CloudUploadIcon sx={{ color: "primary.main" }} />
            <Typography variant="h6">
              Uploads
              {hasActiveUploads && (
                <Typography
                  component="span"
                  variant="body2"
                  sx={{ ml: 1, color: "text.secondary" }}
                >
                  (
                  {
                    uploads.filter(
                      (u) =>
                        u.status === "uploading" ||
                        u.status === "processing",
                    ).length
                  }{" "}
                  in progress)
                </Typography>
              )}
            </Typography>
          </Box>
          {!hasActiveUploads && (
            <IconButton
              size="small"
              onClick={() => {
                setUploadDialogOpen(false);
                clearUploads();
              }}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          )}
        </DialogTitle>
        <DialogContent dividers>
          <List disablePadding>
            {uploads.map((task) => (
              <ListItem
                key={task.id}
                sx={{
                  px: 0,
                  flexDirection: "column",
                  alignItems: "stretch",
                  gap: 0.5,
                }}
              >
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                    width: "100%",
                  }}
                >
                  <InsertDriveFileIcon
                    sx={{
                      fontSize: 20,
                      color: alpha("#ffffff", 0.4),
                      flexShrink: 0,
                    }}
                  />
                  <Typography
                    variant="body2"
                    noWrap
                    sx={{ flex: 1, fontWeight: 500 }}
                  >
                    {task.filename}
                  </Typography>
                  <UploadStatusIcon status={task.status} />
                  <Typography
                    variant="caption"
                    sx={{
                      color:
                        task.status === "error"
                          ? "error.main"
                          : task.status === "done"
                            ? "success.main"
                            : task.status === "duplicate"
                              ? "warning.main"
                              : "text.secondary",
                      flexShrink: 0,
                    }}
                  >
                    {statusLabel(task.status)}
                    {task.status === "done" && task.chunks
                      ? ` · ${task.chunks} chunks`
                      : ""}
                  </Typography>
                </Box>
                {(task.status === "uploading" ||
                  task.status === "processing") && (
                  <LinearProgress
                    variant={
                      task.status === "uploading"
                        ? "indeterminate"
                        : "indeterminate"
                    }
                    sx={{
                      borderRadius: 1,
                      height: 3,
                      bgcolor: alpha("#6366f1", 0.1),
                      "& .MuiLinearProgress-bar": {
                        bgcolor: "primary.main",
                      },
                    }}
                  />
                )}
                {task.status === "error" && task.errorMessage && (
                  <Typography
                    variant="caption"
                    sx={{ color: "error.main", pl: 3.5 }}
                  >
                    {task.errorMessage}
                  </Typography>
                )}
              </ListItem>
            ))}
          </List>
        </DialogContent>
        {!hasActiveUploads && (
          <DialogActions>
            <Button
              onClick={() => {
                setUploadDialogOpen(false);
                clearUploads();
              }}
            >
              Close
            </Button>
          </DialogActions>
        )}
      </Dialog>
    </Box>
  );
}
