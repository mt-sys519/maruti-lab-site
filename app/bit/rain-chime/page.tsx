import { redirect } from "next/navigation";

// AVENUE's URL moved to /bit/avenue - keep this stub so old links and
// bookmarks to /bit/rain-chime still land on the page instead of 404ing.
export default function RainChimeRedirectPage() {
  redirect("/bit/avenue");
}
