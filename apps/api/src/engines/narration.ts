import type { NarrationPayload, NarrationOutput, SavingsRecommendation, Archetype } from '../types';

/**
 * Engine 7b: Narration / Coaching Engine (LLM bounded)
 *
 * Allowed: Summarize deterministic outputs, generate micro-plan from predefined action templates,
 *          personalize tone.
 * Forbidden: Inventing numeric values, altering savings amounts, changing classifications,
 *            generating new financial claims.
 *
 * Enforcement: LLM receives structured JSON payload. Output validated against allowed schema.
 *              Numeric fields rejected unless present in input payload.
 */

const LLM_API_KEY = process.env.LLM_API_KEY || '';
const LLM_MODEL = process.env.LLM_MODEL || 'gpt-4o-mini';

// System prompt that strictly bounds LLM output
const SYSTEM_PROMPT = `You are a financial behavior coach for the SIFT app. Your role is STRICTLY limited to:

1. Summarizing the deterministic analysis results provided to you
2. Generating brief action plans based on the provided recommendations
3. Adapting tone for the user

STRICT RULES:
- NEVER invent, modify, or round any numeric values. Use ONLY the exact numbers provided in the input.
- NEVER create new financial claims or savings estimates.
- NEVER change classifications, categories, or archetype assignments.
- NEVER suggest specific financial products, investments, or services.
- Keep summaries concise (2-4 sentences for the overview).
- Keep action plans to 1-2 sentences each, based on the steps provided.
- Use a direct, professional tone. No exclamation marks. No hype.
- Reference specific dollar amounts and percentages only as provided.

Respond with valid JSON matching this schema:
{
  "summary": "string (2-4 sentences overview)",
  "archetype_narratives": [{"name": "string", "narrative": "string (1-2 sentences)"}],
  "action_plans": [{"title": "string", "micro_plan": "string (1-2 sentences)"}],
  "tone": "direct"
}`;

export class NarrationEngine {
  async generate(payload: NarrationPayload): Promise<NarrationOutput> {
    // If no LLM API key, return template-based narration
    if (!LLM_API_KEY) {
      return this.generateTemplateBased(payload);
    }

    try {
      return await this.generateWithLLM(payload);
    } catch (err) {
      console.error('LLM narration failed, falling back to template:', err);
      return this.generateTemplateBased(payload);
    }
  }

  private async generateWithLLM(payload: NarrationPayload): Promise<NarrationOutput> {
    const userMessage = JSON.stringify(payload, null, 2);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${LLM_API_KEY}`,
      },
      body: JSON.stringify({
        model: LLM_MODEL,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userMessage },
        ],
        temperature: 0.3,
        max_tokens: 1000,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      throw new Error(`LLM API error: ${response.statusText}`);
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('Empty LLM response');
    }

    const parsed = JSON.parse(content);

    // Validate: ensure no numeric fields were invented
    const validated = this.validateOutput(parsed, payload);

    return validated;
  }

  private validateOutput(output: any, input: NarrationPayload): NarrationOutput {
    // Ensure structure matches expected schema
    const result: NarrationOutput = {
      summary: typeof output.summary === 'string' ? output.summary : '',
      archetype_narratives: [],
      action_plans: [],
      tone: output.tone || 'direct',
    };

    // Validate archetype narratives reference only input archetypes
    const inputArchetypeNames = new Set(input.archetypes.map((a) => a.name));
    if (Array.isArray(output.archetype_narratives)) {
      for (const an of output.archetype_narratives) {
        if (inputArchetypeNames.has(an.name) && typeof an.narrative === 'string') {
          result.archetype_narratives.push({
            name: an.name,
            narrative: an.narrative,
          });
        }
      }
    }

    // Validate action plans reference only input recommendations
    const inputTitles = new Set(input.recommendations.map((r) => r.title));
    if (Array.isArray(output.action_plans)) {
      for (const ap of output.action_plans) {
        if (typeof ap.title === 'string' && typeof ap.micro_plan === 'string') {
          result.action_plans.push({
            title: ap.title,
            micro_plan: ap.micro_plan,
          });
        }
      }
    }

    return result;
  }

  private generateTemplateBased(payload: NarrationPayload): NarrationOutput {
    const { signals, archetypes, recommendations, potential_annual_savings } = payload;

    // Summary
    let summary = `Over ${payload.period_start} to ${payload.period_end}, `;

    if (signals.net_cashflow >= 0) {
      summary += `your net cashflow was positive at $${signals.net_cashflow}. `;
    } else {
      summary += `your spending exceeded income by $${Math.abs(signals.net_cashflow)}. `;
    }

    if (signals.savings_rate_estimate > 0) {
      summary += `Your savings rate is approximately ${Math.round(signals.savings_rate_estimate * 100)}%. `;
    }

    if (potential_annual_savings >= 1000) {
      summary += `We identified potential annual savings of $${potential_annual_savings} across ${recommendations.length} actions.`;
    } else if (recommendations.length > 0) {
      summary += `We identified ${recommendations.length} potential savings actions.`;
    }

    // Archetype narratives
    const archetype_narratives = archetypes.map((a) => ({
      name: a.name,
      narrative: a.description,
    }));

    // Action plans from recommendations
    const action_plans = recommendations.map((r) => ({
      title: r.title,
      micro_plan: r.steps.join(' '),
    }));

    return {
      summary: summary.trim(),
      archetype_narratives,
      action_plans,
      tone: 'direct',
    };
  }
}
