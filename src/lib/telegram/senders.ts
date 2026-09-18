/**
 * Telegram sender identity + bot-settings lookups.
 * Database access only — no Telegram network calls.
 * Extracted verbatim from the webhook route.
 */
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { NextRequest } from "next/server";

export function displayNameFromTelegramUser(from: { first_name?: string; last_name?: string }) {
  return [from.first_name, from.last_name].filter(Boolean).join(" ");
}
export function normalizeCustomerName(name: string): string {
  return name.toLowerCase().replace(/\s+/g, ' ').trim();
}
export function isPrismaUniqueConstraintError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}
export async function createTelegramMessageIfNew({
  telegramMsgId,
  text,
  senderId,
  chatId,
  chatTitle,
  receivedAt,
}: {
  telegramMsgId: number;
  text: string;
  senderId: string;
  chatId: bigint;
  chatTitle: string | null;
  receivedAt: Date;
}) {
  try {
    return await prisma.telegramMessage.create({
      data: {
        telegramMsgId,
        text,
        senderId,
        chatId,
        chatTitle,
        receivedAt,
      },
    });
  } catch (error) {
    if (isPrismaUniqueConstraintError(error)) {
      console.info(`Duplicate Telegram message ignored: ${telegramMsgId}`);
      return null;
    }
    throw error;
  }
}
export async function getActiveBotSettings(req: NextRequest) {
  const secret = req.headers.get('x-telegram-bot-api-secret-token');
  if (!secret) return null;

  // Each configured bot has a distinct Telegram webhook secret. Never fall
  // back to an arbitrary active bot: a request without a valid secret is not
  // a Telegram webhook request.
  return prisma.botSettings.findFirst({
    where: { isActive: true, webhookSecret: secret },
    select: {
      userId: true,
      botToken: true,
      geminiApiKey: true,
      geminiModel: true,
    },
  });
}
export async function upsertSender(from: {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
}, ownerUserId: string | null | undefined) {
  const displayName = displayNameFromTelegramUser(from);

  const existing = await prisma.telegramSender.findFirst({
    where: {
      telegramUserId: BigInt(from.id),
      userId: ownerUserId || null,
    },
  });

  if (!existing) {
    return prisma.telegramSender.create({
      data: {
        telegramUserId: BigInt(from.id),
        firstName: from.first_name || "Unknown",
        lastName: from.last_name || null,
        username: from.username || null,
        displayName: displayName || "Unknown",
        messageCount: 0,
        lastMessageAt: null,
        activeReportType: 'none',
        userId: ownerUserId || null,
      },
    });
  }

  return prisma.telegramSender.update({
    where: { id: existing.id },
    data: {
      firstName: from.first_name || "Unknown",
      lastName: from.last_name || null,
      username: from.username || null,
      displayName: displayName || "Unknown",
      ...(ownerUserId ? { userId: ownerUserId } : {}),
    },
  });
}
