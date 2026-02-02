// /api/webhooks/sanity/route.ts

import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Verify Sanity webhook signature
function verifySignature(body: string, signature: string): boolean {
  const secret = process.env.SANITY_WEBHOOK_SECRET;
  if (!secret) return true; // Skip verification if no secret set
  
  const hash = crypto
    .createHmac('sha256', secret)
    .update(body)
    .digest('hex');
  
  return hash === signature;
}

export async function POST(request: Request) {
  try {
    const body = await request.text();
    const signature = request.headers.get('sanity-webhook-signature') || '';
    
    // Verify webhook is from Sanity
    if (!verifySignature(body, signature)) {
      return Response.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const payload = JSON.parse(body);
    const { _type, _id } = payload;

    console.log(`Sanity webhook received: ${_type} - ${_id}`);

    let result;
    
    switch (_type) {
      case 'learningPath':
        result = await syncLearningPath(payload);
        break;
      case 'learningPathRule':
        result = await syncLearningPathRule(payload);
        break;
      default:
        return Response.json({ 
          status: 'ignored', 
          message: `Unhandled document type: ${_type}` 
        });
    }

    if (result.success) {
      return Response.json({ 
        status: 'success',
        type: _type,
        id: result.id
      });
    } else {
      return Response.json({ 
        status: 'error', 
        message: result.error 
      }, { status: 500 });
    }
    
  } catch (error) {
    console.error('Sanity webhook error:', error);
    return Response.json({ 
      status: 'error', 
      message: String(error) 
    }, { status: 500 });
  }
}

async function syncLearningPath(doc: any) {
  try {
    const learningPath = {
      external_id: doc._id, // Use Sanity _id as external_id
      org_id: doc.orgId || null,
      title: doc.title,
      description: doc.description || null,
      url: doc.url || null,
      metadata: doc.metadata || null
    };

    // Upsert based on external_id (handles both create and update)
    const { data, error } = await supabase
      .from('learning_paths')
      .upsert(learningPath, { 
        onConflict: 'external_id',
        ignoreDuplicates: false 
      })
      .select()
      .single();

    if (error) throw error;

    console.log(`Synced learning path: ${data.id}`);
    
    return { success: true, id: data.id };
  } catch (error) {
    console.error('Learning path sync error:', error);
    return { success: false, error: String(error) };
  }
}

async function syncLearningPathRule(doc: any) {
  try {
    // Resolve the learning path reference to get Supabase ID
    const learningPathId = await resolveLearningPathId(doc.learningPath._ref);
    
    if (!learningPathId) {
      throw new Error(`Learning path not found for reference: ${doc.learningPath._ref}`);
    }

    const rule = {
      org_id: doc.orgId || null,
      template_id: doc.templateId || null,
      skill_group_id: null,  // Not using for now
      template_skill_id: null,  // Not using for now
      min_score: doc.minScore,
      max_score: doc.maxScore,
      learning_path_id: learningPathId,
      priority: doc.priority || 0
    };

    // Just insert new rule
    const { data, error } = await supabase
      .from('learning_path_rules')
      .insert(rule)
      .select()
      .single();

    if (error) throw error;

    console.log(`Created learning path rule: ${data.id}`);
    
    return { success: true, id: data.id };
  } catch (error) {
    console.error('Learning path rule sync error:', error);
    return { success: false, error: String(error) };
  }
}

// Helper to resolve learning path Sanity reference to Supabase ID
async function resolveLearningPathId(sanityRef: string): Promise<string | null> {
  const { data } = await supabase
    .from('learning_paths')
    .select('id')
    .eq('external_id', sanityRef)
    .single();
  
  return data?.id || null;
}