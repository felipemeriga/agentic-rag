import {
  Box,
  List,
  ListItemButton,
  ListItemText,
  IconButton,
  Typography,
  Button,
  Divider,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import LogoutIcon from "@mui/icons-material/Logout";
import { useAuth } from "./AuthProvider";
import { Conversation } from "../lib/api";

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

  return (
    <Box
      sx={{
        width: 280,
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        borderRight: 1,
        borderColor: "divider",
      }}
    >
      <Box sx={{ p: 2 }}>
        <Button
          fullWidth
          variant="outlined"
          startIcon={<AddIcon />}
          onClick={onNew}
        >
          New Chat
        </Button>
      </Box>
      <Divider />
      <List sx={{ flex: 1, overflow: "auto" }}>
        {conversations.map((conv) => (
          <ListItemButton
            key={conv.id}
            selected={conv.id === selectedId}
            onClick={() => onSelect(conv.id)}
          >
            <ListItemText
              primary={conv.title}
              primaryTypographyProps={{ noWrap: true }}
            />
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(conv.id);
              }}
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
          </ListItemButton>
        ))}
      </List>
      <Divider />
      <Box
        sx={{
          p: 2,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Typography variant="body2" noWrap sx={{ flex: 1 }}>
          {user?.email}
        </Typography>
        <IconButton size="small" onClick={signOut}>
          <LogoutIcon fontSize="small" />
        </IconButton>
      </Box>
    </Box>
  );
}
