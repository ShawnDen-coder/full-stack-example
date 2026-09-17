import { Box, Typography } from "@mui/material";
import { appShellColors } from "../../app/theme.js";

export function Brand({ dark = false }: { readonly dark?: boolean }) {
  return (
    <Box sx={{ display: "inline-flex", alignItems: "center", gap: 1.25 }}>
      <Box
        aria-hidden="true"
        sx={{
          width: "1.75rem",
          height: "1.75rem",
          display: "grid",
          placeItems: "center",
          borderRadius: 1,
          bgcolor: dark ? appShellColors.accent : "primary.main",
          color: dark ? appShellColors.background : "primary.contrastText",
          fontWeight: 700,
          fontSize: "0.9375rem",
        }}
      >
        F
      </Box>
      <Typography
        sx={{
          fontWeight: 700,
          fontSize: "0.9375rem",
          color: dark ? appShellColors.text : "text.primary",
        }}
      >
        Full Stack
      </Typography>
    </Box>
  );
}
