import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/scales")({
  beforeLoad: () => {
    throw redirect({ to: "/studio/scales" });
  },
});