import type { APIRoute } from "astro";
import { getDatabase } from "firebase-admin/database";
import { app } from "@firebase/server.ts";
import { checkUserAuthentication } from "@utils/auth.ts";

const getEmailsWhitelistRef = () => {
  const db = getDatabase(app);
  return db.ref("chatbot/settings/emails_whitelist");
};

const validateEmail = (email: string) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const GET: APIRoute = async ({ request }) => {
  const user = await checkUserAuthentication(request);
  if (!user) {
    return new Response("No token found", { status: 401 });
  }

  try {
    const emailsWhitelistRef = getEmailsWhitelistRef();
    const snapshot = await emailsWhitelistRef.once("value");
    const emailsWhitelist = snapshot.val();
    if (!emailsWhitelist) {
      return new Response("No emails found", { status: 404 });
    }
    return new Response(JSON.stringify(emailsWhitelist), { status: 200 });
  } catch (error) {
    if (error instanceof Error) {
      return new Response(`Error getting emails: ${error.message}`, {
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
    const { email } = await request.json();
    if (!email || !validateEmail(email)) {
      return new Response("Valid email is required", { status: 400 });
    }

    const emailsWhitelistRef = getEmailsWhitelistRef();
    const snapshot = await emailsWhitelistRef.once("value");
    const emailsWhitelist = snapshot.val() || [];

    if (emailsWhitelist.includes(email)) {
      return new Response("Email already exists", { status: 409 });
    }

    emailsWhitelist.push(email);
    await emailsWhitelistRef.set(emailsWhitelist);

    return new Response("Email added successfully", { status: 201 });
  } catch (error) {
    if (error instanceof Error) {
      return new Response(`Error adding email: ${error.message}`, {
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
    const { email } = await request.json();
    if (!email || !validateEmail(email)) {
      return new Response("Valid email is required", { status: 400 });
    }

    const emailsWhitelistRef = getEmailsWhitelistRef();
    const snapshot = await emailsWhitelistRef.once("value");
    const emailsWhitelist = snapshot.val();
    if (!emailsWhitelist || !emailsWhitelist.includes(email)) {
      return new Response("Email not found", { status: 404 });
    }
    await emailsWhitelistRef.set(
      emailsWhitelist.filter((e: string) => e !== email),
    );

    return new Response("Email removed successfully", { status: 200 });
  } catch (error) {
    if (error instanceof Error) {
      return new Response(`Error removing email: ${error.message}`, {
        status: 500,
      });
    }
    return new Response("Unknown error occurred", { status: 500 });
  }
};
