import { useState, useRef } from "react";
import { Box } from "@mui/material";
import Sidebar from "../components/Sidebar";
import ChatArea from "../components/ChatArea";
import type { Message, ChatFilters } from "../lib/api";
import { streamChat } from "../lib/api";
import { useConversations } from "../hooks/useConversations";

export default function ChatPage() {
  const {
    conversations,
    selectedId,
    messages,
    setMessages,
    selectConversation,
    loadConversations,
    createConversation,
    removeConversation,
  } = useConversations();

  const [streamingContent, setStreamingContent] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const streamingRef = useRef("");

  const handleSend = async (content: string, filters?: ChatFilters) => {
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
        },
        filters,
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
        onSelect={selectConversation}
        onNew={createConversation}
        onDelete={removeConversation}
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
