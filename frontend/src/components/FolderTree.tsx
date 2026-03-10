import { useState, useEffect, useCallback } from "react";
import {
  Box,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  IconButton,
  Collapse,
  Typography,
  alpha,
} from "@mui/material";
import FolderIcon from "@mui/icons-material/Folder";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import DeleteIcon from "@mui/icons-material/Delete";
import { fetchFolders } from "../lib/api";
import type { Folder } from "../lib/api";

interface FolderTreeNodeProps {
  folder: Folder;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  depth: number;
  onRequestDelete: (folderId: string, folderName: string) => void;
}

function FolderTreeNode({
  folder,
  selectedId,
  onSelect,
  depth,
  onRequestDelete,
}: FolderTreeNodeProps) {
  const [open, setOpen] = useState(false);
  const [children, setChildren] = useState<Folder[]>([]);
  const [loaded, setLoaded] = useState(false);
  const isSelected = selectedId === folder.id;

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!loaded) {
      fetchFolders(folder.id).then((data) => {
        setChildren(data);
        setLoaded(true);
      });
    }
    setOpen(!open);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onRequestDelete(folder.id, folder.name);
  };

  const handleSelect = () => {
    onSelect(folder.id);
    if (!loaded) {
      fetchFolders(folder.id).then((data) => {
        setChildren(data);
        setLoaded(true);
      });
      setOpen(true);
    }
  };

  return (
    <>
      <ListItemButton
        selected={isSelected}
        onClick={handleSelect}
        sx={{
          pl: 1.5 + depth * 2,
          py: 0.5,
          minHeight: 36,
          borderRadius: 1.5,
          mx: 0.5,
          mb: 0.25,
          "&.Mui-selected": {
            bgcolor: alpha("#6366f1", 0.15),
            "&:hover": { bgcolor: alpha("#6366f1", 0.2) },
          },
          "&:hover": {
            bgcolor: alpha("#ffffff", 0.04),
            "& .folder-actions": { opacity: 1 },
          },
        }}
      >
        <IconButton
          size="small"
          onClick={handleToggle}
          sx={{ p: 0.25, mr: 0.5 }}
        >
          {open ? (
            <ExpandMoreIcon sx={{ fontSize: 16, color: alpha("#ffffff", 0.4) }} />
          ) : (
            <ChevronRightIcon sx={{ fontSize: 16, color: alpha("#ffffff", 0.4) }} />
          )}
        </IconButton>
        <ListItemIcon sx={{ minWidth: 28 }}>
          {open ? (
            <FolderOpenIcon sx={{ fontSize: 18, color: "#6366f1" }} />
          ) : (
            <FolderIcon sx={{ fontSize: 18, color: "#6366f1" }} />
          )}
        </ListItemIcon>
        <ListItemText
          primary={folder.name}
          primaryTypographyProps={{
            variant: "body2",
            noWrap: true,
            sx: { fontWeight: isSelected ? 600 : 400 },
          }}
        />
        <IconButton
          className="folder-actions"
          size="small"
          sx={{ opacity: 0, transition: "opacity 0.15s", p: 0.25 }}
          onClick={handleDelete}
        >
          <DeleteIcon sx={{ fontSize: 14 }} />
        </IconButton>
      </ListItemButton>
      <Collapse in={open} timeout="auto">
        {children.map((child) => (
          <FolderTreeNode
            key={child.id}
            folder={child}
            selectedId={selectedId}
            onSelect={onSelect}
            depth={depth + 1}
            onRequestDelete={onRequestDelete}
          />
        ))}
      </Collapse>
    </>
  );
}

interface FolderTreeProps {
  selectedFolderId: string | null;
  onSelectFolder: (id: string | null) => void;
  onRequestDelete: (folderId: string, folderName: string) => void;
}

export default function FolderTree({
  selectedFolderId,
  onSelectFolder,
  onRequestDelete,
}: FolderTreeProps) {
  const [rootFolders, setRootFolders] = useState<Folder[]>([]);

  const loadRoot = useCallback(() => {
    fetchFolders(null).then(setRootFolders).catch(() => {});
  }, []);

  useEffect(() => {
    loadRoot();
  }, [loadRoot]);

  return (
    <Box sx={{ py: 1 }}>
      <ListItemButton
        selected={selectedFolderId === null}
        onClick={() => onSelectFolder(null)}
        sx={{
          py: 0.5,
          minHeight: 36,
          borderRadius: 1.5,
          mx: 0.5,
          mb: 0.25,
          pl: 1.5,
          "&.Mui-selected": {
            bgcolor: alpha("#6366f1", 0.15),
            "&:hover": { bgcolor: alpha("#6366f1", 0.2) },
          },
          "&:hover": { bgcolor: alpha("#ffffff", 0.04) },
        }}
      >
        <ListItemIcon sx={{ minWidth: 28 }}>
          <FolderIcon sx={{ fontSize: 18, color: alpha("#ffffff", 0.5) }} />
        </ListItemIcon>
        <ListItemText
          primary="All Documents"
          primaryTypographyProps={{
            variant: "body2",
            sx: { fontWeight: selectedFolderId === null ? 600 : 400 },
          }}
        />
      </ListItemButton>

      {rootFolders.length > 0 && (
        <Typography
          variant="caption"
          sx={{
            px: 2,
            pt: 1.5,
            pb: 0.5,
            display: "block",
            color: alpha("#ffffff", 0.3),
            letterSpacing: 1,
            textTransform: "uppercase",
            fontSize: "0.65rem",
          }}
        >
          Folders
        </Typography>
      )}

      <List disablePadding dense>
        {rootFolders.map((folder) => (
          <FolderTreeNode
            key={folder.id}
            folder={folder}
            selectedId={selectedFolderId}
            onSelect={onSelectFolder}
            depth={0}
            onRequestDelete={onRequestDelete}
          />
        ))}
      </List>
    </Box>
  );
}
