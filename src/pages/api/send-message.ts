import type { APIRoute } from "astro";
import axios from "axios";
import { getDatabase } from "firebase-admin/database";
import { app } from "@firebase/server.ts";
import { checkUserAuthentication } from "@utils/auth.ts";

const getSettingsRef = () => getDatabase(app).ref("chatbot/settings");
const getChatsRef = () => getDatabase(app).ref("chatbot/chats");

function createTextMessage(to: string, text: string) {
  return {
    messaging_product: "whatsapp",
    to,
    type: "text",
    text: { body: text },
  };
}

async function sendMessage(
  payload: Record<string, any>,
  phoneNumberId: string,
  accessToken: string,
): Promise<void> {
  const url = `https://graph.facebook.com/v22.0/${phoneNumberId}/messages`;
  try {
    await axios.post(url, payload, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
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
  if (!user) return new Response("No token found", { status: 401 });

  try {
    const { phoneNumber, message } = await request.json();

    if (!phoneNumber || !message) {
      return new Response("Phone number and message are required", {
        status: 400,
      });
    }

    const settingsSnapshot = await getSettingsRef().once("value");
    const settings = settingsSnapshot.val();

    if (!settings?.access_token || !settings?.phone_number_id) {
      return new Response("Missing WhatsApp API configuration", {
        status: 500,
      });
    }

    await sendMessage(
      createTextMessage(phoneNumber, message),
      settings.phone_number_id,
      settings.access_token.accessToken,
    );

    await getChatsRef().child(phoneNumber).push({
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
