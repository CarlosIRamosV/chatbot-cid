import type { APIRoute } from "astro";
import { app } from "@firebase/server";
import { getAuth } from "firebase-admin/auth";
import { getDatabase } from "firebase-admin/database";

export const GET: APIRoute = async ({ request, cookies, redirect }) => {
  const idToken = request.headers.get("Authorization")?.split("Bearer ")[1];
  if (!idToken) return new Response("No token found", { status: 401 });

  try {
    const decodedToken = await getAuth(app).verifyIdToken(idToken);
    const { email } = decodedToken;

    if (!email) return new Response("No email found", { status: 401 });

    const snapshot = await getDatabase(app)
      .ref("chatbot/settings/emails_whitelist")
      .once("value");
    const emailsWhitelist = snapshot.val();

    if (!emailsWhitelist || !emailsWhitelist.includes(email)) {
      return new Response("Email not in whitelist", { status: 401 });
    }

    const fiveDays = 60 * 60 * 24 * 5 * 1000;
    const sessionCookie = await getAuth(app).createSessionCookie(idToken, {
      expiresIn: fiveDays,
    });

    cookies.set("session", sessionCookie, {
      path: "/",
      httpOnly: true,
      secure: true,
      sameSite: "strict",
    });

    return redirect("/");
  } catch (error) {
    console.error("Error during authentication:", error);
    return new Response("Authentication error", { status: 401 });
  }
};
