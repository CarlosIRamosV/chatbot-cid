import type { APIRoute } from "astro";
import { getDatabase } from "firebase-admin/database";
import { app } from "@firebase/server.ts";
import { checkUserAuthentication } from "@utils/auth.ts";

const getBotStatusRef = () => {
  const db = getDatabase(app);
  return db.ref("chatbot/bot-status");
};

// GET endpoint to check bot status for a specific number
export const GET: APIRoute = async ({ request }) => {
  const user = await checkUserAuthentication(request);
  if (!user) {
    return new Response("No token found", { status: 401 });
  }

  try {
    // Get phoneNumber from URL parameters
    const url = new URL(request.url);
    const phoneNumber = url.searchParams.get("phoneNumber");

    if (!phoneNumber) {
      return new Response("Phone number is required", { status: 400 });
    }

    // Get bot status from database
    const statusRef = getBotStatusRef().child(phoneNumber);
    const snapshot = await statusRef.once("value");
    const statusData = snapshot.val();

    // Default to enabled if no status is found
    // Or if the disable period has expired
    let enabled = true;
    let expiresIn = null;

    if (statusData) {
      if (statusData.enabled === false) {
        if (statusData.expiration && statusData.expiration < Date.now()) {
          // Expiration time has passed, re-enable bot
          await statusRef.update({ enabled: true, expiration: null });
        } else {
          enabled = false;
          // Add this line to calculate remaining time in milliseconds
          expiresIn = statusData.expiration
            ? statusData.expiration - Date.now()
            : null;
        }
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

// POST endpoint to update bot status
export const POST: APIRoute = async ({ request }) => {
  const user = await checkUserAuthentication(request);
  if (!user) {
    return new Response("No token found", { status: 401 });
  }

  try {
    const body = await request.json();
    const { phoneNumber, enabled, expiration } = body;

    if (phoneNumber === undefined || enabled === undefined) {
      return new Response("Phone number and enabled status are required", {
        status: 400,
      });
    }

    // Update bot status in database
    const statusRef = getBotStatusRef().child(phoneNumber);
    await statusRef.update({
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
