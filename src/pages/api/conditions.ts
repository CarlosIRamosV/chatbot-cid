import type { APIRoute } from "astro";
import { getDatabase } from "firebase-admin/database";
import { app } from "@firebase/server.ts";
import { checkUserAuthentication } from "@utils/auth.ts";

const getChatbotRef = (id: string | null) => {
  const db = getDatabase(app);
  return id ? db.ref(`chatbot/conditions/${id}`) : db.ref("chatbot/conditions");
};

const handleAuth = async (request: Request) => {
  const user = await checkUserAuthentication(request);
  if (!user) {
    return new Response("No token found", { status: 401 });
  }
  return null;
};

const handleError = (error: unknown) => {
  const message =
    error instanceof Error ? error.message : "Unknown error occurred";
  const status = 500;
  return new Response(error instanceof Error ? `Error: ${message}` : message, {
    status,
  });
};

const createOrUpdateCondition = async (request: Request) => {
  try {
    const url = new URL(request.url);
    const conditionId = url.searchParams.get("id");

    if (!conditionId) {
      return new Response("No ID provided", { status: 400 });
    }

    const condition = await request.json();
    await getChatbotRef(conditionId).set(condition);

    return new Response(JSON.stringify(condition), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return handleError(error);
  }
};

export const GET: APIRoute = async ({ request }) => {
  const authError = await handleAuth(request);
  if (authError) return authError;

  try {
    const url = new URL(request.url);
    const conditionId = url.searchParams.get("id");
    const snapshot = await getChatbotRef(conditionId).once("value");
    const condition = snapshot.val();

    if (!condition) {
      return new Response("No condition found", { status: 404 });
    }

    return new Response(JSON.stringify(condition), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return handleError(error);
  }
};

export const PUT: APIRoute = async ({ request }) => {
  const authError = await handleAuth(request);
  if (authError) return authError;
  return createOrUpdateCondition(request);
};

export const DELETE: APIRoute = async ({ request }) => {
  const authError = await handleAuth(request);
  if (authError) return authError;

  try {
    const url = new URL(request.url);
    const conditionId = url.searchParams.get("id");

    if (!conditionId) {
      return new Response("No ID provided", { status: 400 });
    }

    await getChatbotRef(conditionId).remove();

    return new Response("Condition deleted successfully", {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return handleError(error);
  }
};

export const POST: APIRoute = async ({ request }) => {
  const authError = await handleAuth(request);
  if (authError) return authError;
  return createOrUpdateCondition(request);
};
