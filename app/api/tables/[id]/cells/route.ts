import { apiSuccess, apiError, withErrorHandler, uuidSchema } from "@/lib/utils/api";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
