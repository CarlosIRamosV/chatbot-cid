import type { APIRoute } from "astro";
import { getDatabase } from "firebase-admin/database";
import { app } from "@firebase/server.ts";
import { checkUserAuthentication } from "@utils/auth.ts";

export const GET: APIRoute = async ({ request }) => {
  const user = await checkUserAuthentication(request);
  if (!user) {
    return new Response(JSON.stringify({ error: "No token found" }), {
      status: 401,
    });
  }

  try {
    const db = getDatabase(app);
    const verificationTokenRef = db.ref("chatbot/settings/verification_token");
    const snapshot = await verificationTokenRef.once("value");
    const verificationToken = snapshot.val();

    if (!verificationToken) {
      await verificationTokenRef.set("");
    }

    return new Response(JSON.stringify({ verificationToken }), { status: 200 });
  } catch (error) {
    console.error("Error getting verification token:", error);
    return new Response(
      JSON.stringify({ error: "Error getting verification token" }),
      { status: 500 },
    );
  }
};

export const PUT: APIRoute = async ({ request }) => {
  const user = await checkUserAuthentication(request);
  if (!user) {
    return new Response(JSON.stringify({ error: "No token found" }), {
      status: 401,
    });
  }

  try {
    const { verificationToken } = await request.json();
    if (!verificationToken) {
      return new Response(
        JSON.stringify({ error: "Verification token is required" }),
        { status: 400 },
      );
    }

    const db = getDatabase(app);
    const verificationTokenRef = db.ref("chatbot/settings/verification_token");
    await verificationTokenRef.set(verificationToken);

    return new Response(
      JSON.stringify({ message: "Verification token updated successfully" }),
      { status: 200 },
    );
  } catch (error) {
    console.error("Error updating verification token:", error);
    return new Response(
      JSON.stringify({ error: "Error updating verification token" }),
      { status: 500 },
    );
  }
};
