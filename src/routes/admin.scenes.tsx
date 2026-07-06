import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/scenes")({
  beforeLoad: () => {
    throw redirect({ to: "/studio/scenes" });
  },
});