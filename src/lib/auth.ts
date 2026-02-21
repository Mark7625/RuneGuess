import { SignJWT, jwtVerify } from "jose";
import { OAuth2Client } from "google-auth-library";
import type { NextRequest } from "next/server";

const JWT_SECRET = process.env.JWT_SECRET ?? "";
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID ?? process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";
const COOKIE_NAME = "runeguess_session";
const JWT_EXPIRY_DAYS = 30;

export function getCookieName() {
  return COOKIE_NAME;
}

export function getTokenFromRequest(req: NextRequest): string | null {
  const cookie = req.cookies.get(COOKIE_NAME);
  return cookie?.value ?? null;
}

export async function verifySessionToken(token: string): Promise<{ userId: string } | null> {
  if (!JWT_SECRET) return null;
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(JWT_SECRET));
    const sub = payload.sub;
    if (typeof sub !== "string") return null;
    return { userId: sub };
  } catch {
    return null;
  }
}

export async function createSessionToken(userId: string): Promise<string> {
  const secret = new TextEncoder().encode(JWT_SECRET);
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${JWT_EXPIRY_DAYS}d`)
    .sign(secret);
}

export interface GoogleTokenPayload {
  sub: string;
  email?: string;
  name?: string;
  picture?: string;
}

export async function verifyGoogleToken(idToken: string): Promise<GoogleTokenPayload | null> {
  if (!GOOGLE_CLIENT_ID) return null;
  const client = new OAuth2Client(GOOGLE_CLIENT_ID);
  try {
    const ticket = await client.verifyIdToken({ idToken, audience: GOOGLE_CLIENT_ID });
    const payload = ticket.getPayload();
    if (!payload?.sub) return null;
    return {
      sub: payload.sub,
      email: payload.email ?? undefined,
      name: payload.name ?? undefined,
      picture: payload.picture ?? undefined,
    };
  } catch {
    return null;
  }
}
