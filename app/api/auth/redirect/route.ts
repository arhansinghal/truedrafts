import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

// Called after Google OAuth on the login page.
// Reads the user's actual role and sends them to the right dashboard.
export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    redirect("/login");
  }

  switch (session.user.role) {
    case "writer":
      redirect("/writer");
    case "admin":
      redirect("/admin");
    default:
      redirect("/dashboard");
  }
}
