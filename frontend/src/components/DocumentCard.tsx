import { useState, useCallback } from "react";
import {
  Box,
  Typography,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  List,
  ListItemButton,
  Snackbar,
  alpha,
} from "@mui/material";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import DescriptionIcon from "@mui/icons-material/Description";
import CodeIcon from "@mui/icons-material/Code";
import TextSnippetIcon from "@mui/icons-material/TextSnippet";
import ArticleIcon from "@mui/icons-material/Article";
import DownloadIcon from "@mui/icons-material/Download";
import DeleteIcon from "@mui/icons-material/Delete";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DriveFileMoveIcon from "@mui/icons-material/DriveFileMove";
import FolderIcon from "@mui/icons-material/Folder";
import type { DocumentInfo, Folder } from "../lib/api";
import { fetchFolders } from "../lib/api";

interface DocumentCardProps {
  doc: DocumentInfo;
  onDelete: (filename: string) => void;
  onDownload: (filename: string) => void;
  onMove?: (filename: string, folderId: string | null) => void;
}

const FILE_ICONS: Record<string, { icon: React.ReactNode; color: string }> = {
  pdf: { icon: <PictureAsPdfIcon />, color: "#ef4444" },
  docx: { icon: <DescriptionIcon />, color: "#3b82f6" },
  md: { icon: <ArticleIcon />, color: "#10b981" },
  html: { icon: <CodeIcon />, color: "#f59e0b" },
  txt: { icon: <TextSnippetIcon />, color: alpha("#ffffff", 0.5) },
};

const STATUS_COLORS: Record<string, string> = {
  completed: "#10b981",
  processing: "#7c3aed",
  failed: "#ef4444",
};

function timeAgo(dateStr: string): string {
  const seconds = Math.floor(
    (Date.now() - new Date(dateStr).getTime()) / 1000
  );
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function DocumentCard({
  doc,
  onDelete,
  onDownload,
  onMove,
}: DocumentCardProps) {
  const ext = doc.source_filename.split(".").pop()?.toLowerCase() || "txt";
  const fileStyle = FILE_ICONS[ext] || FILE_ICONS.txt;

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  // Move dialog state
  const [moveOpen, setMoveOpen] = useState(false);
  const [folders, setFolders] = useState<Folder[]>([]);
  // Snackbar for copy feedback
  const [snackOpen, setSnackOpen] = useState(false);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  }, []);

  const closeMenu = () => setContextMenu(null);

  const handleCopy = () => {
    navigator.clipboard.writeText(doc.source_filename);
    setSnackOpen(true);
    closeMenu();
  };

  const handleDownload = () => {
    onDownload(doc.source_filename);
    closeMenu();
  };

  const handleDelete = () => {
    onDelete(doc.source_filename);
    closeMenu();
  };

  const handleMoveOpen = () => {
    closeMenu();
    fetchFolders(null).then(setFolders).catch(() => {});
    setMoveOpen(true);
  };

  const handleMoveSelect = (folderId: string | null) => {
    onMove?.(doc.source_filename, folderId);
    setMoveOpen(false);
  };

  return (
    <>
      <Box
        onContextMenu={handleContextMenu}
        sx={{
          p: 2,
          borderRadius: 3,
          bgcolor: alpha("#1e1e2e", 0.6),
          border: 1,
          borderColor: alpha("#ffffff", 0.06),
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
          transition: "all 0.2s ease",
          position: "relative",
          cursor: "context-menu",
          "&:hover": {
            bgcolor: alpha("#1e1e2e", 0.8),
            borderColor: alpha("#ffffff", 0.1),
            "& .doc-actions": { opacity: 1 },
          },
        }}
      >
        <Box
          className="doc-actions"
          sx={{
            position: "absolute",
            top: 8,
            right: 8,
            display: "flex",
            gap: 0.25,
            opacity: 0,
            transition: "opacity 0.15s",
          }}
        >
          {doc.has_file && (
            <IconButton
              size="small"
              onClick={() => onDownload(doc.source_filename)}
              sx={{ p: 0.5 }}
            >
              <DownloadIcon sx={{ fontSize: 16 }} />
            </IconButton>
          )}
          <IconButton
            size="small"
            onClick={() => onDelete(doc.source_filename)}
            sx={{ p: 0.5 }}
          >
            <DeleteIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Box>
        <Box
          sx={{
            width: 36,
            height: 36,
            borderRadius: 2,
            bgcolor: alpha(fileStyle.color, 0.1),
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            mb: 1.5,
            color: fileStyle.color,
            "& .MuiSvgIcon-root": { fontSize: 20 },
          }}
        >
          {fileStyle.icon}
        </Box>
        <Typography variant="body2" noWrap sx={{ fontWeight: 500, mb: 0.75 }}>
          {doc.source_filename}
        </Typography>
        <Chip
          label={doc.status}
          size="small"
          sx={{
            height: 20,
            fontSize: "0.7rem",
            fontWeight: 500,
            bgcolor: alpha(STATUS_COLORS[doc.status] || "#ffffff", 0.12),
            color: STATUS_COLORS[doc.status] || alpha("#ffffff", 0.5),
            mb: 1,
            ...(doc.status === "processing" && {
              animation: "pulse 1.5s infinite",
              "@keyframes pulse": {
                "0%, 100%": { opacity: 1 },
                "50%": { opacity: 0.5 },
              },
            }),
          }}
        />
        <Typography
          variant="caption"
          sx={{ color: alpha("#ffffff", 0.4), display: "block" }}
        >
          {doc.chunks} chunks · {timeAgo(doc.created_at)}
        </Typography>
      </Box>

      {/* Right-click context menu */}
      <Menu
        open={contextMenu !== null}
        onClose={closeMenu}
        anchorReference="anchorPosition"
        anchorPosition={
          contextMenu ? { top: contextMenu.y, left: contextMenu.x } : undefined
        }
      >
        <MenuItem onClick={handleCopy}>
          <ListItemIcon>
            <ContentCopyIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Copy filename</ListItemText>
        </MenuItem>
        {doc.has_file && (
          <MenuItem onClick={handleDownload}>
            <ListItemIcon>
              <DownloadIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Download</ListItemText>
          </MenuItem>
        )}
        {onMove && (
          <MenuItem onClick={handleMoveOpen}>
            <ListItemIcon>
              <DriveFileMoveIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Move to folder</ListItemText>
          </MenuItem>
        )}
        <MenuItem onClick={handleDelete} sx={{ color: "#ef4444" }}>
          <ListItemIcon>
            <DeleteIcon fontSize="small" sx={{ color: "#ef4444" }} />
          </ListItemIcon>
          <ListItemText>Delete</ListItemText>
        </MenuItem>
      </Menu>

      {/* Move to folder dialog */}
      <Dialog open={moveOpen} onClose={() => setMoveOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Move "{doc.source_filename}"</DialogTitle>
        <DialogContent>
          <List>
            <ListItemButton onClick={() => handleMoveSelect(null)}>
              <ListItemIcon>
                <FolderIcon sx={{ color: alpha("#ffffff", 0.5) }} />
              </ListItemIcon>
              <ListItemText primary="Root (no folder)" />
            </ListItemButton>
            {folders.map((f) => (
              <ListItemButton key={f.id} onClick={() => handleMoveSelect(f.id)}>
                <ListItemIcon>
                  <FolderIcon sx={{ color: "#7c3aed" }} />
                </ListItemIcon>
                <ListItemText primary={f.name} />
              </ListItemButton>
            ))}
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMoveOpen(false)}>Cancel</Button>
        </DialogActions>
      </Dialog>

      {/* Copy feedback */}
      <Snackbar
        open={snackOpen}
        autoHideDuration={2000}
        onClose={() => setSnackOpen(false)}
        message="Filename copied to clipboard"
      />
    </>
  );
}
