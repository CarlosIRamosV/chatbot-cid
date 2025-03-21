import axios from "axios";
import { getDatabase } from "firebase-admin/database";
import { app } from "@firebase/server.ts";

// Database references
const getRef = (path: string) => getDatabase(app).ref(`chatbot/${path}`);
const getConditionsRef = () => getRef("conditions");
const getSettingsRef = () => getRef("settings");
const getChatsRef = () => getRef("chats");

// Constants for token management
const TOKEN_REFRESH_INTERVAL = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds

// Interfaces
interface RequestParams {
  params: Record<string, string>;
  request: Request;
}

interface Entry {
  changes: Change[];
}

interface Change {
  value: {
    messages?: Message[];
  };
}

interface ChatMessage {
  text: string;
  timestamp: number;
  isUser: boolean;
  buttonId: string | null;
}

interface Message {
  from: string;
  text?: { body: string };
  interactive?: { button_reply?: { id: string } };
  timestamp?: number;
}

interface Button {
  title: string;
}

interface Condition {
  keywords?: string[];
  text?: string;
  buttons?: Record<string, Button>;
}

interface Conditions {
  [key: string]: Condition;
}

interface Settings {
  verification_token: string;
  phone_number_id: string;
  access_token: {
    accessToken: string;
    updatedAt: string;
  };
  app_id: {
    appId: string;
    updatedAt: string;
  };
  app_secret: {
    appSecret: string;
    updatedAt: string;
  };
}

interface ButtonInfo {
  id: string;
  title: string;
}

// GET endpoint for webhook verification
export async function GET({ request }: RequestParams): Promise<Response> {
  try {
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get("hub.mode");
    const token = searchParams.get("hub.verify_token");
    const challenge = searchParams.get("hub.challenge");

    if (mode === "subscribe") {
      const settings = await getSettingsRef()
        .once("value")
        .then((snap) => snap.val() as Settings);
      if (token === settings.verification_token) {
        return new Response(challenge, { status: 200 });
      }
    }
  } catch (error) {
    console.error("Error during verification:", error);
    return new Response("Error during verification", { status: 500 });
  }
  return new Response("Forbidden", { status: 403 });
}

// POST endpoint for handling webhook messages
export async function POST({
  request,
}: {
  request: Request;
}): Promise<Response> {
  try {
    const data = await request.json();
    const conditions = await getConditionsRef()
      .once("value")
      .then((snap) => snap.val() as Conditions);
    const settings = await getSettingsRef()
      .once("value")
      .then((snap) => snap.val() as Settings);
    const chatsRef = getChatsRef();

    // Check if token needs refreshing
    await checkAndRefreshToken(settings);

    if (!data.entry) return new Response("EVENT_RECEIVED", { status: 200 });

    for (const entry of data.entry as Entry[]) {
      for (const change of entry.changes) {
        const message = change.value?.messages?.[0];
        if (!message) continue;

        const phoneNumber = message.from;
        const text = message.text?.body || "";
        const buttonPayload = message?.interactive?.button_reply?.id;
        const timestamp = Date.now();
        const chatRef = chatsRef.child(phoneNumber);

        // Save user message
        await chatRef.push({
          text: buttonPayload ? `Button: ${buttonPayload}` : text,
          timestamp,
          isUser: true,
          buttonId: buttonPayload || null,
        });

        // Check if bot is enabled
        if (!(await checkIfBotEnabled(phoneNumber))) {
          console.log("Bot is disabled for this phone number.");
          continue;
        }

        let payload;
        let responseText = "";
        let responseButtonId = "";

        // Determine response based on conditions
        if (
          (await checkIfShouldSendDefault(phoneNumber, chatsRef)) &&
          conditions["default"]
        ) {
          // Default welcome message
          const defaultCondition = conditions["default"];
          responseText =
            "¡Bienvenido/a al Centro de Investigación y Docencia (CID)! \nSomos una institución dedicada a la formación de docentes. \n¿En qué podemos ayudarte hoy? \n" +
            (defaultCondition.text ?? "");
          responseButtonId = "default";

          payload = defaultCondition.buttons
            ? createInteractiveMessage(
                phoneNumber,
                responseText,
                Object.entries(defaultCondition.buttons).map(([id, btn]) => ({
                  id,
                  title: btn.title,
                })),
              )
            : createTextMessage(phoneNumber, responseText);
        } else if (buttonPayload && conditions[buttonPayload]) {
          // Button response
          const matchedCondition = conditions[buttonPayload];
          responseText = matchedCondition.text ?? "";
          responseButtonId = buttonPayload;

          payload = matchedCondition.buttons
            ? createInteractiveMessage(
                phoneNumber,
                matchedCondition.text ?? "",
                Object.entries(matchedCondition.buttons).map(([id, btn]) => ({
                  id,
                  title: btn.title,
                })),
              )
            : createTextMessage(phoneNumber, matchedCondition.text ?? "");
        } else {
          // Keyword matching
          let foundMatch = false;

          for (const [conditionId, condition] of Object.entries(conditions)) {
            if (!condition.keywords?.length) continue;

            const keywordMatch = condition.keywords.some((keyword) => {
              const normalizedKeyword = keyword.toLowerCase();
              const normalizedText = text.toLowerCase();
              return (
                normalizedText.includes(normalizedKeyword) ||
                (normalizedKeyword.includes(normalizedText) &&
                  normalizedText.length > 3)
              );
            });

            if (keywordMatch) {
              foundMatch = true;
              responseText = condition.text ?? "";
              responseButtonId = conditionId;

              payload = condition.buttons
                ? createInteractiveMessage(
                    phoneNumber,
                    condition.text ?? "",
                    Object.entries(condition.buttons).map(([id, btn]) => ({
                      id,
                      title: btn.title,
                    })),
                  )
                : createTextMessage(phoneNumber, condition.text ?? "");
              break;
            }
          }

          if (!foundMatch && conditions["default"]) {
            // No match found - fallback
            const defaultCondition = conditions["default"];
            responseText =
              "Lo siento, no entiendo tu mensaje. \n" +
              (defaultCondition.text ?? "");
            responseButtonId = "default";

            payload = defaultCondition.buttons
              ? createInteractiveMessage(
                  phoneNumber,
                  responseText,
                  Object.entries(defaultCondition.buttons).map(([id, btn]) => ({
                    id,
                    title: btn.title,
                  })),
                )
              : createTextMessage(phoneNumber, responseText);
          }
        }

        if (payload) {
          // Save bot response
          await chatRef.push({
            text: responseText,
            timestamp: Date.now(),
            isUser: false,
            buttonId: responseButtonId || null,
          });

          // Get the latest access token in case it was refreshed
          const currentSettings = await getSettingsRef()
            .once("value")
            .then((snap) => snap.val() as Settings);

          await sendMessage(
            payload,
            currentSettings.phone_number_id,
            currentSettings.access_token.accessToken,
          );
        }
      }
    }

    return new Response("EVENT_RECEIVED", { status: 200 });
  } catch (error: unknown) {
    console.error("Error processing webhook:", error);
    return new Response("Error processing webhook", { status: 500 });
  }
}

// Helper function to check and refresh token if needed
async function checkAndRefreshToken(settings: Settings): Promise<void> {
  try {
    const accessTokenData = settings.access_token;
    if (!accessTokenData || !accessTokenData.updatedAt) return;

    const updatedAt = new Date(accessTokenData.updatedAt).getTime();
    const needsRefresh = Date.now() - updatedAt > TOKEN_REFRESH_INTERVAL;

    if (needsRefresh) {
      console.log("Access token needs refreshing, attempting to refresh...");

      // Request new token from Meta Graph API (would require implementation)
      // This is a placeholder for the actual token refresh logic
      const newToken = await refreshMetaToken(
        accessTokenData.accessToken,
        settings,
      );

      if (newToken) {
        // Save the new token to database
        await getSettingsRef().child("access_token").set({
          accessToken: newToken,
          updatedAt: new Date().toISOString(),
        });
        console.log("Access token refreshed successfully");
      }
    }
  } catch (error) {
    console.error("Error checking or refreshing token:", error);
  }
}

// Placeholder function for token refresh implementation
async function refreshMetaToken(
  currentToken: string,
  settings: Settings,
): Promise<string | null> {
  try {
    if (!settings.app_id?.appId || !settings.app_secret?.appSecret) {
      console.error(
        "Missing required authentication details for token refresh",
      );
      return null;
    }

    const response = await axios.get(
      `https://graph.facebook.com/v22.0/oauth/access_token`,
      {
        params: {
          grant_type: "fb_exchange_token",
          client_id: settings.app_id.appId,
          client_secret: settings.app_secret.appSecret,
          fb_exchange_token: currentToken,
        },
      },
    );

    if (response.data && response.data.access_token) {
      return response.data.access_token;
    }

    return null;
  } catch (error) {
    console.error("Failed to refresh Meta token:", error);
    return null;
  }
}

// Helper functions
function createInteractiveMessage(
  to: string,
  body: string,
  buttons: ButtonInfo[],
) {
  return {
    messaging_product: "whatsapp",
    to,
    type: "interactive",
    interactive: {
      type: "button",
      body: { text: body },
      action: {
        buttons: buttons.map((btn) => ({
          type: "reply",
          reply: {
            id: btn.id,
            title:
              btn.title.length > 20 ? btn.title.substring(0, 20) : btn.title,
          },
        })),
      },
    },
  };
}

function createTextMessage(to: string, text: string) {
  return {
    messaging_product: "whatsapp",
    to,
    type: "text",
    text: { body: text },
  };
}

async function checkIfBotEnabled(phoneNumber: string): Promise<boolean> {
  try {
    const statusRef = getDatabase(app).ref(`chatbot/bot-status/${phoneNumber}`);
    const status = await statusRef.once("value").then((snap) => snap.val());

    if (!status) return true;
    if (status.enabled === false) {
      if (status.expiration && status.expiration < Date.now()) {
        await statusRef.update({ enabled: true, expiration: null });
        return true;
      }
      return false;
    }
    return true;
  } catch (error: unknown) {
    console.error("Error checking bot status:", error);
    return true;
  }
}

async function checkIfShouldSendDefault(
  phoneNumber: string,
  chatsRef: any,
): Promise<boolean> {
  try {
    const snapshot = await chatsRef
      .child(phoneNumber)
      .orderByChild("timestamp")
      .limitToLast(2)
      .once("value");

    const chatData = snapshot.val();
    if (!chatData) return true;

    const messages = Object.values(chatData) as ChatMessage[];

    if (messages.length === 1 && messages[0].isUser) return true;

    if (messages.length >= 2) {
      const sortedMessages = messages.sort(
        (a: ChatMessage, b: ChatMessage) => a.timestamp - b.timestamp,
      );
      const lastUserMsg = sortedMessages.findLast(
        (msg: ChatMessage) => msg.isUser,
      );
      const lastBotMsg = sortedMessages.findLast(
        (msg: ChatMessage) => !msg.isUser,
      );

      if (lastBotMsg && lastBotMsg.buttonId !== "default") {
        const twelveHoursInMs = 12 * 60 * 60 * 1000;
        return (
          Date.now() -
            Math.max(lastUserMsg?.timestamp || 0, lastBotMsg.timestamp) >
          twelveHoursInMs
        );
      }

      return lastBotMsg?.buttonId !== "default";
    }

    return true;
  } catch (error: unknown) {
    console.error("Error checking chat history:", error);
    return true;
  }
}

async function sendMessage(
  payload: any,
  phoneNumberId: string,
  accessToken: string,
): Promise<void> {
  try {
    await axios.post(
      `https://graph.facebook.com/v22.0/${phoneNumberId}/messages`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      },
    );
  } catch (error: unknown) {
    const err = error as any;
    console.error(
      "Error al enviar mensaje:",
      err.response?.data || (err instanceof Error ? err.message : String(err)),
    );
  }
}
