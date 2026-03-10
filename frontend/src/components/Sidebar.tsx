import {
  Box,
  List,
  ListItemButton,
  ListItemText,
  ListItemIcon,
  IconButton,
  Typography,
  Button,
  Divider,
  alpha,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import LogoutIcon from "@mui/icons-material/Logout";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import ChatBubbleOutlineIcon from "@mui/icons-material/ChatBubbleOutline";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import type { Conversation } from "../lib/api";

interface SidebarProps {
  conversations: Conversation[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
}

export default function Sidebar({
  conversations,
  selectedId,
  onSelect,
  onNew,
  onDelete,
}: SidebarProps) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <Box
      sx={{
        width: 280,
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        borderRight: 1,
        borderColor: "divider",
        bgcolor: alpha("#0d0d15", 0.8),
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
      }}
    >
      {/* Branding */}
      <Box
        sx={{
          p: 2,
          display: "flex",
          alignItems: "center",
          gap: 1.5,
        }}
      >
        <AutoAwesomeIcon sx={{ color: "#6366f1", fontSize: 22 }} />
        <Typography
          variant="subtitle1"
          sx={{
            fontWeight: 700,
            background: "linear-gradient(135deg, #6366f1, #818cf8)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          Agentic RAG
        </Typography>
      </Box>

      <Box sx={{ px: 1.5, pb: 1 }}>
        <Button
          fullWidth
          variant="contained"
          startIcon={<AddIcon />}
          onClick={onNew}
          size="small"
          sx={{ py: 0.8 }}
        >
          New Chat
        </Button>
      </Box>

      <Divider />

      {/* Navigation */}
      <Box sx={{ px: 0.5, pt: 1 }}>
        <ListItemButton
          onClick={() => navigate("/documents")}
          sx={{
            borderRadius: 1.5,
            py: 0.75,
            mx: 0.5,
            "&:hover": { bgcolor: alpha("#ffffff", 0.04) },
          }}
        >
          <ListItemIcon sx={{ minWidth: 32 }}>
            <FolderOpenIcon sx={{ fontSize: 18, color: alpha("#ffffff", 0.5) }} />
          </ListItemIcon>
          <ListItemText
            primary="Documents"
            primaryTypographyProps={{ variant: "body2" }}
          />
        </ListItemButton>
      </Box>

      <Divider sx={{ mt: 1 }} />

      {/* Conversations label */}
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
        Conversations
      </Typography>

      <List sx={{ flex: 1, overflow: "auto", px: 0.5 }}>
        {conversations.map((conv) => (
          <ListItemButton
            key={conv.id}
            selected={conv.id === selectedId}
            onClick={() => onSelect(conv.id)}
            sx={{
              borderRadius: 1.5,
              mx: 0.5,
              py: 0.6,
              mb: 0.25,
              "&.Mui-selected": {
                bgcolor: alpha("#6366f1", 0.12),
                "&:hover": { bgcolor: alpha("#6366f1", 0.18) },
              },
              "&:hover": {
                bgcolor: alpha("#ffffff", 0.04),
                "& .conv-delete": { opacity: 0.6 },
              },
            }}
          >
            <ListItemIcon sx={{ minWidth: 28 }}>
              <ChatBubbleOutlineIcon
                sx={{ fontSize: 15, color: alpha("#ffffff", 0.3) }}
              />
            </ListItemIcon>
            <ListItemText
              primary={conv.title}
              primaryTypographyProps={{
                noWrap: true,
                variant: "body2",
                sx: {
                  fontWeight: conv.id === selectedId ? 500 : 400,
                },
              }}
            />
            <IconButton
              className="conv-delete"
              size="small"
              sx={{
                opacity: 0,
                transition: "opacity 0.15s",
                p: 0.25,
              }}
              onClick={(e) => {
                e.stopPropagation();
                onDelete(conv.id);
              }}
            >
              <DeleteIcon sx={{ fontSize: 14 }} />
            </IconButton>
          </ListItemButton>
        ))}
      </List>

      <Divider />
      {/* User footer */}
      <Box
        sx={{
          p: 1.5,
          display: "flex",
          alignItems: "center",
          gap: 1,
        }}
      >
        <Box
          sx={{
            width: 28,
            height: 28,
            borderRadius: "50%",
            bgcolor: alpha("#6366f1", 0.2),
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Typography
            variant="caption"
            sx={{ fontWeight: 700, color: "#818cf8", fontSize: "0.7rem" }}
          >
            {user?.email?.charAt(0).toUpperCase()}
          </Typography>
        </Box>
        <Typography
          variant="caption"
          noWrap
          sx={{ flex: 1, color: alpha("#ffffff", 0.5) }}
        >
          {user?.email}
        </Typography>
        <IconButton
          size="small"
          onClick={signOut}
          sx={{ p: 0.5, opacity: 0.5, "&:hover": { opacity: 1 } }}
        >
          <LogoutIcon sx={{ fontSize: 16 }} />
        </IconButton>
      </Box>
    </Box>
  );
}
