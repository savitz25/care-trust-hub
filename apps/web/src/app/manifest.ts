import type { MetadataRoute } from "next";
import { brand } from "@/config/brand";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: brand.publicName,
    short_name: brand.publicName,
    description: brand.description,
    start_url: "/",
    display: "browser",
    background_color: "#fcfaf6",
    theme_color: brand.colors.primary,
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
