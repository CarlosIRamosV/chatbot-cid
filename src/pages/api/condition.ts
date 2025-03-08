import type { APIRoute } from "astro";
import { getDatabase } from "firebase-admin/database";
import { app } from "@firebase/server.ts";
import { checkUserAuthentication } from "@utils/auth.ts";

const getChatbotRef = () => {
  const db = getDatabase(app);
  return db.ref("chatbot/conditions");
};

export const GET: APIRoute = async ({ request }) => {
  const user = await checkUserAuthentication(request);
  if (!user) {
    return new Response("No token found", { status: 401 });
  }

  try {
    const chatbotRef = getChatbotRef();
    const snapshot = await chatbotRef.once("value");
    const conditions = snapshot.val();
    if (!conditions) {
      return new Response("No conditions found", { status: 404 });
    }
    return new Response(JSON.stringify(conditions), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    if (error instanceof Error) {
      return new Response(`Error getting conditions: ${error.message}`, {
        status: 500,
      });
    }
    return new Response("Unknown error occurred", { status: 500 });
  }
};
