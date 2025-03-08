import type { APIRoute } from "astro";
import { getDatabase } from "firebase-admin/database";
import { app } from "@firebase/server.ts";
import { checkUserAuthentication } from "@utils/auth.ts";

const handleError = (message: string, status: number): Response => {
  return new Response(JSON.stringify({ error: message }), { status });
};

export const GET: APIRoute = async ({ request }) => {
  const user = await checkUserAuthentication(request);
  if (!user) {
    return handleError("No token found", 401);
  }

  try {
    const db = getDatabase(app);
    const accessTokenRef = db.ref("chatbot/settings/access_token");
    const snapshot = await accessTokenRef.once("value");
    const accessToken = snapshot.val();

    if (!accessToken) {
      await accessTokenRef.set("");
    }

    return new Response(JSON.stringify({ accessToken }), { status: 200 });
  } catch (error) {
    return handleError("Error getting access token", 500);
  }
};

export const PUT: APIRoute = async ({ request }) => {
  const user = await checkUserAuthentication(request);
  if (!user) {
    return handleError("No token found", 401);
  }

  try {
    const { accessToken } = await request.json();
    if (!accessToken) {
      return handleError("Access token is required", 400);
    }

    const db = getDatabase(app);
    const accessTokenRef = db.ref("chatbot/settings/access_token");
    await accessTokenRef.set(accessToken);

    return new Response(
      JSON.stringify({ message: "Access token updated successfully" }),
      { status: 200 },
    );
  } catch (error) {
    return handleError("Error updating access token", 500);
  }
};
