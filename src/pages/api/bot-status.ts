import type { APIRoute } from "astro";
import { getDatabase } from "firebase-admin/database";
import { app } from "@firebase/server.ts";
import { checkUserAuthentication } from "@utils/auth.ts";

const getBotStatusRef = () => getDatabase(app).ref("chatbot/bot-status");

export const GET: APIRoute = async ({ request }) => {
  const user = await checkUserAuthentication(request);
  if (!user) return new Response("No token found", { status: 401 });

  try {
    const url = new URL(request.url);
    const phoneNumber = url.searchParams.get("phoneNumber");
    if (!phoneNumber)
      return new Response("Phone number is required", { status: 400 });

    const snapshot = await getBotStatusRef().child(phoneNumber).once("value");
    const statusData = snapshot.val();

    let enabled = true;
    let expiresIn = null;

    if (statusData && statusData.enabled === false) {
      if (statusData.expiration && statusData.expiration < Date.now()) {
        await getBotStatusRef()
          .child(phoneNumber)
          .update({ enabled: true, expiration: null });
      } else {
        enabled = false;
        expiresIn = statusData.expiration
          ? statusData.expiration - Date.now()
          : null;
      }
    }

    return new Response(JSON.stringify({ enabled, expiresIn }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error getting bot status:", error);
    return new Response(
      `Error getting bot status: ${error instanceof Error ? error.message : String(error)}`,
      { status: 500 },
    );
  }
};

export const POST: APIRoute = async ({ request }) => {
  const user = await checkUserAuthentication(request);
  if (!user) return new Response("No token found", { status: 401 });

  try {
    const { phoneNumber, enabled, expiration } = await request.json();

    if (phoneNumber === undefined || enabled === undefined) {
      return new Response("Phone number and enabled status are required", {
        status: 400,
      });
    }

    await getBotStatusRef()
      .child(phoneNumber)
      .update({
        enabled,
        expiration: expiration || null,
        updatedAt: Date.now(),
        updatedBy: user.uid,
      });

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error updating bot status:", error);
    return new Response(
      `Error updating bot status: ${error instanceof Error ? error.message : String(error)}`,
      { status: 500 },
    );
  }
};
