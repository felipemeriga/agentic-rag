import { Box, IconButton, Tooltip, Typography, alpha } from "@mui/material";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import ChatBubbleOutlineIcon from "@mui/icons-material/ChatBubbleOutline";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import StickyNote2Icon from "@mui/icons-material/StickyNote2";
import MemoryIcon from "@mui/icons-material/Memory";
import SettingsIcon from "@mui/icons-material/Settings";

export type AppPage = "/" | "/documents" | "/notes" | "/context" | "/settings";

interface IconRailProps {
  activePage: AppPage;
  onNavigate: (page: AppPage) => void;
  onTogglePanel: () => void;
  userEmail: string | undefined;
  onSignOut: () => void;
}

const NAV_ITEMS: {
  page: AppPage;
  icon: React.ReactNode;
  label: string;
  testId: string;
}[] = [
  {
    page: "/",
    icon: <ChatBubbleOutlineIcon sx={{ fontSize: 20 }} />,
    label: "Chat",
    testId: "nav-chat",
  },
  {
    page: "/documents",
    icon: <FolderOpenIcon sx={{ fontSize: 20 }} />,
    label: "Documents",
    testId: "nav-documents",
  },
  {
    page: "/notes",
    icon: <StickyNote2Icon sx={{ fontSize: 20 }} />,
    label: "Notes",
    testId: "nav-notes",
  },
  {
    page: "/context",
    icon: <MemoryIcon sx={{ fontSize: 20 }} />,
    label: "Context",
    testId: "nav-context",
  },
];

export default function IconRail({
  activePage,
  onNavigate,
  onTogglePanel,
  userEmail,
  onSignOut,
}: IconRailProps) {
  const handleClick = (page: AppPage) => {
    if (page === activePage) {
      onTogglePanel();
    } else {
      onNavigate(page);
    }
  };

  return (
    <Box
      sx={{
        width: 52,
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        py: 1.5,
        gap: 0.5,
        bgcolor: "#0c0c12",
        borderRight: 1,
        borderColor: "divider",
        flexShrink: 0,
      }}
    >
      {/* Logo */}
      <Box
        sx={{
          width: 32,
          height: 32,
          borderRadius: 2,
          background: "linear-gradient(135deg, #7c3aed, #3b82f6)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          mb: 1.5,
        }}
      >
        <AutoAwesomeIcon sx={{ fontSize: 16, color: "#ffffff" }} />
      </Box>

      {/* Navigation */}
      {NAV_ITEMS.map(({ page, icon, label, testId }) => {
        const isActive = page === activePage;
        return (
          <Tooltip key={page} title={label} placement="right">
            <IconButton
              data-testid={testId}
              data-active={isActive}
              onClick={() => handleClick(page)}
              sx={{
                width: 36,
                height: 36,
                borderRadius: 1.5,
                color: isActive ? "#a78bfa" : alpha("#ffffff", 0.4),
                bgcolor: isActive
                  ? alpha("#7c3aed", 0.15)
                  : "transparent",
                "&:hover": {
                  bgcolor: isActive
                    ? alpha("#7c3aed", 0.2)
                    : alpha("#ffffff", 0.05),
                },
              }}
            >
              {icon}
            </IconButton>
          </Tooltip>
        );
      })}

      <Box sx={{ flex: 1 }} />

      {/* Settings */}
      <Tooltip title="Settings" placement="right">
        <IconButton
          data-testid="nav-settings"
          data-active={activePage === "/settings"}
          onClick={() => handleClick("/settings")}
          sx={{
            width: 36,
            height: 36,
            borderRadius: 1.5,
            color:
              activePage === "/settings"
                ? "#a78bfa"
                : alpha("#ffffff", 0.4),
            bgcolor:
              activePage === "/settings"
                ? alpha("#7c3aed", 0.15)
                : "transparent",
            "&:hover": {
              bgcolor: alpha("#ffffff", 0.05),
            },
          }}
        >
          <SettingsIcon sx={{ fontSize: 20 }} />
        </IconButton>
      </Tooltip>

      {/* User Avatar */}
      <Tooltip
        title={
          <Box sx={{ textAlign: "center" }}>
            <Typography variant="caption" display="block">
              {userEmail}
            </Typography>
            <Typography
              variant="caption"
              sx={{
                color: alpha("#ffffff", 0.5),
                cursor: "pointer",
                "&:hover": { color: "#ffffff" },
              }}
              onClick={onSignOut}
            >
              Sign out
            </Typography>
          </Box>
        }
        placement="right"
      >
        <IconButton
          onClick={onSignOut}
          sx={{
            width: 28,
            height: 28,
            mt: 0.5,
            borderRadius: "50%",
            bgcolor: alpha("#7c3aed", 0.2),
            "&:hover": { bgcolor: alpha("#7c3aed", 0.3) },
          }}
        >
          <Typography
            variant="caption"
            sx={{
              fontWeight: 700,
              color: "#a78bfa",
              fontSize: "0.7rem",
            }}
          >
            {userEmail?.charAt(0).toUpperCase() || "?"}
          </Typography>
        </IconButton>
      </Tooltip>
    </Box>
  );
}
