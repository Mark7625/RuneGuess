import { NextRequest, NextResponse } from "next/server";
import {
  getTokenFromRequest,
  verifySessionToken,
  getUserById,
  userToPublic,
} from "@/lib/auth";
import { getDb, USERS_COLLECTION, type DbUser } from "@/lib/db";
import type { ObjectId } from "mongodb";

const MIN_LEN = 2;
const MAX_LEN = 24;
const VALID = /^[a-zA-Z0-9_-]+$/;

export async function POST(req: NextRequest) {
  const token = getTokenFromRequest(req);
  if (!token) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }
  const session = await verifySessionToken(token);
  if (!session) {
    return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  }

  let body: { username?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const raw = body.username;
  if (typeof raw !== "string") {
    return NextResponse.json({ error: "Missing username" }, { status: 400 });
  }
  const username = raw.trim();
  if (username.length < MIN_LEN || username.length > MAX_LEN) {
    return NextResponse.json(
      { error: `Username must be ${MIN_LEN}-${MAX_LEN} characters` },
      { status: 400 }
    );
  }
  if (!VALID.test(username)) {
    return NextResponse.json(
      { error: "Username can only contain letters, numbers, underscore and hyphen" },
      { status: 400 }
    );
  }

  const db = await getDb();
  if (!db) {
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  }

  const collection = db.collection<DbUser>(USERS_COLLECTION);
  const existing = await collection.findOne({ displayUsername: username });
  if (existing) {
    const currentId = String((existing as DbUser & { _id: ObjectId })._id);
    if (currentId !== session.userId) {
      return NextResponse.json({ error: "Username already taken" }, { status: 409 });
    }
    const user = await getUserById(session.userId);
    return user
      ? NextResponse.json({ user: userToPublic(user as DbUser & { _id: unknown }) })
      : NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const { ObjectId } = await import("mongodb");
  let id: ObjectId;
  try {
    id = new ObjectId(session.userId);
  } catch {
    return NextResponse.json({ error: "Invalid user" }, { status: 400 });
  }
  const result = await collection.findOneAndUpdate(
    { _id: id },
    { $set: { displayUsername: username } },
    { returnDocument: "after" }
  );
  const updated = result ?? (await collection.findOne({ _id: id }));
  if (!updated) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  return NextResponse.json({
    user: userToPublic(updated as DbUser & { _id: unknown }),
  });
}
