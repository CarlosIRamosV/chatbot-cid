import type { APIRoute } from "astro";
import { getDatabase } from "firebase-admin/database";
import { app } from "@firebase/server.ts";
import { checkUserAuthentication } from "@utils/auth.ts";

const getChatbotRef = (id: string | null) => {
  const db = getDatabase(app);
  if (!id) {
    return db.ref("chatbot/conditions");
  }
  return db.ref(`chatbot/conditions/${id}`);
};

export const GET: APIRoute = async ({ request }) => {
  const user = await checkUserAuthentication(request);
  if (!user) {
    return new Response("No token found", { status: 401 });
  }

  try {
    // Get condition ID from URL parameters
    const url = new URL(request.url);
    const conditionId = url.searchParams.get("id");

    const chatbotRef = getChatbotRef(conditionId);
    const snapshot = await chatbotRef.once("value");
    const condition = snapshot.val();
    if (!condition) {
      return new Response("No condition found", { status: 404 });
    }
    return new Response(JSON.stringify(condition), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    if (error instanceof Error) {
      return new Response(`Error getting conditions: ${error.message}`, {
        status: 500,
      });
    }
    return new Response("Unknown error occurred", { status: 500 });
  }
};

export const PUT: APIRoute = async ({ request }) => {
  const user = await checkUserAuthentication(request);
  if (!user) {
    return new Response("No token found", { status: 401 });
  }

  try {
    // Get condition ID from URL parameters
    const url = new URL(request.url);
    const conditionId = url.searchParams.get("id");
    if (!conditionId) {
      return new Response("No ID provided", { status: 400 });
    }
    const chatbotRef = getChatbotRef(conditionId);
    const condition = await request.json();
    await chatbotRef.set(condition);
    return new Response(JSON.stringify(condition), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    if (error instanceof Error) {
      return new Response(`Error updating condition: ${error.message}`, {
        status: 500,
      });
    }
    return new Response("Unknown error occurred", { status: 500 });
  }
};

export const DELETE: APIRoute = async ({ request }) => {
  const user = await checkUserAuthentication(request);
  if (!user) {
    return new Response("No token found", { status: 401 });
  }

  try {
    // Get condition ID from URL parameters
    const url = new URL(request.url);
    const conditionId = url.searchParams.get("id");
    if (!conditionId) {
      return new Response("No ID provided", { status: 400 });
    }
    const chatbotRef = getChatbotRef(conditionId);
    await chatbotRef.remove();
    return new Response("Condition deleted successfully", {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    if (error instanceof Error) {
      return new Response(`Error deleting condition: ${error.message}`, {
        status: 500,
      });
    }
    return new Response("Unknown error occurred", { status: 500 });
  }
};

export const POST: APIRoute = async ({ request }) => {
  const user = await checkUserAuthentication(request);
  if (!user) {
    return new Response("No token found", { status: 401 });
  }

  try {
    // Get condition ID from URL parameters
    const url = new URL(request.url);
    const conditionId = url.searchParams.get("id");
    if (!conditionId) {
      return new Response("No ID provided", { status: 400 });
    }
    const chatbotRef = getChatbotRef(conditionId);
    const condition = await request.json();
    await chatbotRef.set(condition);
    return new Response(JSON.stringify(condition), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    if (error instanceof Error) {
      return new Response(`Error creating condition: ${error.message}`, {
        status: 500,
      });
    }
    return new Response("Unknown error occurred", { status: 500 });
  }
};
