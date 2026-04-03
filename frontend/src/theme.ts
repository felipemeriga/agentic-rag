import { createTheme, alpha } from "@mui/material/styles";

const theme = createTheme({
  palette: {
    mode: "dark",
    primary: {
      main: "#7c3aed",
      light: "#a78bfa",
      dark: "#5b21b6",
    },
    secondary: {
      main: "#3b82f6",
      light: "#93c5fd",
      dark: "#2563eb",
    },
    success: {
      main: "#10b981",
    },
    error: {
      main: "#ef4444",
    },
    warning: {
      main: "#f59e0b",
    },
    background: {
      default: "#0f0f14",
      paper: "#171720",
    },
    divider: alpha("#ffffff", 0.06),
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h1: { fontWeight: 700, letterSpacing: "-0.025em" },
    h2: { fontWeight: 700, letterSpacing: "-0.025em" },
    h3: { fontWeight: 600, letterSpacing: "-0.02em" },
    h4: { fontWeight: 600, letterSpacing: "-0.02em" },
    h5: { fontWeight: 600, letterSpacing: "-0.01em" },
    h6: { fontWeight: 600 },
    body1: { letterSpacing: "-0.01em", lineHeight: 1.6 },
    body2: { letterSpacing: "-0.01em", lineHeight: 1.6 },
    button: { fontWeight: 500 },
  },
  shape: {
    borderRadius: 12,
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          background:
            "linear-gradient(135deg, #0f0f14 0%, #13141f 50%, #0f0f14 100%)",
          minHeight: "100vh",
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: "none" as const,
          borderRadius: 10,
          fontWeight: 500,
          transition: "all 0.2s ease-in-out",
          "&:hover": {
            transform: "translateY(-1px)",
          },
        },
        contained: {
          background: "linear-gradient(135deg, #7c3aed, #6d28d9)",
          boxShadow: "0 4px 14px 0 rgba(124, 58, 237, 0.3)",
          "&:hover": {
            background: "linear-gradient(135deg, #8b5cf6, #7c3aed)",
            boxShadow: "0 6px 20px 0 rgba(124, 58, 237, 0.4)",
          },
        },
        outlined: {
          borderWidth: "1.5px",
          borderColor: alpha("#7c3aed", 0.4),
          color: "#a78bfa",
          "&:hover": {
            borderWidth: "1.5px",
            backgroundColor: alpha("#7c3aed", 0.08),
            borderColor: alpha("#7c3aed", 0.6),
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 16,
          backgroundImage: "none",
          backgroundColor: alpha("#1e1e2e", 0.65),
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
          border: `1px solid ${alpha("#ffffff", 0.08)}`,
          boxShadow: "0 8px 32px rgba(0, 0, 0, 0.3)",
          transition:
            "transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out, border-color 0.2s ease-in-out",
          "&:hover": {
            boxShadow: "0 12px 40px rgba(0, 0, 0, 0.4)",
            borderColor: alpha("#ffffff", 0.15),
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
          backgroundColor: alpha("#1e1e2e", 0.6),
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
          border: `1px solid ${alpha("#ffffff", 0.06)}`,
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          "& .MuiOutlinedInput-root": {
            borderRadius: 10,
            backgroundColor: alpha("#ffffff", 0.03),
            transition: "background-color 0.2s ease, border-color 0.2s ease",
            "&:hover": {
              backgroundColor: alpha("#ffffff", 0.05),
            },
            "&.Mui-focused": {
              backgroundColor: alpha("#7c3aed", 0.05),
              "& .MuiOutlinedInput-notchedOutline": {
                borderColor: "#7c3aed",
                borderWidth: 2,
              },
            },
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          fontWeight: 500,
        },
        filled: {
          backgroundColor: alpha("#7c3aed", 0.15),
          "&:hover": {
            backgroundColor: alpha("#7c3aed", 0.25),
          },
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          transition: "transform 0.2s ease, background-color 0.2s ease",
          "&:hover": {
            backgroundColor: alpha("#7c3aed", 0.1),
            transform: "scale(1.05)",
          },
        },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          backgroundColor: alpha("#1e1e2e", 0.95),
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          borderRadius: 8,
          fontSize: "0.75rem",
          fontWeight: 500,
          border: `1px solid ${alpha("#ffffff", 0.1)}`,
        },
      },
    },
    MuiDivider: {
      styleOverrides: {
        root: {
          borderColor: alpha("#ffffff", 0.06),
        },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          margin: "2px 8px",
          transition: "background-color 0.15s ease",
          "&.Mui-selected": {
            backgroundColor: alpha("#7c3aed", 0.15),
            "&:hover": {
              backgroundColor: alpha("#7c3aed", 0.2),
            },
          },
          "&:hover": {
            backgroundColor: alpha("#7c3aed", 0.08),
          },
        },
      },
    },
  },
});

export default theme;
