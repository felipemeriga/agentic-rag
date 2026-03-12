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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  TextField,
  alpha,
  Chip,
  LinearProgress,
  Paper,
  Badge,
  Tooltip,
  Divider,
} from "@mui/material";
import { keyframes } from "@mui/system";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import DeleteIcon from "@mui/icons-material/Delete";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import CreateNewFolderIcon from "@mui/icons-material/CreateNewFolder";
import InsertDriveFileIcon from "@mui/icons-material/InsertDriveFile";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorIcon from "@mui/icons-material/Error";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import CloseIcon from "@mui/icons-material/Close";
import FolderIcon from "@mui/icons-material/Folder";
import MicIcon from "@mui/icons-material/Mic";
import StopIcon from "@mui/icons-material/Stop";
import { useNavigate } from "react-router-dom";
import { useDocuments } from "../hooks/useDocuments";
import type { UploadTask } from "../hooks/useDocuments";
import { createFolder, fetchFolders, deleteFolder } from "../lib/api";
import FolderTree from "../components/FolderTree";

const ACCEPTED_TYPES = ".txt,.text,.md,.markdown,.pdf,.docx,.html,.htm,.png,.jpg,.jpeg,.mp3,.webm,.m4a";

const pulse = keyframes`
  0% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(1.15); }
  100% { opacity: 1; transform: scale(1); }
`;
const SIDEBAR_WIDTH = 260;

function UploadStatusIcon({ status }: { status: UploadTask["status"] }) {
  switch (status) {
    case "uploading":
    case "processing":
      return null;
    case "done":
      return (
        <CheckCircleIcon fontSize="small" sx={{ color: "success.main" }} />
      );
    case "error":
      return <ErrorIcon fontSize="small" sx={{ color: "error.main" }} />;
    case "duplicate":
      return (
        <ContentCopyIcon fontSize="small" sx={{ color: "warning.main" }} />
      );
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

  // Audio recording
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);

  // Folder navigation
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [folderTreeKey, setFolderTreeKey] = useState(0);

  // Upload dialog
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);

  // Folder drag-over for file grid area
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(
    null,
  );

  // Delete confirmation
  const [deleteConfirm, setDeleteConfirm] = useState<{
    type: "folder" | "document";
    id: string;
    name: string;
  } | null>(null);

  const {
    documents,
    uploads,
    hasActiveUploads,
    error,
    upload: rawUpload,
    move,
    remove,
    clearUploads,
  } = useDocuments(currentFolderId);

  const upload = useCallback(
    (file: File, targetFolderId?: string | null) => {
      setUploadDialogOpen(true);
      return rawUpload(file, targetFolderId);
    },
    [rawUpload],
  );

  // Recording timer
  useEffect(() => {
    if (!isRecording) return;
    const id = setInterval(() => setRecordingTime((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [isRecording]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : undefined;
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : {});
      mediaRecorderRef.current = recorder;

      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: recorder.mimeType });
        const ext = recorder.mimeType.includes("webm") ? "webm" : "mp4";
        const file = new File([blob], `recording-${Date.now()}.${ext}`, {
          type: blob.type,
        });
        upload(file);
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        mediaRecorderRef.current = null;
      };
      recorder.start();
      setRecordingTime(0);
      setIsRecording(true);
    } catch {
      alert("Microphone access denied. Please allow microphone permissions.");
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  };

  const handleMicClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
      .toString()
      .padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

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

  const [subFolders, setSubFolders] = useState<
    { id: string; name: string }[]
  >([]);

  // Load subfolders of current directory for the grid view
  const loadSubFolders = useCallback(() => {
    fetchFolders(currentFolderId)
      .then((data) =>
        setSubFolders(data.map((f) => ({ id: f.id, name: f.name }))),
      )
      .catch(() => {});
  }, [currentFolderId]);

  useEffect(() => {
    loadSubFolders();
  }, [loadSubFolders]);

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    await createFolder(newFolderName.trim(), currentFolderId);
    setNewFolderName("");
    setNewFolderOpen(false);
    setFolderTreeKey((k) => k + 1);
    loadSubFolders();
  };

  const handleRequestDeleteFolder = useCallback(
    (folderId: string, folderName: string) => {
      setDeleteConfirm({ type: "folder", id: folderId, name: folderName });
    },
    [],
  );

  const handleConfirmDelete = async () => {
    if (!deleteConfirm) return;
    if (deleteConfirm.type === "folder") {
      await deleteFolder(deleteConfirm.id);
      if (currentFolderId === deleteConfirm.id) {
        setCurrentFolderId(null);
      }
      setFolderTreeKey((k) => k + 1);
      loadSubFolders();
    } else {
      await remove(deleteConfirm.name);
    }
    setDeleteConfirm(null);
  };

  const isEmpty =
    subFolders.length === 0 && documents.length === 0 && !hasActiveUploads;

  return (
    <Box sx={{ display: "flex", height: "100vh" }}>
      {/* Sidebar */}
      <Box
        sx={{
          width: SIDEBAR_WIDTH,
          flexShrink: 0,
          display: "flex",
          flexDirection: "column",
          borderRight: 1,
          borderColor: "divider",
          bgcolor: alpha("#0d0d15", 0.8),
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
        }}
      >
        {/* Sidebar Header */}
        <Box
          sx={{
            p: 2,
            display: "flex",
            alignItems: "center",
            gap: 1,
          }}
        >
          <IconButton size="small" onClick={() => navigate("/")}>
            <ArrowBackIcon fontSize="small" />
          </IconButton>
          <Typography
            variant="subtitle1"
            sx={{
              fontWeight: 700,
              background: "linear-gradient(135deg, #6366f1, #818cf8)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              flex: 1,
            }}
          >
            Documents
          </Typography>
        </Box>
        <Divider />

        {/* Folder Tree */}
        <Box sx={{ flex: 1, overflow: "auto" }}>
          <FolderTree
            key={folderTreeKey}
            selectedFolderId={currentFolderId}
            onSelectFolder={setCurrentFolderId}
            onRequestDelete={handleRequestDeleteFolder}
          />
        </Box>

        <Divider />
        {/* Sidebar Actions */}
        <Box sx={{ p: 1.5, display: "flex", flexDirection: "column", gap: 1 }}>
          <Button
            fullWidth
            variant="outlined"
            size="small"
            startIcon={<CreateNewFolderIcon />}
            onClick={() => setNewFolderOpen(true)}
          >
            New Folder
          </Button>
        </Box>
      </Box>

      {/* Main Content */}
      <Box sx={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Toolbar */}
        <Box
          sx={{
            px: 3,
            py: 1.5,
            display: "flex",
            alignItems: "center",
            gap: 2,
            borderBottom: 1,
            borderColor: "divider",
            bgcolor: alpha("#0d0d15", 0.4),
          }}
        >
          <Typography variant="subtitle2" sx={{ flex: 1, fontWeight: 600 }}>
            {currentFolderId ? "Folder Contents" : "All Documents"}
          </Typography>
          {uploads.length > 0 && (
            <Tooltip title="Upload progress">
              <IconButton
                size="small"
                onClick={() => setUploadDialogOpen(true)}
              >
                <Badge
                  badgeContent={
                    uploads.filter(
                      (u) =>
                        u.status === "uploading" ||
                        u.status === "processing",
                    ).length || undefined
                  }
                  color="primary"
                >
                  <CloudUploadIcon fontSize="small" />
                </Badge>
              </IconButton>
            </Tooltip>
          )}
          <input
            type="file"
            ref={fileInputRef}
            hidden
            multiple
            accept={ACCEPTED_TYPES}
            onChange={handleFileSelect}
          />
          <Button
            variant="contained"
            size="small"
            startIcon={<UploadFileIcon />}
            onClick={() => fileInputRef.current?.click()}
          >
            Upload
          </Button>
        </Box>

        {/* Content area */}
        <Box sx={{ flex: 1, overflow: "auto", p: 3 }}>
          {/* Drop zone */}
          <Box
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            sx={{
              border: 2,
              borderStyle: "dashed",
              borderColor: dragOver
                ? "primary.main"
                : alpha("#ffffff", 0.08),
              borderRadius: 3,
              p: 2.5,
              mb: 3,
              textAlign: "center",
              bgcolor: dragOver
                ? alpha("#6366f1", 0.08)
                : alpha("#1a1a2e", 0.2),
              transition: "all 0.2s ease-in-out",
              cursor: "pointer",
              "&:hover": {
                borderColor: alpha("#6366f1", 0.3),
                bgcolor: alpha("#6366f1", 0.04),
              },
            }}
            onClick={() => fileInputRef.current?.click()}
          >
            <CloudUploadIcon
              sx={{ fontSize: 32, color: alpha("#6366f1", 0.4), mb: 0.5 }}
            />
            <Typography color="text.secondary" variant="body2">
              Drop files here or click to browse
            </Typography>
            <Typography
              variant="caption"
              sx={{ color: alpha("#ffffff", 0.3) }}
            >
              PDF, DOCX, HTML, Markdown, text, PNG, JPEG, or audio
            </Typography>
            <Box
              sx={{
                mt: 1.5,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 1,
              }}
            >
              <IconButton
                onClick={handleMicClick}
                sx={{
                  bgcolor: isRecording
                    ? alpha("#ef4444", 0.2)
                    : alpha("#6366f1", 0.1),
                  border: `1px solid ${isRecording ? alpha("#ef4444", 0.5) : alpha("#6366f1", 0.25)}`,
                  color: isRecording ? "#ef4444" : alpha("#6366f1", 0.7),
                  "&:hover": {
                    bgcolor: isRecording
                      ? alpha("#ef4444", 0.3)
                      : alpha("#6366f1", 0.2),
                  },
                }}
              >
                {isRecording ? (
                  <StopIcon fontSize="small" />
                ) : (
                  <MicIcon fontSize="small" />
                )}
              </IconButton>
              {isRecording && (
                <Box
                  sx={{ display: "flex", alignItems: "center", gap: 0.75 }}
                >
                  <Box
                    sx={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      bgcolor: "#ef4444",
                      animation: `${pulse} 1.2s ease-in-out infinite`,
                    }}
                  />
                  <Typography
                    variant="caption"
                    sx={{ color: "#ef4444", fontFamily: "monospace" }}
                  >
                    {formatTime(recordingTime)}
                  </Typography>
                </Box>
              )}
            </Box>
          </Box>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          {/* Sub-folders grid */}
          {subFolders.length > 0 && (
            <Box sx={{ mb: 3 }}>
              <Typography
                variant="caption"
                sx={{
                  color: alpha("#ffffff", 0.35),
                  mb: 1,
                  display: "block",
                  letterSpacing: 1.5,
                  textTransform: "uppercase",
                  fontSize: "0.65rem",
                }}
              >
                Folders
              </Typography>
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(auto-fill, minmax(150px, 1fr))",
                  gap: 1.5,
                }}
              >
                {subFolders.map((folder) => (
                  <Paper
                    key={folder.id}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setDragOverFolderId(folder.id);
                    }}
                    onDragLeave={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setDragOverFolderId((prev) =>
                        prev === folder.id ? null : prev,
                      );
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setDragOverFolderId(null);
                      setDragOver(false);
                      const docFilename = e.dataTransfer.getData(
                        "application/x-document-filename",
                      );
                      if (docFilename) {
                        move(docFilename, folder.id);
                        return;
                      }
                      const files = Array.from(e.dataTransfer.files);
                      for (const file of files) {
                        upload(file, folder.id);
                      }
                    }}
                    sx={{
                      p: 1.5,
                      position: "relative",
                      cursor: "pointer",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 0.5,
                      borderRadius: 2.5,
                      overflow: "hidden",
                      bgcolor:
                        dragOverFolderId === folder.id
                          ? alpha("#6366f1", 0.12)
                          : alpha("#1a1a2e", 0.4),
                      border: `1px solid ${
                        dragOverFolderId === folder.id
                          ? alpha("#6366f1", 0.5)
                          : alpha("#ffffff", 0.04)
                      }`,
                      transition: "all 0.15s ease",
                      "&:hover": {
                        transform: "translateY(-1px)",
                        borderColor: alpha("#6366f1", 0.25),
                        boxShadow: `0 4px 16px ${alpha("#6366f1", 0.1)}`,
                        "& .folder-card-delete": { opacity: 1 },
                      },
                    }}
                    onClick={() => setCurrentFolderId(folder.id)}
                  >
                    <IconButton
                      className="folder-card-delete"
                      size="small"
                      sx={{
                        position: "absolute",
                        top: 6,
                        right: 6,
                        opacity: 0,
                        transition: "opacity 0.15s",
                        p: 0.25,
                        bgcolor: alpha("#000000", 0.3),
                        "&:hover": { bgcolor: alpha("#ef4444", 0.3) },
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRequestDeleteFolder(folder.id, folder.name);
                      }}
                    >
                      <DeleteIcon sx={{ fontSize: 14 }} />
                    </IconButton>
                    <FolderIcon sx={{ fontSize: 36, color: "#6366f1" }} />
                    <Typography
                      variant="caption"
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

          {/* Documents list */}
          {documents.length > 0 && (
            <Box>
              <Typography
                variant="caption"
                sx={{
                  color: alpha("#ffffff", 0.35),
                  mb: 1,
                  display: "block",
                  letterSpacing: 1.5,
                  textTransform: "uppercase",
                  fontSize: "0.65rem",
                }}
              >
                Files
              </Typography>
              <List disablePadding>
                {documents.map((doc) => (
                  <ListItem
                    key={doc.source_filename}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData(
                        "application/x-document-filename",
                        doc.source_filename,
                      );
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    sx={{
                      borderRadius: 2,
                      mb: 0.5,
                      py: 0.75,
                      bgcolor: alpha("#1a1a2e", 0.25),
                      border: `1px solid ${alpha("#ffffff", 0.03)}`,
                      cursor: "grab",
                      "&:active": { cursor: "grabbing" },
                      "&:hover": {
                        bgcolor: alpha("#1a1a2e", 0.45),
                        borderColor: alpha("#ffffff", 0.06),
                      },
                      transition: "all 0.15s ease",
                    }}
                    secondaryAction={
                      <IconButton
                        edge="end"
                        onClick={() =>
                          setDeleteConfirm({
                            type: "document",
                            id: doc.source_filename,
                            name: doc.source_filename,
                          })
                        }
                        sx={{
                          opacity: 0.4,
                          "&:hover": { opacity: 1 },
                        }}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    }
                  >
                    <ListItemIcon sx={{ minWidth: 48, gap: 0.5 }}>
                      <DragIndicatorIcon
                        sx={{
                          fontSize: 14,
                          color: alpha("#ffffff", 0.15),
                        }}
                      />
                      <InsertDriveFileIcon
                        sx={{
                          fontSize: 18,
                          color: alpha("#ffffff", 0.35),
                        }}
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
                                doc.status === "processing"
                                  ? "info"
                                  : "error"
                              }
                            />
                          )}
                        </Box>
                      }
                      secondary={
                        <Typography
                          variant="caption"
                          sx={{ color: alpha("#ffffff", 0.3) }}
                        >
                          {doc.chunks} chunks ·{" "}
                          {new Date(doc.created_at).toLocaleDateString()}
                        </Typography>
                      }
                    />
                  </ListItem>
                ))}
              </List>
            </Box>
          )}

          {/* Empty state */}
          {isEmpty && (
            <Box sx={{ textAlign: "center", mt: 8 }}>
              <FolderIcon
                sx={{ fontSize: 56, color: alpha("#ffffff", 0.08), mb: 1.5 }}
              />
              <Typography
                variant="body2"
                sx={{ color: alpha("#ffffff", 0.3) }}
              >
                {currentFolderId
                  ? "This folder is empty"
                  : "No documents yet. Upload files to get started."}
              </Typography>
            </Box>
          )}
        </Box>
      </Box>

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
                      fontSize: 18,
                      color: alpha("#ffffff", 0.35),
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
                    sx={{
                      borderRadius: 1,
                      height: 2,
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
                    sx={{ color: "error.main", pl: 3 }}
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

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteConfirm !== null}
        onClose={() => setDeleteConfirm(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>
          Delete {deleteConfirm?.type === "folder" ? "Folder" : "Document"}
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            {deleteConfirm?.type === "folder"
              ? `Are you sure you want to delete the folder "${deleteConfirm.name}"? All subfolders will be deleted and documents inside will be moved to the root.`
              : `Are you sure you want to delete "${deleteConfirm?.name}"? All chunks associated with this document will be permanently removed.`}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirm(null)}>Cancel</Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleConfirmDelete}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
