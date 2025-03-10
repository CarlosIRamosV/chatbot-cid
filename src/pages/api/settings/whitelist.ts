import type { APIRoute } from "astro";
import { getDatabase } from "firebase-admin/database";
import { app } from "@firebase/server.ts";
import { checkUserAuthentication } from "@utils/auth.ts";

const getEmailsWhitelistRef = () =>
  getDatabase(app).ref("chatbot/settings/emails_whitelist");
const validateEmail = (email: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const handleError = (error: unknown, action: string): Response => {
  const message = error instanceof Error ? error.message : "Unknown error";
  return new Response(`Error ${action}: ${message}`, { status: 500 });
};

export const GET: APIRoute = async ({ request }) => {
  const user = await checkUserAuthentication(request);
  if (!user) return new Response("No token found", { status: 401 });

  try {
    const snapshot = await getEmailsWhitelistRef().once("value");
    const emailsWhitelist = snapshot.val();

    if (!emailsWhitelist)
      return new Response("No emails found", { status: 404 });

    return new Response(JSON.stringify(emailsWhitelist), { status: 200 });
  } catch (error) {
    return handleError(error, "getting emails");
  }
};

export const POST: APIRoute = async ({ request }) => {
  const user = await checkUserAuthentication(request);
  if (!user) return new Response("No token found", { status: 401 });

  try {
    const { email } = await request.json();
    if (!email || !validateEmail(email))
      return new Response("Valid email is required", { status: 400 });

    const snapshot = await getEmailsWhitelistRef().once("value");
    const emailsWhitelist = snapshot.val() || [];

    if (emailsWhitelist.includes(email))
      return new Response("Email already exists", { status: 409 });

    emailsWhitelist.push(email);
    await getEmailsWhitelistRef().set(emailsWhitelist);

    return new Response("Email added successfully", { status: 201 });
  } catch (error) {
    return handleError(error, "adding email");
  }
};

export const DELETE: APIRoute = async ({ request }) => {
  const user = await checkUserAuthentication(request);
  if (!user) return new Response("No token found", { status: 401 });

  try {
    const { email } = await request.json();
    if (!email || !validateEmail(email))
      return new Response("Valid email is required", { status: 400 });

    const snapshot = await getEmailsWhitelistRef().once("value");
    const emailsWhitelist = snapshot.val();

    if (!emailsWhitelist || !emailsWhitelist.includes(email))
      return new Response("Email not found", { status: 404 });

    await getEmailsWhitelistRef().set(
      emailsWhitelist.filter((e: string) => e !== email),
    );

    return new Response("Email removed successfully", { status: 200 });
  } catch (error) {
    return handleError(error, "removing email");
  }
};
