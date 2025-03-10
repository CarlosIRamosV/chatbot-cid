import axios from "axios";
import { getDatabase } from "firebase-admin/database";
import { app } from "@firebase/server.ts";

const getConditionsRef = () => {
  const db = getDatabase(app);
  return db.ref("chatbot/conditions");
};

const getSettingsRef = () => {
  const db = getDatabase(app);
  return db.ref("chatbot/settings");
};

// New function to get chats reference
const getChatsRef = () => {
  const db = getDatabase(app);
  return db.ref("chatbot/chats");
};

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
  text?: {
    body: string;
  };
  interactive?: {
    button_reply?: {
      id: string;
    };
  };
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

/**
 * Handles the verification of the webhook subscription.
 *
 * @param {RequestParams} request - The incoming request object.
 * @returns {Promise<Response>} - A promise that resolves to a Response object.
 */
export async function GET({ request }: RequestParams): Promise<Response> {
  try {
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get("hub.mode");
    const token = searchParams.get("hub.verify_token");
    const challenge = searchParams.get("hub.challenge");

    if (mode === "subscribe") {
      const settingsRef = getSettingsRef();
      const snapshot = await settingsRef.once("value");
      const data = snapshot.val() as Settings;
      if (token === data.verification_token) {
        return new Response(challenge, { status: 200 });
      }
    }
  } catch (error) {
    console.error("Error during verification:", error);
    return new Response("Error during verification", { status: 500 });
  }
  return new Response("Forbidden", { status: 403 });
}

/**
 * Handles incoming webhook events from WhatsApp Business API.
 *
 * @param {Request} request - The incoming request object.
 * @returns {Promise<Response>} - A promise that resolves to a Response object.
 */
export async function POST({
  request,
}: {
  request: Request;
}): Promise<Response> {
  const data = await request.json();

  try {
    const conditionsRef = getConditionsRef();
    const snapshot = await conditionsRef.once("value");
    const conditionsData = snapshot.val() as Conditions;
    const settingsRef = getSettingsRef();
    const settingsSnapshot = await settingsRef.once("value");
    const settingsData = settingsSnapshot.val() as Settings;
    const chatsRef = getChatsRef();

    if (data.entry) {
      for (const entry of data.entry as Entry[]) {
        for (const change of entry.changes) {
          const message = change.value?.messages?.[0];

          if (message) {
            const phoneNumber = message.from;
            const text = message.text?.body || "";
            const buttonPayload = message?.interactive?.button_reply?.id;
            console.log("buttonPayload recibido:", buttonPayload);
            let payload;
            let responseText = "";
            let responseButtonId = "";

            // Save user message to chat history
            const timestamp = Date.now();
            const chatMessageRef = chatsRef.child(phoneNumber);

            await chatMessageRef.push({
              text: buttonPayload ? `Button: ${buttonPayload}` : text,
              timestamp,
              isUser: true,
              buttonId: buttonPayload || null,
            });

            // Access the conditions data
            console.log("Conditions keys:", Object.keys(conditionsData));

            // First check if we have a direct button match (higher priority)
            if (buttonPayload && conditionsData[buttonPayload]) {
              console.log(`Found button match for payload: ${buttonPayload}`);
              const matchedCondition = conditionsData[buttonPayload];

              if (matchedCondition.text) {
                responseText = matchedCondition.text;
                responseButtonId = buttonPayload;

                if (matchedCondition.buttons) {
                  // Create interactive response with buttons
                  const buttons = Object.entries(matchedCondition.buttons).map(
                    ([id, buttonData]: [string, Button]) => ({
                      id,
                      title: buttonData.title,
                    }),
                  );

                  payload = createInteractiveMessage(
                    phoneNumber,
                    matchedCondition.text,
                    buttons,
                  );
                } else {
                  // Simple text response
                  payload = createTextMessage(
                    phoneNumber,
                    matchedCondition.text,
                  );
                }
              }
            } else {
              // Check for keyword matches
              let foundMatch = false;
              console.log(`Checking for keyword match with text: "${text}"`);

              for (const [
                conditionId,
                conditionData,
              ] of Object.entries<Condition>(conditionsData)) {
                if (
                  conditionData.keywords &&
                  Array.isArray(conditionData.keywords)
                ) {
                  console.log(
                    `Condition ${conditionId} has keywords:`,
                    conditionData.keywords,
                  );

                  const keywordMatch = conditionData.keywords.some(
                    (keyword: string) => {
                      const normalizedKeyword = keyword.toLowerCase();
                      const normalizedText = text.toLowerCase();
                      const match =
                        normalizedText.includes(normalizedKeyword) ||
                        (normalizedKeyword.includes(normalizedText) &&
                          normalizedText.length > 3);

                      if (match) {
                        console.log(`Match found with keyword: ${keyword}`);
                      }

                      return match;
                    },
                  );

                  if (keywordMatch) {
                    foundMatch = true;

                    if (conditionData.text) {
                      responseText = conditionData.text;
                      responseButtonId = conditionId;

                      if (conditionData.buttons) {
                        // Create interactive response with buttons
                        const buttons = Object.entries(
                          conditionData.buttons,
                        ).map(([id, buttonData]: [string, Button]) => ({
                          id,
                          title: buttonData.title,
                        }));
                        payload = createInteractiveMessage(
                          phoneNumber,
                          conditionData.text,
                          buttons,
                        );
                      } else {
                        // Simple text response
                        payload = createTextMessage(
                          phoneNumber,
                          conditionData.text,
                        );
                      }
                    }
                    break;
                  }
                }
              }

              if (!foundMatch) {
                console.log("No match found, using default condition");

                // Use the default condition if it exists
                if (conditionsData["default"]) {
                  const defaultCondition = conditionsData["default"];

                  if (defaultCondition.text) {
                    responseText = defaultCondition.text;
                    responseButtonId = "default";

                    if (defaultCondition.buttons) {
                      // Create interactive response with buttons
                      const buttons = Object.entries(
                        defaultCondition.buttons,
                      ).map(([id, buttonData]: [string, Button]) => ({
                        id,
                        title: buttonData.title,
                      }));
                      payload = createInteractiveMessage(
                        phoneNumber,
                        defaultCondition.text,
                        buttons,
                      );
                    } else {
                      // Simple text response
                      payload = createTextMessage(
                        phoneNumber,
                        defaultCondition.text,
                      );
                    }
                  }
                }
              }
            }

            if (payload) {
              console.log(
                "Sending message payload:",
                JSON.stringify(payload, null, 2),
              );

              // Save bot response to chat history
              await chatMessageRef.push({
                text: responseText,
                timestamp: Date.now(),
                isUser: false,
                buttonId: responseButtonId || null,
              });

              await sendMessage(
                payload,
                settingsData.phone_number_id,
                settingsData.access_token,
              );
            }
          }
        }
      }
    }
  } catch (error) {
    console.error("Error processing webhook:", error);
    return new Response("Error processing webhook", { status: 500 });
  }
  return new Response("EVENT_RECEIVED", { status: 200 });
}

/**
 * Creates an interactive message payload for the WhatsApp Business API.
 *
 * @param {string} to - The recipient's phone number.
 * @param {string} body - The message body text.
 * @param {Array<{ id: string; title: string }>} buttons - An array of button objects.
 * @returns {Record<string, any>} - The message payload.
 */
function createInteractiveMessage(
  to: string,
  body: string,
  buttons: {
    id: string;
    title: string;
  }[],
): Record<string, any> {
  return {
    messaging_product: "whatsapp",
    to,
    type: "interactive",
    interactive: {
      type: "button",
      body: { text: body },
      action: {
        buttons: buttons.map((buttonData) => ({
          type: "reply",
          reply: {
            id: buttonData.id,
            title:
              buttonData.title.length > 20
                ? buttonData.title.substring(0, 20)
                : buttonData.title,
          },
        })),
      },
    },
  };
}

/**
 * Creates a text message payload for the WhatsApp Business API.
 *
 * @param {string} to - The recipient's phone number.
 * @param {string} text - The message text.
 * @returns {Record<string, any>} - The message payload.
 */
function createTextMessage(to: string, text: string): Record<string, any> {
  return {
    messaging_product: "whatsapp",
    to,
    type: "text",
    text: { body: text },
  };
}

/**
 * Sends a message using the WhatsApp Business API.
 *
 * @param {Record<string, any>} payload - The message payload to send.
 * @param {string} facebookPhoneNumberId - The phone number ID for the WhatsApp Business account.
 * @param {string} facebookAccessToken - The access token for the WhatsApp Business API.
 * @returns {Promise<void>} - A promise that resolves when the message is sent.
 */
async function sendMessage(
  payload: Record<string, any>,
  facebookPhoneNumberId: string,
  facebookAccessToken: string,
): Promise<void> {
  const url = `https://graph.facebook.com/v22.0/${facebookPhoneNumberId}/messages`;

  try {
    await axios.post(url, payload, {
      headers: {
        Authorization: `Bearer ${facebookAccessToken}`,
        "Content-Type": "application/json",
      },
    });
  } catch (error: any) {
    console.error(
      "Error al enviar mensaje:",
      error.response?.data || error.message,
    );
  }
}
