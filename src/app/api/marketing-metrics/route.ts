import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notDeleted, softDeleteData } from "@/lib/soft-delete";
import { ownedByUserOrAdmin } from "@/lib/tenant-scope";
import { marketingMetricSchema } from "@/lib/validations";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const metrics = await prisma.marketingMetric.findMany({
    where: { ...ownedByUserOrAdmin(session), ...notDeleted },
    orderBy: { metricDate: "desc" },
  });
  return NextResponse.json({ metrics });
}

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const parsed = marketingMetricSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ message: parsed.error.issues[0]?.message ?? "Invalid marketing metric" }, { status: 400 });
  const metric = await prisma.marketingMetric.create({ data: { userId: session.user.id, ...parsed.data } });
  return NextResponse.json({ metric }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  if (typeof body.id !== "string") return NextResponse.json({ message: "Marketing metric ID is required" }, { status: 400 });
  const parsed = marketingMetricSchema.partial().safeParse(body);
  if (!parsed.success) return NextResponse.json({ message: parsed.error.issues[0]?.message ?? "Invalid marketing metric" }, { status: 400 });
  const existing = await prisma.marketingMetric.findFirst({ where: { id: body.id, ...ownedByUserOrAdmin(session), ...notDeleted } });
  if (!existing) return NextResponse.json({ message: "Marketing metric not found" }, { status: 404 });
  const metric = await prisma.marketingMetric.update({ where: { id: existing.id }, data: parsed.data });
  return NextResponse.json({ metric });
}

export async function DELETE(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ message: "Marketing metric ID is required" }, { status: 400 });
  const result = await prisma.marketingMetric.updateMany({
    where: { id, ...ownedByUserOrAdmin(session), ...notDeleted },
    data: softDeleteData(session.user.id, req.nextUrl.searchParams.get("reason")),
  });
  if (!result.count) return NextResponse.json({ message: "Marketing metric not found" }, { status: 404 });
  return NextResponse.json({ success: true });
}
