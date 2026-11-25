import { createHash, timingSafeEqual } from "node:crypto";
import { databaseConfigured } from "@/db";
import { HttpError } from "@/lib/http";

/**
 * Gomnee authenticates with the key this site issues: GOMNEE_PUBLISHING_TOKEN,
 * at least 32 random characters (openssl rand -hex 32). The owner pastes it
 * into Gomnee once; it never appears in Git or in the browser.
 */
export const MINIMUM_TOKEN_LENGTH = 32;

function matches(received: string, expected: string) {
  if (received.length > 1024) return false;
  return timingSafeEqual(
    createHash("sha256").update(received).digest(),
    createHash("sha256").update(expected).digest(),
  );
}

export function requirePublisher(request: Request) {
  const expected = process.env.GOMNEE_PUBLISHING_TOKEN;
  if (!expected || expected.length < MINIMUM_TOKEN_LENGTH || !databaseConfigured())
    throw new HttpError(503, "Publishing is not configured: set GOMNEE_PUBLISHING_TOKEN and DATABASE_URL.");
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ") || !matches(authorization.slice(7), expected))
    throw new HttpError(401, "Publishing authorization required.");
}
