import { useState, useEffect } from "react";
import { Box, Typography } from "@mui/material";
import Sidebar from "../components/Sidebar";
import {
  Conversation,
  fetchConversations,
  createConversation,
  deleteConversation,
  fetchConversation,
  Message,
} from "../lib/api";

export default function ChatPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);

  const loadConversations = async (autoSelect = false) => {
    const convs = await fetchConversations();
    setConversations(convs);
    if (autoSelect && convs.length > 0) {
      setSelectedId(convs[0].id);
    }
  };

  useEffect(() => {
    loadConversations(true);
  }, []);

  useEffect(() => {
    if (selectedId) {
      fetchConversation(selectedId).then((conv) => setMessages(conv.messages));
    } else {
      setMessages([]);
    }
  }, [selectedId]);

  const handleNew = async () => {
    const conv = await createConversation();
    setConversations((prev) => [conv, ...prev]);
    setSelectedId(conv.id);
    setMessages([]);
  };

  const handleDelete = async (id: string) => {
    await deleteConversation(id);
    setConversations((prev) => {
      const remaining = prev.filter((c) => c.id !== id);
      if (selectedId === id) {
        setSelectedId(remaining.length > 0 ? remaining[0].id : null);
      }
      return remaining;
    });
  };

  return (
    <Box sx={{ display: "flex", height: "100vh" }}>
      <Sidebar
        conversations={conversations}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onNew={handleNew}
        onDelete={handleDelete}
      />
      <Box
        sx={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {selectedId ? (
          <Typography color="text.secondary">
            {messages.length} messages (chat input coming next)
          </Typography>
        ) : (
          <Typography color="text.secondary">
            Select or create a conversation
          </Typography>
        )}
      </Box>
    </Box>
  );
}
