import type { APIRoute } from "astro";
import { app } from "@firebase/server.ts";
import { getDatabase } from "firebase-admin/database";
import { checkUserAuthentication } from "@utils/auth.ts";
import axios from "axios";

const getAppIdRef = () => getDatabase(app).ref("chatbot/settings/app_id");
const getAppSecretRef = () =>
  getDatabase(app).ref("chatbot/settings/app_secret");

export const POST: APIRoute = async ({ request }) => {
  try {
    // Check if the user is authenticated
    const authUser = await checkUserAuthentication(request);
    if (!authUser) {
      return new Response(JSON.stringify({ message: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Get request body
    const body = await request.json();
    const { shortLivedToken } = body;

    if (!shortLivedToken) {
      return new Response(
        JSON.stringify({ message: "Short-lived token is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    // Get App ID and App Secret from the database
    const [appIdSnapshot, appSecretSnapshot] = await Promise.all([
      getAppIdRef().get(),
      getAppSecretRef().get(),
    ]);

    if (!appIdSnapshot.exists() || !appSecretSnapshot.exists()) {
      return new Response(
        JSON.stringify({
          message: "Facebook App ID or App Secret not configured",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const appId = appIdSnapshot.val()?.appId;
    const appSecret = appSecretSnapshot.val()?.appSecret;

    if (!appId || !appSecret) {
      return new Response(
        JSON.stringify({ message: "Invalid Facebook App configuration" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    // Facebook Graph API endpoint for token exchange
    const response = await axios.get(
      "https://graph.facebook.com/v22.0/oauth/access_token",
      {
        params: {
          grant_type: "fb_exchange_token",
          client_id: appId,
          client_secret: appSecret,
          fb_exchange_token: shortLivedToken,
        },
      },
    );

    const longLivedToken = response.data.access_token;

    return new Response(JSON.stringify({ longLivedToken }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error generating long-lived token:", error);

    // Get more specific error message from Facebook if available
    let errorMessage = "Failed to generate long-lived token";
    if (axios.isAxiosError(error) && error.response) {
      errorMessage = error.response.data?.error?.message || errorMessage;
    }

    return new Response(JSON.stringify({ message: errorMessage }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
