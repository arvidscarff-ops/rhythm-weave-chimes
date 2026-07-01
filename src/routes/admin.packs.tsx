import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/packs")({
  beforeLoad: () => {
    throw redirect({ to: "/studio/packs" });
  },
});