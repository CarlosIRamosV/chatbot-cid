import type { APIRoute } from "astro";
import { getDatabase } from "firebase-admin/database";
import { app } from "@firebase/server.ts";
import { checkUserAuthentication } from "@utils/auth.ts";

const getLayoutRef = () => {
  const db = getDatabase(app);
  return db.ref("chatbot/layout");
};
export const GET: APIRoute = async ({ request }) => {
  const user = await checkUserAuthentication(request);
  if (!user) {
    return new Response("No token found", { status: 401 });
  }
  try {
    // Get layout data from Firebase Realtime Database
    const layoutRef = getLayoutRef();
    const snapshot = await layoutRef.once("value");
    const layoutData = snapshot.val();

    if (!layoutData) {
      return new Response(JSON.stringify({ error: "No layout data found" }), {
        status: 404,
        headers: {
          "Content-Type": "application/json",
        },
      });
    }

    return new Response(JSON.stringify(layoutData), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    console.error("Error retrieving layout:", error);
    return new Response(
      JSON.stringify({ error: "Failed to retrieve layout" }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
  }
};

export const POST: APIRoute = async ({ request }) => {
  const user = await checkUserAuthentication(request);
  if (!user) {
    return new Response("No token found", { status: 401 });
  }
  try {
    const layoutData = await request.json();

    // Save layout data to Firebase Realtime Database
    const layoutRef = getLayoutRef();
    await layoutRef.set({
      nodePositions: layoutData,
      updatedAt: new Date().toISOString(),
    });

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    console.error("Error saving layout:", error);
    return new Response(JSON.stringify({ error: "Failed to save layout" }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }
};
