// @ts-check
import { defineConfig, envField } from "astro/config";
import vercel from "@astrojs/vercel";
import tailwindcss from "@tailwindcss/vite";

import react from "@astrojs/react";

// https://astro.build/config
export default defineConfig({
  adapter: vercel(),
  output: "server",

  env: {
    schema: {
      FIREBASE_API_KEY: envField.string({
        context: "server",
        access: "secret",
      }),

      FIREBASE_DATABASE_URL: envField.string({
        context: "server",
        access: "secret",
        default: "https://buscador-repositorio-default-rtdb.firebaseio.com",
      }),

      FIREBASE_PROJECT_ID: envField.string({
        context: "server",
        access: "secret",
        default: "buscador-repositorio",
      }),

      FIREBASE_PRIVATE_KEY_ID: envField.string({
        context: "server",
        access: "secret",
        default: "default",
      }),
      FIREBASE_PRIVATE_KEY: envField.string({
        context: "server",
        access: "secret",
        default: "default",
      }),
      FIREBASE_CLIENT_EMAIL: envField.string({
        context: "server",
        access: "secret",
        default:
          "firebase-adminsdk-fbsvc@buscador-repositorio.iam.gserviceaccount.com",
      }),
      FIREBASE_CLIENT_ID: envField.string({
        context: "server",
        access: "secret",
        default: "101688680656103826793",
      }),
      FIREBASE_AUTH_URI: envField.string({
        context: "server",
        access: "secret",
        default: "https://accounts.google.com/o/oauth2/auth",
      }),
      FIREBASE_TOKEN_URI: envField.string({
        context: "server",
        access: "secret",
        default: "https://oauth2.googleapis.com/token",
      }),
      FIREBASE_AUTH_CERT_URL: envField.string({
        context: "server",
        access: "secret",
        default: "https://www.googleapis.com/oauth2/v1/certs",
      }),
      FIREBASE_CLIENT_CERT_URL: envField.string({
        context: "server",
        access: "secret",
        default:
          "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc%40buscador-repositorio.iam.gserviceaccount.com",
      }),
    },
  },

  vite: {
    plugins: [tailwindcss()],
  },

  integrations: [react()],
});
