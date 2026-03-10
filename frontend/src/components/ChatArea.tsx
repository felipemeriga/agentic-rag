import { useEffect, useRef } from "react";
import { Box, Typography } from "@mui/material";
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
              justifyContent: "center",
              alignItems: "center",
              height: "100%",
            }}
          >
            <Typography color="text.secondary">
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
