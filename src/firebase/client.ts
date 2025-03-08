import { initializeApp } from "firebase/app";
import { FIREBASE_API_KEY } from "astro:env/client";

const firebaseConfig = {
  apiKey: FIREBASE_API_KEY,
  authDomain: "buscador-repositorio.firebaseapp.com",
  databaseURL: "https://buscador-repositorio-default-rtdb.firebaseio.com",
  projectId: "buscador-repositorio",
  storageBucket: "buscador-repositorio.firebasestorage.app",
  messagingSenderId: "412456743324",
  appId: "1:412456743324:web:8f8a969aa41dce98ee1859",
};

export const app = initializeApp(firebaseConfig);
