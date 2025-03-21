import type { APIRoute } from "astro";
import { getDatabase } from "firebase-admin/database";
import { app } from "@firebase/server.ts";
import { checkUserAuthentication } from "@utils/auth.ts";

const getPhoneNumberIdRef = () =>
  getDatabase(app).ref("chatbot/settings/phone_number_id");

export const GET: APIRoute = async ({ request }) => {
  const user = await checkUserAuthentication(request);
  if (!user) return new Response("No token found", { status: 401 });

  try {
    const snapshot = await getPhoneNumberIdRef().once("value");
    const phoneNumberId = snapshot.val() || "";

    if (!phoneNumberId) await getPhoneNumberIdRef().set("");

    return new Response(JSON.stringify(phoneNumberId), { status: 200 });
  } catch (error) {
    console.error("Error getting phone number ID:", error);
    return new Response("Error getting phone number ID", { status: 500 });
  }
};

export const PUT: APIRoute = async ({ request }) => {
  const user = await checkUserAuthentication(request);
  if (!user) return new Response("No token found", { status: 401 });

  try {
    const { phoneNumberId } = await request.json();
    if (!phoneNumberId)
      return new Response("Phone number ID is required", { status: 400 });

    await getPhoneNumberIdRef().set(phoneNumberId);
    return new Response("Phone number ID updated successfully", {
      status: 200,
    });
  } catch (error) {
    console.error("Error updating phone number ID:", error);
    return new Response("Error updating phone number ID", { status: 500 });
  }
};
