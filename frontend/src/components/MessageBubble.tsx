import { Box, Paper, Typography, alpha } from "@mui/material";
import ReactMarkdown from "react-markdown";

interface MessageBubbleProps {
  role: "user" | "assistant";
  content: string;
}

export default function MessageBubble({ role, content }: MessageBubbleProps) {
  const isUser = role === "user";

  return (
    <Box
      sx={{
        display: "flex",
        justifyContent: isUser ? "flex-end" : "flex-start",
        mb: 2,
      }}
    >
      <Paper
        elevation={0}
        sx={{
          p: 2,
          maxWidth: isUser ? "70%" : "85%",
          bgcolor: isUser
            ? alpha("#6366f1", 0.2)
            : alpha("#1a1a2e", 0.6),
          border: 1,
          borderColor: isUser
            ? alpha("#6366f1", 0.3)
            : alpha("#ffffff", 0.06),
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
          borderRadius: 3,
        }}
      >
        {isUser ? (
          <Typography>{content}</Typography>
        ) : (
          <Box
            sx={{
              "& p": { m: 0 },
              "& pre": {
                overflow: "auto",
                bgcolor: alpha("#000000", 0.3),
                p: 1.5,
                borderRadius: 2,
              },
              "& code": {
                fontSize: "0.85rem",
              },
            }}
          >
            <ReactMarkdown>{content}</ReactMarkdown>
          </Box>
        )}
      </Paper>
    </Box>
  );
}
