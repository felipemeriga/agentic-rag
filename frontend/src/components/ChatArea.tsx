import { useEffect, useRef } from "react";
import { Box, Typography, alpha } from "@mui/material";
import MessageBubble from "./MessageBubble";
import ChatInput from "./ChatInput";
import type { Message, ChatFilters } from "../lib/api";

interface ChatAreaProps {
  messages: Message[];
  streamingContent: string;
  isStreaming: boolean;
  onSend: (message: string, filters?: ChatFilters) => void;
}

export default function ChatArea({
  messages,
  streamingContent,
  isStreaming,
  onSend,
}: ChatAreaProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  return (
    <Box sx={{ flex: 1, display: "flex", flexDirection: "column", height: "100vh" }}>
      <Box sx={{ flex: 1, overflow: "auto", py: 2 }}>
        {messages.length === 0 && !isStreaming && (
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              alignItems: "center",
              height: "100%",
              gap: 2,
            }}
          >
            <Typography
              variant="h4"
              sx={{
                fontWeight: 700,
                background: "linear-gradient(135deg, #6366f1, #818cf8)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              Agentic RAG
            </Typography>
            <Typography color="text.secondary" sx={{ color: alpha("#ffffff", 0.5) }}>
              Send a message to start the conversation
            </Typography>
          </Box>
        )}
        {messages.map((msg) => (
          <MessageBubble key={msg.id} role={msg.role} content={msg.content} />
        ))}
        {isStreaming && streamingContent && (
          <MessageBubble role="assistant" content={streamingContent} />
        )}
        <div ref={bottomRef} />
      </Box>
      <ChatInput onSend={onSend} disabled={isStreaming} />
    </Box>
  );
}
