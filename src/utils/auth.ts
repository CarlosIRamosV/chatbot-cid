import { getAuth } from "firebase-admin/auth";
import { app } from "../firebase/server";

export async function checkUserAuthentication(request: Request) {
  const cookie = request.headers.get("cookie");
  if (!cookie) {
    return null;
  }

  const auth = getAuth(app);
  const token = cookie.split("=")[1];
  const user = await auth.verifySessionCookie(token, true).catch((error) => {
    console.log(error);
    return null;
  });

  if (!user) {
    return null;
  }

  return user;
}
