import axios from "axios";
import { getDatabase } from "firebase-admin/database";
import { app } from "@firebase/server.ts";

// Database references
const getRef = (path: string) => getDatabase(app).ref(`chatbot/${path}`);
const getConditionsRef = () => getRef("conditions");
const getSettingsRef = () => getRef("settings");
const getChatsRef = () => getRef("chats");

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
  access_token: string;
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

          await sendMessage(
            payload,
            settings.phone_number_id,
            settings.access_token,
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
      .limitToLast(1)
      .once("value");

    const chatData = snapshot.val();
    // If no chat data exists, this is a new user - send default message
    if (!chatData) return true;

    const lastMessageKey = Object.keys(chatData)[0];
    const lastMessage = chatData[lastMessageKey];
    const lastMessageTime = lastMessage.timestamp;
    const twelveHoursInMs = 12 * 60 * 60 * 1000;

    // Send default if last message was over 12 hours ago
    // OR if the last message was from the user (not the bot)
    return Date.now() - lastMessageTime > twelveHoursInMs || lastMessage.isUser;
  } catch (error: unknown) {
    console.error("Error checking chat history:", error);
    // On error, default to true to ensure users get a response
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
