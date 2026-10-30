import Link from "next/link";
import { notFoundMetadata } from "@/config/metadata";

export const metadata = notFoundMetadata("Page not found");

export default function NotFound() {
  return (
    <section className="page-shell" aria-labelledby="not-found-title">
      <h1 id="not-found-title">Page not found</h1>
      <p>The page you requested could not be found.</p>
      <Link href="/">Return to the Senior Trust Hub homepage</Link>
    </section>
  );
}
