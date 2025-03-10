import type { APIRoute } from "astro";
import axios from "axios";
import { getDatabase } from "firebase-admin/database";
import { app } from "@firebase/server.ts";
import { checkUserAuthentication } from "@utils/auth.ts";

const getSettingsRef = () => {
  const db = getDatabase(app);
  return db.ref("chatbot/settings");
};

const getChatsRef = () => {
  const db = getDatabase(app);
  return db.ref("chatbot/chats");
};

function createTextMessage(to: string, text: string): Record<string, any> {
  return {
    messaging_product: "whatsapp",
    to,
    type: "text",
    text: { body: text },
  };
}

async function sendMessage(
  payload: Record<string, any>,
  facebookPhoneNumberId: string,
  facebookAccessToken: string,
): Promise<void> {
  const url = `https://graph.facebook.com/v22.0/${facebookPhoneNumberId}/messages`;

  try {
    await axios.post(url, payload, {
      headers: {
        Authorization: `Bearer ${facebookAccessToken}`,
        "Content-Type": "application/json",
      },
    });
  } catch (error: any) {
    console.error(
      "Error sending message:",
      error.response?.data || error.message,
    );
    throw error;
  }
}

export const POST: APIRoute = async ({ request }) => {
  const user = await checkUserAuthentication(request);
  if (!user) {
    return new Response("No token found", { status: 401 });
  }

  try {
    // Parse request body
    const body = await request.json();
    const { phoneNumber, message } = body;

    if (!phoneNumber || !message) {
      return new Response("Phone number and message are required", {
        status: 400,
      });
    }

    // Get settings for API credentials
    const settingsRef = getSettingsRef();
    const settingsSnapshot = await settingsRef.once("value");
    const settings = settingsSnapshot.val();

    if (!settings || !settings.access_token || !settings.phone_number_id) {
      return new Response("Missing WhatsApp API configuration", {
        status: 500,
      });
    }

    // Create and send the message
    const payload = createTextMessage(phoneNumber, message);
    await sendMessage(payload, settings.phone_number_id, settings.access_token);

    // Save the message to chat history
    const chatsRef = getChatsRef().child(phoneNumber);
    await chatsRef.push({
      text: message,
      timestamp: Date.now(),
      isUser: false,
      isAdmin: true,
    });

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error sending custom message:", error);
    return new Response(
      `Error sending message: ${error instanceof Error ? error.message : String(error)}`,
      { status: 500 },
    );
  }
};
