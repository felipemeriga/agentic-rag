import { useEffect, useRef } from "react";
import { Box, Typography, Chip, alpha } from "@mui/material";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import MessageBubble from "./MessageBubble";
import ChatInput from "./ChatInput";
import ThinkingBar from "./ThinkingBar";
import type { Message, ChatFilters, StageEvent } from "../lib/api";

interface ChatAreaProps {
  messages: Message[];
  streamingContent: string;
  isStreaming: boolean;
  currentStage: StageEvent | null;
  onSend: (message: string, filters?: ChatFilters) => void;
}

const SUGGESTIONS = [
  "Summarize my documents",
  "What topics are covered?",
  "Search the web for latest news",
  "Show document stats",
];

export default function ChatArea({
  messages,
  streamingContent,
  isStreaming,
  currentStage,
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
                  background: "linear-gradient(135deg, rgba(124,58,237,0.15), rgba(59,130,246,0.15))",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  mb: 1,
                }}
              >
                <AutoAwesomeIcon sx={{ fontSize: 28, color: "#a78bfa" }} />
              </Box>
              <Typography
                variant="h5"
                sx={{
                  fontWeight: 700,
                  background: "linear-gradient(135deg, #7c3aed, #3b82f6)",
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
              <Box
                sx={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 1,
                  mt: 2,
                  justifyContent: "center",
                }}
              >
                {SUGGESTIONS.map((text) => (
                  <Chip
                    key={text}
                    label={text}
                    variant="outlined"
                    onClick={() => onSend(text)}
                    sx={{
                      borderColor: alpha("#7c3aed", 0.3),
                      color: alpha("#ffffff", 0.6),
                      "&:hover": {
                        bgcolor: alpha("#7c3aed", 0.1),
                        borderColor: alpha("#7c3aed", 0.5),
                        color: "#a78bfa",
                      },
                    }}
                  />
                ))}
              </Box>
            </Box>
          )}
          {messages.map((msg) => (
            <MessageBubble key={msg.id} role={msg.role} content={msg.content} />
          ))}
          {isStreaming && currentStage && !streamingContent && (
            <ThinkingBar stage={currentStage} />
          )}
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
