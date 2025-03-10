import type { APIRoute } from "astro";
import { getDatabase } from "firebase-admin/database";
import { app } from "@firebase/server.ts";
import { checkUserAuthentication } from "@utils/auth.ts";

const getChatsRef = () => {
  const db = getDatabase(app);
  return db.ref("chatbot/chats");
};

// GET handler to fetch all chats or a specific chat by phone number
export const GET: APIRoute = async ({ request, url }) => {
  const user = await checkUserAuthentication(request);
  if (!user) {
    return new Response("No token found", { status: 401 });
  }

  try {
    const chatsRef = getChatsRef();
    const phoneNumber = url.searchParams.get("phoneNumber");

    // If phone number is provided, fetch specific chat
    if (phoneNumber) {
      const snapshot = await chatsRef.child(phoneNumber).once("value");
      const chat = snapshot.val();

      if (!chat) {
        return new Response(`No chat found for phone number: ${phoneNumber}`, {
          status: 404,
        });
      }

      return new Response(JSON.stringify(chat), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Otherwise fetch all chats
    const snapshot = await chatsRef.once("value");
    const chats = snapshot.val();

    if (!chats) {
      return new Response("No chats found", { status: 404 });
    }

    return new Response(JSON.stringify(chats), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    if (error instanceof Error) {
      return new Response(`Error fetching chats: ${error.message}`, {
        status: 500,
      });
    }
    return new Response("Unknown error occurred", { status: 500 });
  }
};

// DELETE handler to delete a specific chat
export const DELETE: APIRoute = async ({ request, url }) => {
  const user = await checkUserAuthentication(request);
  if (!user) {
    return new Response("No token found", { status: 401 });
  }

  const phoneNumber = url.searchParams.get("phoneNumber");
  if (!phoneNumber) {
    return new Response("Phone number is required", { status: 400 });
  }

  try {
    const chatsRef = getChatsRef();
    await chatsRef.child(phoneNumber).remove();

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    if (error instanceof Error) {
      return new Response(`Error deleting chat: ${error.message}`, {
        status: 500,
      });
    }
    return new Response("Unknown error occurred", { status: 500 });
  }
};
