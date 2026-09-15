import { Box, CircularProgress, Typography } from "@mui/material";

export function PageLoading({ label = "正在加载" }: { readonly label?: string }) {
  return (
    <Box
      role="status"
      aria-label={label}
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        gap: 2,
      }}
    >
      <CircularProgress />
      <Typography color="text.secondary">{label}</Typography>
    </Box>
  );
}
