import type { APIRoute } from "astro";
import { app } from "@firebase/server.ts";
import { getDatabase } from "firebase-admin/database";
import { checkUserAuthentication } from "@utils/auth.ts";

const getAppSecretRef = () =>
  getDatabase(app).ref("chatbot/settings/app_secret");

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

    // Get the App Secret from Realtime Database
    const snapshot = await getAppSecretRef().get();

    if (!snapshot.exists()) {
      return new Response(
        JSON.stringify({ message: "Facebook App Secret not found" }),
        { status: 404, headers: { "Content-Type": "application/json" } },
      );
    }

    const appSecret = snapshot.val()?.appSecret || "";

    return new Response(JSON.stringify({ appSecret }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error fetching Facebook App Secret:", error);

    return new Response(
      JSON.stringify({ message: "Failed to fetch Facebook App Secret" }),
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
    const { appSecret } = body;

    if (!appSecret) {
      return new Response(
        JSON.stringify({ message: "App Secret is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    // Update the App Secret in Realtime Database
    await getAppSecretRef().set({
      appSecret,
      updatedAt: new Date().toISOString(),
    });

    return new Response(
      JSON.stringify({ message: "Facebook App Secret updated successfully" }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Error updating Facebook App Secret:", error);

    return new Response(
      JSON.stringify({ message: "Failed to update Facebook App Secret" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
};
