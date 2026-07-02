import { NextRequest, NextResponse } from "next/server";
import { z, ZodSchema } from "zod";

/**
 * Standardized API responses to strictly follow the { success, data/error } envelope.
 * Based on: docs/11_API_ROUTES.md and .cursorrules
 */

// ─────────────────────────────────────────────────────────
// Response helpers
// ─────────────────────────────────────────────────────────

type ClientErrorStatus = 400 | 401 | 403 | 404 | 409 | 422;
type SuccessStatus = 200 | 201 | 204;

export type APIResult<T> = 
  | { success: true; data: T } 
  | { success: false; errorResponse: NextResponse };


export  function apiSuccess<T>(
    data: T, 
    status: SuccessStatus = 200
): NextResponse {
    return NextResponse.json(
        { success: true, data },
        { status }
    );
}

export function apiError(
    message: string | string[], 
    status: ClientErrorStatus = 400
): NextResponse {
    const errorMessage = Array.isArray(message) ? message : [message];
    return NextResponse.json(
        { success: false, error: errorMessage }, 
        { status }
    );
}

export function apiInternalError(
    error: unknown
): NextResponse {
    console.error("[API Error]",error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ success: false, error: [errorMessage] }, { status: 500 });
}


// ─────────────────────────────────────────────────────────
// Request body parser
// ─────────────────────────────────────────────────────────

export async function parseBody<T>(
    req: Request,
    schema: ZodSchema<T>
): Promise<APIResult<T>> {
    try {
        const body = await req.json();
        const parsed = schema.safeParse(body);

        if (!parsed.success) {
            const errorMessages = parsed.error.issues.map(issue => issue.message);
            return { success: false, errorResponse: apiError(errorMessages, 400) };
        }

        return { success: true, data: parsed.data };
    } 
    catch (error) {
        if (error instanceof SyntaxError) {
            return { success: false, errorResponse: apiError("Invalid JSON body", 400) };
        }
        throw error;
    }
}


// ─────────────────────────────────────────────────────────
// Route-level error wrapper
// ─────────────────────────────────────────────────────────

export const uuidSchema = z.string().regex(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    "Invalid UUID format"
  );

  
type RouteHandler<T = unknown> = (req: NextRequest, context: T) => Promise<NextResponse>;

export function withErrorHandler<T = unknown>(
    handler: RouteHandler<T>
): RouteHandler<T> {
  return async (req, context) => {
    try {
      return await handler(req, context);
    } catch (error) {
      return apiInternalError(error);
    }
  };
}
