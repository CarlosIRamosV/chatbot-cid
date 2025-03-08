import type { APIRoute } from "astro";
import { getDatabase } from "firebase-admin/database";
import { app } from "@firebase/server.ts";
import { checkUserAuthentication } from "@utils/auth.ts";

const getChatbotRef = (id: string) => {
  const db = getDatabase(app);
  return db.ref("chatbot/conditions").child(id);
};

export const GET: APIRoute = async ({ params, request }) => {
  const user = await checkUserAuthentication(request);
  if (!user) {
    return new Response("No token found", { status: 401 });
  }

  try {
    if (!params.id) {
      return new Response("No ID provided", { status: 400 });
    }
    const chatbotRef = getChatbotRef(params.id);
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

export const PUT: APIRoute = async ({ params, request }) => {
  const user = await checkUserAuthentication(request);
  if (!user) {
    return new Response("No token found", { status: 401 });
  }

  try {
    if (!params.id) {
      return new Response("No ID provided", { status: 400 });
    }
    const chatbotRef = getChatbotRef(params.id);
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

export const DELETE: APIRoute = async ({ params, request }) => {
  const user = await checkUserAuthentication(request);
  if (!user) {
    return new Response("No token found", { status: 401 });
  }

  try {
    if (!params.id) {
      return new Response("No ID provided", { status: 400 });
    }
    const chatbotRef = getChatbotRef(params.id);
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

export const POST: APIRoute = async ({ params, request }) => {
  const user = await checkUserAuthentication(request);
  if (!user) {
    return new Response("No token found", { status: 401 });
  }

  try {
    if (!params.id) {
      return new Response("No ID provided", { status: 400 });
    }
    const chatbotRef = getChatbotRef(params.id);
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
