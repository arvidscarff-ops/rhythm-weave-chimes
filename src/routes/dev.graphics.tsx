/** Reset R7 comparative graphics evidence — isolated from production runtime. */
import { createFileRoute } from "@tanstack/react-router";
import { R7GraphicsLab } from "@/components/graphics/R7GraphicsLab";

export const Route = createFileRoute("/dev/graphics")({
  ssr: false,
  component: R7GraphicsLab,
  head: () => ({
    meta: [
      { title: "Graphics Laboratory · Dev" },
      { name: "robots", content: "noindex" },
      {
        name: "description",
        content: "Developer-only Canvas 2D and WebGL2 atmosphere comparison for PHASE Reset R7.",
      },
    ],
  }),
});
