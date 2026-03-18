// src/lib/ontology.ts
// Responsible for: domain lookup, LLM-based classification, subdomain node get-or-create

import { generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';

export interface OntologyClassification {
  domainId: number;
  domainSlug: string;
  subdomainLabel: string;   // e.g. "Machine Learning"
  subdomainNodeId: string;  // UUID of the subdomain node for this user
}

/**
 * Classify a concept node to a domain + subdomain.
 * Classifies via LLM using domains + ontology as context.
 */
export async function classifyToOntology(
  label: string,
  summary: string,
  userId: string
): Promise<OntologyClassification | null> {
  try {
    const supabase = await createClient();

    // 1. Fetch domains + ontology for LLM context (cached hot path in production)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: domainsRaw } = await (supabase as any).from('domains').select('id, name, slug, description').order('id');
    const domains = domainsRaw as Array<{ id: number; name: string; slug: string; description: string }> | null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: ontologyRaw } = await (supabase as any).from('domain_ontology').select('subdomain, domain_id, aliases');
    const ontology = ontologyRaw as Array<{ subdomain: string; domain_id: number; aliases: string[] | null }> | null;

    if (!domains || !ontology) return null;

    // Build a compact reference string for the LLM
    const domainList = domains
      .map(d => `${d.id}. ${d.name} (${d.slug}): ${d.description}`)
      .join('\n');

    const subdomainList = ontology
      .map(o => `domain_id:${o.domain_id} | ${o.subdomain} | aliases: ${o.aliases?.join(', ')}`)
      .join('\n');

    // 2. LLM classification
    const { object } = await generateObject({
      model: openai('gpt-4.1-mini'),
      system: `You are a knowledge taxonomy classifier.
Classify the given concept into exactly one domain and one subdomain from the reference lists.
If no subdomain matches closely, invent a short subdomain name (2-4 words) that fits within the chosen domain.
Respond only with valid JSON.`,
      schema: z.object({
        domain_id: z.number().describe('ID of the matching domain from the list'),
        subdomain: z.string().describe('Closest matching subdomain label, or a new short label if none fit')
      }),
      prompt: `Concept: "${label}"
Summary: "${summary}"

DOMAINS:
${domainList}

KNOWN SUBDOMAINS:
${subdomainList}

Classify this concept.`
    });

    const matchedDomain = domains.find(d => d.id === object.domain_id);
    if (!matchedDomain) return null;

    // 3. Get or create subdomain node for this user
    const subdomainNodeId = await getOrCreateSubdomainNode(
      userId,
      object.subdomain,
      object.domain_id,
      supabase
    );

    if (!subdomainNodeId) return null;

    return {
      domainId: object.domain_id,
      domainSlug: matchedDomain.slug,
      subdomainLabel: object.subdomain,
      subdomainNodeId,
    };
  } catch (err) {
    logger.error('[ontology] classifyToOntology failed', { err, label, userId });
    return null;
  }
}

/**
 * Returns existing subdomain node ID, or creates one if it doesn't exist for this user.
 */
async function getOrCreateSubdomainNode(
  userId: string,
  subdomainLabel: string,
  domainId: number,
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<string | null> {
  const normalizedLabel = subdomainLabel.toLowerCase().trim();

  const { data: upserted, error } = await supabase
    .from('knowledge_graph_nodes')
    .upsert({
      user_id: userId,
      label: normalizedLabel,
      summary: `Subdomain: ${subdomainLabel}`,
      node_type: 'subdomain',
      level: 1,
      domain_id: domainId,
      parent_node_id: null,  // parent is the domain (domains table), not a node
      metadata: { auto_created: true }
    }, { onConflict: 'user_id,label,node_type', ignoreDuplicates: false })
    .select('id')
    .single();

  if (error) {
    logger.error('[ontology] Failed to create subdomain node', { error: error.message });
    return null;
  }

  return upserted.id;
}
