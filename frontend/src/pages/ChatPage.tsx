import { useState, useEffect, useRef } from "react";
import { Box } from "@mui/material";
import Sidebar from "../components/Sidebar";
import ChatArea from "../components/ChatArea";
import type { Conversation, Message } from "../lib/api";
import {
  fetchConversations,
  createConversation,
  deleteConversation,
  fetchConversation,
  streamChat,
} from "../lib/api";

export default function ChatPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [streamingContent, setStreamingContent] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const streamingRef = useRef("");

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

  const handleSend = async (content: string) => {
    if (!selectedId || isStreaming) return;

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsStreaming(true);
    setStreamingContent("");
    streamingRef.current = "";

    try {
      await streamChat(
        selectedId,
        content,
        (token) => {
          streamingRef.current += token;
          setStreamingContent(streamingRef.current);
        },
        () => {
          const assistantMsg: Message = {
            id: crypto.randomUUID(),
            role: "assistant",
            content: streamingRef.current,
            created_at: new Date().toISOString(),
          };
          setMessages((msgs) => [...msgs, assistantMsg]);
          setStreamingContent("");
          streamingRef.current = "";
          setIsStreaming(false);
          loadConversations();
        }
      );
    } catch {
      setIsStreaming(false);
      setStreamingContent("");
      streamingRef.current = "";
    }
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
      <ChatArea
        messages={messages}
        streamingContent={streamingContent}
        isStreaming={isStreaming}
        onSend={handleSend}
      />
    </Box>
  );
}
