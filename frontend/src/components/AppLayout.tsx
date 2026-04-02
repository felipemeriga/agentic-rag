import { useState, useEffect } from "react";
import { Box } from "@mui/material";
import { useNavigate, useLocation } from "react-router-dom";
import IconRail, { type AppPage } from "./IconRail";
import ContextPanel from "./ContextPanel";
import { useAuth } from "../hooks/useAuth";
import { useConversations } from "../hooks/useConversations";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signOut } = useAuth();
  const {
    conversations,
    selectedId,
    selectConversation,
    createConversation,
    removeConversation,
  } = useConversations();

  const [panelOpen, setPanelOpen] = useState(() => {
    const saved = localStorage.getItem("panelOpen");
    return saved !== null ? saved === "true" : true;
  });

  useEffect(() => {
    localStorage.setItem("panelOpen", String(panelOpen));
  }, [panelOpen]);

  const activePage = (location.pathname as AppPage) || "/";

  // Settings page has no panel
  const showPanel = panelOpen && activePage !== "/settings";

  return (
    <Box sx={{ display: "flex", height: "100vh" }}>
      <IconRail
        activePage={activePage}
        panelOpen={panelOpen}
        onNavigate={(page) => navigate(page)}
        onTogglePanel={() => setPanelOpen((prev) => !prev)}
        userEmail={user?.email}
        onSignOut={signOut}
      />
      <ContextPanel
        activePage={activePage}
        open={showPanel}
        conversations={conversations}
        selectedConversationId={selectedId}
        onSelectConversation={selectConversation}
        onNewConversation={createConversation}
        onDeleteConversation={removeConversation}
      />
      <Box sx={{ flex: 1, overflow: "hidden" }}>{children}</Box>
    </Box>
  );
}
