import { Box, Card, CardContent, CardHeader, Typography } from "@mui/material";
import type { ReactNode } from "react";
import { ThemeSelect } from "../../app/theme.js";
import { Brand } from "../shared/brand.js";

export function AuthCard({
  children,
  description,
  title,
}: {
  readonly children: ReactNode;
  readonly description?: string;
  readonly title: string;
}) {
  return (
    <Box
      component="main"
      sx={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        p: 3,
        bgcolor: "background.default",
      }}
    >
      <Box
        sx={{
          width: "100%",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 5,
        }}
      >
        <Brand />
        <ThemeSelect compact />
      </Box>
      <Box
        sx={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "flex-start",
          width: "100%",
        }}
      >
        <Card sx={{ width: "100%", maxWidth: 450 }}>
          <CardHeader title={title} subheader={description} />
          <CardContent>{children}</CardContent>
        </Card>
        <Typography sx={{ mt: 1.5, fontSize: 12, color: "text.secondary" }}>
          继续即表示你同意服务条款和隐私政策
        </Typography>
      </Box>
    </Box>
  );
}
