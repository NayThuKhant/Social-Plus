import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import { prisma } from "./prisma";

const JWT_SECRET = process.env.JWT_SECRET || "changeme";
const COOKIE_NAME = "social_token";
const SESSION_DURATION = 30 * 24 * 60 * 60 * 1000; // 30 days

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function signToken(payload: { sessionId: string }): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "30d" });
}

export function verifyToken(token: string): { sessionId: string } | null {
  try {
    return jwt.verify(token, JWT_SECRET) as { sessionId: string };
  } catch {
    return null;
  }
}

export async function createSession(userId: string): Promise<string> {
  const expiresAt = new Date(Date.now() + SESSION_DURATION);
  const session = await prisma.session.create({
    data: { userId, token: crypto.randomUUID(), expiresAt },
  });
  return signToken({ sessionId: session.id });
}

export async function getSessionUser(token: string) {
  const payload = verifyToken(token);
  if (!payload) return null;

  const session = await prisma.session.findUnique({
    where: { id: payload.sessionId },
    include: { user: true },
  });

  if (!session || session.expiresAt < new Date()) return null;
  return session.user;
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return getSessionUser(token);
}

export async function deleteSession(token: string): Promise<void> {
  const payload = verifyToken(token);
  if (!payload) return;
  await prisma.session.delete({ where: { id: payload.sessionId } }).catch(() => {});
}

export { COOKIE_NAME };
