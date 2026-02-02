import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import crypto from "crypto";

interface SanityDocument {
  _type: string;
  _id: string;
  title?: string;
  description?: string;
  url?: string;
  metadata?: Record<string, unknown>;
  orgId?: string;
  templateId?: string;
  minScore?: number;
  maxScore?: number;
  priority?: number;
  learningPath?: {
    _ref: string;
  };
}

function verifySignature(body: string, signature: string): boolean {
  const secret = process.env.SANITY_WEBHOOK_SECRET;
  if (!secret) return true; // Skip verification if no secret set

  const hash = crypto.createHmac("sha256", secret).update(body).digest("hex");

  return hash === signature;
}

export async function POST(req: Request) {
  const body = await req.text();
  const signature = req.headers.get("sanity-webhook-signature") || "";

   if (!verifySignature(body, signature)) {
    return new NextResponse("Invalid signature", { status: 401 });
  }

  let payload: SanityDocument;
  try {
    payload = JSON.parse(body);
  } catch {
    return new NextResponse("Invalid JSON", { status: 400 });
  }

  const { _type, _id } = payload;

  console.log(`Sanity webhook received: ${_type} - ${_id}`);

  try {
    let result: { success: boolean; id?: string; error?: string };

    switch (_type) {
      case "learningPath":
        result = await syncLearningPath(payload);
        break;
      case "learningPathRule":
        result = await syncLearningPathRule(payload);
        break;
      default:
        return NextResponse.json({
          ok: true,
          status: "ignored",
          message: `Unhandled document type: ${_type}`,
        });
    }

    if (result.success) {
      return NextResponse.json({
        ok: true,
        type: _type,
        id: result.id,
      });
    } else {
      return NextResponse.json(
        { ok: false, error: result.error },
        { status: 500 }
      );
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error("Sanity webhook error:", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

async function syncLearningPath(doc: SanityDocument) {
  const supabase = db();

  try {
    const learningPath = {
      external_id: doc._id,
      org_id: doc.orgId || null,
      title: doc.title,
      description: doc.description || null,
      url: doc.url || null,
      metadata: doc.metadata || null,
    };

    // First try to find existing record
    const { data: existing } = await supabase
      .from("learning_paths")
      .select("id")
      .eq("external_id", doc._id)
      .single();

    let data, error;

    if (existing) {
      // Update existing
      ({ data, error } = await supabase
        .from("learning_paths")
        .update(learningPath)
        .eq("external_id", doc._id)
        .select()
        .single());
    } else {
      // Insert new
      ({ data, error } = await supabase
        .from("learning_paths")
        .insert(learningPath)
        .select()
        .single());
    }

    if (error) throw error;

    console.log(`Synced learning path: ${data.id}`);

    return { success: true, id: data.id };
  } catch (error) {
    console.error("Learning path sync error:", error);
    return { success: false, error: String(error) };
  }
}

async function syncLearningPathRule(doc: SanityDocument) {
  const supabase = db();

  try {
    if (!doc.learningPath?._ref) {
      throw new Error("Learning path reference is required");
    }

    const learningPathId = await resolveLearningPathId(doc.learningPath._ref);

    if (!learningPathId) {
      throw new Error(
        `Learning path not found for reference: ${doc.learningPath._ref}`
      );
    }

    const rule = {
      org_id: doc.orgId || null,
      template_id: doc.templateId || null,
      skill_group_id: null,
      template_skill_id: null,
      min_score: doc.minScore,
      max_score: doc.maxScore,
      learning_path_id: learningPathId,
      priority: doc.priority || 0,
    };

    const { data, error } = await supabase
      .from("learning_path_rules")
      .insert(rule)
      .select()
      .single();

    if (error) throw error;

    console.log(`Created learning path rule: ${data.id}`);

    return { success: true, id: data.id };
  } catch (error) {
    console.error("Learning path rule sync error:", error);
    return { success: false, error: String(error) };
  }
}

async function resolveLearningPathId(sanityRef: string): Promise<string | null> {
  const supabase = db();

  const { data } = await supabase
    .from("learning_paths")
    .select("id")
    .eq("external_id", sanityRef)
    .single();

  return data?.id || null;
}
