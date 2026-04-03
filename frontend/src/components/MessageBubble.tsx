import { Box, Paper, Typography, alpha } from "@mui/material";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
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
        alignItems: "flex-start",
        gap: 1,
        mb: 2,
      }}
    >
      {!isUser && (
        <Box
          data-testid="assistant-avatar"
          sx={{
            width: 28,
            height: 28,
            borderRadius: 1.5,
            bgcolor: alpha("#7c3aed", 0.15),
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            mt: 0.5,
          }}
        >
          <AutoAwesomeIcon sx={{ fontSize: 14, color: "#a78bfa" }} />
        </Box>
      )}
      <Paper
        elevation={0}
        sx={{
          px: 2,
          py: 1.5,
          maxWidth: "70%",
          bgcolor: isUser ? alpha("#7c3aed", 0.15) : alpha("#1e1e2e", 0.6),
          border: 1,
          borderColor: isUser ? alpha("#7c3aed", 0.25) : alpha("#ffffff", 0.06),
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
          borderRadius: 3,
        }}
      >
        {isUser ? (
          <Typography sx={{ fontSize: "0.925rem" }}>{content}</Typography>
        ) : (
          <Box
            sx={{
              "& p": { m: 0, mb: 1, "&:last-child": { mb: 0 } },
              "& ul, & ol": { my: 0.5, pl: 2.5 },
              "& li": { mb: 0.25 },
              "& pre": {
                overflow: "auto",
                bgcolor: alpha("#000000", 0.3),
                p: 1.5,
                borderRadius: 2,
                my: 1,
              },
              "& code": {
                fontSize: "0.85rem",
                fontFamily: '"JetBrains Mono", "Fira Code", monospace',
              },
              "& a": {
                color: "#93c5fd",
                textDecoration: "none",
                "&:hover": { textDecoration: "underline" },
              },
              fontSize: "0.925rem",
            }}
          >
            <ReactMarkdown>{content}</ReactMarkdown>
          </Box>
        )}
      </Paper>
    </Box>
  );
}
