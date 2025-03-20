import type { APIRoute } from "astro";
import { app } from "@firebase/server.ts";
import { getDatabase } from "firebase-admin/database";
import { checkUserAuthentication } from "@utils/auth.ts";

const db = getDatabase(app);
const getRef = (path: string) => db.ref(`chatbot/settings/${path}`);

// Token is valid for 60 days, we'll regenerate after 30 days
const TOKEN_REFRESH_INTERVAL = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds
const TOKEN_VALIDITY_PERIOD = 60 * 24 * 60 * 60 * 1000; // 60 days in milliseconds

export const GET: APIRoute = async ({ request }) => {
  try {
    const authUser = await checkUserAuthentication(request);
    if (!authUser) {
      return new Response(JSON.stringify({ message: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const snapshot = await getRef("access_token").get();
    if (!snapshot.exists()) {
      return new Response(
        JSON.stringify({ message: "Access token not found" }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const data = snapshot.val();
    const accessToken = data?.accessToken || "";
    const updatedAt = data?.updatedAt || "";
    const updatedTime = updatedAt ? new Date(updatedAt).getTime() : 0;

    // Check if token needs to be refreshed (older than 30 days)
    const needsRefresh =
      updatedAt && Date.now() - updatedTime > TOKEN_REFRESH_INTERVAL;
    const expiresAt = updatedAt
      ? new Date(updatedTime + TOKEN_VALIDITY_PERIOD).toISOString()
      : null;

    return new Response(
      JSON.stringify({ accessToken, updatedAt, needsRefresh, expiresAt }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Error fetching access token:", error);
    return new Response(
      JSON.stringify({ message: "Failed to fetch access token" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
};

export const PUT: APIRoute = async ({ request }) => {
  try {
    const authUser = await checkUserAuthentication(request);
    if (!authUser) {
      return new Response(JSON.stringify({ message: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { accessToken } = await request.json();
    if (!accessToken) {
      return new Response(
        JSON.stringify({ message: "Access token is required" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    // Save token with timestamp
    await getRef("access_token").set({
      accessToken,
      updatedAt: new Date().toISOString(),
    });

    return new Response(
      JSON.stringify({ message: "Access token updated successfully" }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("Error updating access token:", error);
    return new Response(
      JSON.stringify({ message: "Failed to update access token" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
};
