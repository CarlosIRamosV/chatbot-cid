import type { APIRoute } from "astro";
import { app } from "@firebase/server.ts";
import { getDatabase } from "firebase-admin/database";
import { checkUserAuthentication } from "@utils/auth.ts";

const getAppIdRef = () => getDatabase(app).ref("chatbot/settings/app_id");

export const GET: APIRoute = async ({ request }) => {
  try {
    // Check if the user is authenticated
    const authUser = await checkUserAuthentication(request);
    if (!authUser) {
      return new Response(JSON.stringify({ message: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Get the App ID from Realtime Database
    const snapshot = await getAppIdRef().get();

    if (!snapshot.exists()) {
      return new Response(
        JSON.stringify({ message: "Facebook App ID not found" }),
        { status: 404, headers: { "Content-Type": "application/json" } },
      );
    }

    const appId = snapshot.val()?.appId || "";

    return new Response(JSON.stringify({ appId }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error fetching Facebook App ID:", error);

    return new Response(
      JSON.stringify({ message: "Failed to fetch Facebook App ID" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
};

export const PUT: APIRoute = async ({ request }) => {
  try {
    // Check if the user is authenticated
    const authUser = await checkUserAuthentication(request);
    if (!authUser) {
      return new Response(JSON.stringify({ message: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const body = await request.json();
    const { appId } = body;

    if (!appId) {
      return new Response(JSON.stringify({ message: "App ID is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Update the App ID in Realtime Database
    await getAppIdRef().set({
      appId,
      updatedAt: new Date().toISOString(),
    });

    return new Response(
      JSON.stringify({ message: "Facebook App ID updated successfully" }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Error updating Facebook App ID:", error);

    return new Response(
      JSON.stringify({ message: "Failed to update Facebook App ID" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
};
