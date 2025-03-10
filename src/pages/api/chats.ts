import type { APIRoute } from "astro";
import { getDatabase } from "firebase-admin/database";
import { app } from "@firebase/server.ts";
import { checkUserAuthentication } from "@utils/auth.ts";

const getChatsRef = () => getDatabase(app).ref("chatbot/chats");

export const GET: APIRoute = async ({ request, url }) => {
  const user = await checkUserAuthentication(request);
  if (!user) return new Response("No token found", { status: 401 });

  try {
    const phoneNumber = url.searchParams.get("phoneNumber");
    const ref = phoneNumber ? getChatsRef().child(phoneNumber) : getChatsRef();

    const snapshot = await ref.once("value");
    const data = snapshot.val();

    if (!data) {
      const message = phoneNumber
        ? `No chat found for phone number: ${phoneNumber}`
        : "No chats found";
      return new Response(message, { status: 404 });
    }

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? `Error fetching chats: ${error.message}`
        : "Unknown error occurred";
    return new Response(message, { status: 500 });
  }
};

export const DELETE: APIRoute = async ({ request, url }) => {
  const user = await checkUserAuthentication(request);
  if (!user) return new Response("No token found", { status: 401 });

  const phoneNumber = url.searchParams.get("phoneNumber");
  if (!phoneNumber)
    return new Response("Phone number is required", { status: 400 });

  try {
    await getChatsRef().child(phoneNumber).remove();
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? `Error deleting chat: ${error.message}`
        : "Unknown error occurred";
    return new Response(message, { status: 500 });
  }
};
