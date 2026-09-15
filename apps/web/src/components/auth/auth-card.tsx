import type { ReactNode } from "react";
import { Box, Card, CardContent, CardHeader } from "@mui/material";
import { ThemeSelect } from "../../app/theme.js";

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
    <Box component="main" sx={{ minHeight: "100vh", display: "grid", placeItems: "center", p: 3, bgcolor: "background.default" }}>
      <ThemeSelect sx={{ position: "fixed", top: 16, right: 16 }} />
      <Card sx={{ width: "100%", maxWidth: 448 }}>
        <CardHeader title={title} subheader={description} />
        <CardContent>{children}</CardContent>
      </Card>
    </Box>
  );
}








