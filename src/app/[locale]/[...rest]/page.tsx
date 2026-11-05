import { notFound } from "next/navigation";

// Catch-all so unknown URLs render the localized 404 inside the site layout.
export default function CatchAll() {
  notFound();
}
