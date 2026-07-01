import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/unlock")({
  beforeLoad: () => {
    throw redirect({ to: "/studio" });
  },
});