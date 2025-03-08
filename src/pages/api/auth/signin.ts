import type { APIRoute } from "astro";
import { app } from "@firebase/server";
import { getAuth } from "firebase-admin/auth";
import { getDatabase } from "firebase-admin/database";

export const GET: APIRoute = async ({ request, cookies, redirect }) => {
  const auth = getAuth(app);

  // Obtener el token del encabezado de la solicitud
  const idToken = request.headers.get("Authorization")?.split("Bearer ")[1];
  if (!idToken) {
    return new Response("No token found", { status: 401 });
  }

  try {
    // Verificar el token de ID
    const decodedToken = await auth.verifyIdToken(idToken);
    const email = decodedToken.email;

    if (!email) {
      return new Response("No email found", { status: 401 });
    }

    // Verificar si el usuario está en la lista blanca
    const db = getDatabase(app);
    const emailsWhitelistRef = db.ref("chatbot/settings/emails_whitelist");
    const snapshot = await emailsWhitelistRef.once("value");
    const emailsWhitelist = snapshot.val();

    if (!emailsWhitelist || !emailsWhitelist.includes(email)) {
      return new Response("Email not in whitelist", { status: 401 });
    }

    // Crear y establecer la cookie de sesión
    const fiveDays = 60 * 60 * 24 * 5 * 1000;
    const sessionCookie = await auth.createSessionCookie(idToken, {
      expiresIn: fiveDays,
    });

    cookies.set("__session", sessionCookie, {
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
