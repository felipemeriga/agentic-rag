import { Box, Typography, Chip, IconButton, alpha } from "@mui/material";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import DescriptionIcon from "@mui/icons-material/Description";
import CodeIcon from "@mui/icons-material/Code";
import TextSnippetIcon from "@mui/icons-material/TextSnippet";
import ArticleIcon from "@mui/icons-material/Article";
import DownloadIcon from "@mui/icons-material/Download";
import DeleteIcon from "@mui/icons-material/Delete";
import type { DocumentInfo } from "../lib/api";

interface DocumentCardProps {
  doc: DocumentInfo;
  onDelete: (filename: string) => void;
  onDownload: (filename: string) => void;
}

const FILE_ICONS: Record<string, { icon: React.ReactNode; color: string }> = {
  pdf: { icon: <PictureAsPdfIcon />, color: "#ef4444" },
  docx: { icon: <DescriptionIcon />, color: "#3b82f6" },
  md: { icon: <ArticleIcon />, color: "#10b981" },
  html: { icon: <CodeIcon />, color: "#f59e0b" },
  txt: { icon: <TextSnippetIcon />, color: alpha("#ffffff", 0.5) },
};

const STATUS_COLORS: Record<string, string> = {
  completed: "#10b981",
  processing: "#7c3aed",
  failed: "#ef4444",
};

function timeAgo(dateStr: string): string {
  const seconds = Math.floor(
    (Date.now() - new Date(dateStr).getTime()) / 1000
  );
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function DocumentCard({
  doc,
  onDelete,
  onDownload,
}: DocumentCardProps) {
  const ext = doc.source_filename.split(".").pop()?.toLowerCase() || "txt";
  const fileStyle = FILE_ICONS[ext] || FILE_ICONS.txt;

  return (
    <Box
      sx={{
        p: 2,
        borderRadius: 3,
        bgcolor: alpha("#1e1e2e", 0.6),
        border: 1,
        borderColor: alpha("#ffffff", 0.06),
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        transition: "all 0.2s ease",
        position: "relative",
        "&:hover": {
          bgcolor: alpha("#1e1e2e", 0.8),
          borderColor: alpha("#ffffff", 0.1),
          "& .doc-actions": { opacity: 1 },
        },
      }}
    >
      <Box
        className="doc-actions"
        sx={{
          position: "absolute",
          top: 8,
          right: 8,
          display: "flex",
          gap: 0.25,
          opacity: 0,
          transition: "opacity 0.15s",
        }}
      >
        {doc.has_file && (
          <IconButton
            size="small"
            onClick={() => onDownload(doc.source_filename)}
            sx={{ p: 0.5 }}
          >
            <DownloadIcon sx={{ fontSize: 16 }} />
          </IconButton>
        )}
        <IconButton
          size="small"
          onClick={() => onDelete(doc.source_filename)}
          sx={{ p: 0.5 }}
        >
          <DeleteIcon sx={{ fontSize: 16 }} />
        </IconButton>
      </Box>
      <Box
        sx={{
          width: 36,
          height: 36,
          borderRadius: 2,
          bgcolor: alpha(fileStyle.color, 0.1),
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          mb: 1.5,
          color: fileStyle.color,
          "& .MuiSvgIcon-root": { fontSize: 20 },
        }}
      >
        {fileStyle.icon}
      </Box>
      <Typography variant="body2" noWrap sx={{ fontWeight: 500, mb: 0.75 }}>
        {doc.source_filename}
      </Typography>
      <Chip
        label={doc.status}
        size="small"
        sx={{
          height: 20,
          fontSize: "0.7rem",
          fontWeight: 500,
          bgcolor: alpha(STATUS_COLORS[doc.status] || "#ffffff", 0.12),
          color: STATUS_COLORS[doc.status] || alpha("#ffffff", 0.5),
          mb: 1,
          ...(doc.status === "processing" && {
            animation: "pulse 1.5s infinite",
            "@keyframes pulse": {
              "0%, 100%": { opacity: 1 },
              "50%": { opacity: 0.5 },
            },
          }),
        }}
      />
      <Typography
        variant="caption"
        sx={{ color: alpha("#ffffff", 0.4), display: "block" }}
      >
        {doc.chunks} chunks · {timeAgo(doc.created_at)}
      </Typography>
    </Box>
  );
}
