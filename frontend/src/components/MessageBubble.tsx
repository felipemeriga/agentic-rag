import { Box, Paper, Typography } from "@mui/material";
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
        px: 2,
      }}
    >
      <Paper
        elevation={1}
        sx={{
          p: 2,
          maxWidth: "70%",
          bgcolor: isUser ? "primary.dark" : "grey.900",
        }}
      >
        {isUser ? (
          <Typography>{content}</Typography>
        ) : (
          <Box sx={{ "& p": { m: 0 }, "& pre": { overflow: "auto" } }}>
            <ReactMarkdown>{content}</ReactMarkdown>
          </Box>
        )}
      </Paper>
    </Box>
  );
}
