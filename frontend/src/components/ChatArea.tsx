import { useEffect, useRef } from "react";
import { Box, Typography, alpha } from "@mui/material";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
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
    <Box
      sx={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        height: "100vh",
      }}
    >
      <Box sx={{ flex: 1, overflow: "auto" }}>
        <Box sx={{ py: 3, px: 3 }}>
          {messages.length === 0 && !isStreaming && (
            <Box
              sx={{
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                alignItems: "center",
                height: "60vh",
                gap: 2,
              }}
            >
              <Box
                sx={{
                  width: 56,
                  height: 56,
                  borderRadius: 3,
                  bgcolor: alpha("#6366f1", 0.1),
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  mb: 1,
                }}
              >
                <AutoAwesomeIcon
                  sx={{ fontSize: 28, color: "#6366f1" }}
                />
              </Box>
              <Typography
                variant="h5"
                sx={{
                  fontWeight: 700,
                  background:
                    "linear-gradient(135deg, #6366f1, #818cf8)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                Agentic RAG
              </Typography>
              <Typography
                variant="body2"
                sx={{ color: alpha("#ffffff", 0.4), textAlign: "center" }}
              >
                Ask questions about your documents, query metadata,
                <br />
                or search the web for answers.
              </Typography>
            </Box>
          )}
          {messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              role={msg.role}
              content={msg.content}
            />
          ))}
          {isStreaming && streamingContent && (
            <MessageBubble role="assistant" content={streamingContent} />
          )}
          <div ref={bottomRef} />
        </Box>
      </Box>
      <ChatInput onSend={onSend} disabled={isStreaming} />
    </Box>
  );
}
