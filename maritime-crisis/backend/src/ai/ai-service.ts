import { config } from "../config/index.js";
import { createLogger } from "../utils/logger.js";
import type { AiAnalysis, AlertSeverity } from "../types/index.js";

const logger = createLogger("AiService");

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = "llama3-8b-8192"; // Free tier model

// ─── System prompt for distress analysis ─────────────────────────────────────

const DISTRESS_SYSTEM_PROMPT = `You are a maritime crisis management AI.
Analyze distress messages from ship captains and extract structured information.
You must respond ONLY with valid JSON, no markdown, no explanation.

JSON schema:
{
  "severity": "low" | "medium" | "high" | "critical",
  "issueType": string,
  "injuryCount": number | null,
  "damageEstimate": string | null,
  "recommendedAction": string,
  "summary": string
}

Severity guide:
- critical: lives at risk, fire, sinking, collision, medical emergency
- high: significant damage, engine failure, cargo spill, major threat
- medium: partial system failure, minor injury, weather distress
- low: minor issue, precautionary, request for assistance

Be concise. issueType should be 1-4 words (e.g. "engine failure", "fire on deck").
recommendedAction should be a single actionable sentence for fleet command.
summary should be 1-2 sentences.`;

// ─── Fleet advisor system prompt ─────────────────────────────────────────────

const ADVISOR_SYSTEM_PROMPT = `You are a maritime fleet operations AI advisor.
Given the current fleet state, analyze the situation and provide actionable recommendations.
Respond ONLY with valid JSON.

JSON schema:
{
  "recommendations": [
    {
      "type": "REROUTE" | "ZONE_SUGGESTION" | "SEND_AID" | "MONITOR",
      "shipId": string | null,
      "priority": "low" | "medium" | "high" | "critical",
      "action": string,
      "reasoning": string
    }
  ],
  "overallSituation": string
}`;

// ─── Groq API caller ─────────────────────────────────────────────────────────

async function callGroq(
  systemPrompt: string,
  userMessage: string,
  maxTokens = 512,
): Promise<string> {
  if (!config.groqApiKey) {
    throw new Error("GROQ_API_KEY not set");
  }

  const res = await fetch(GROQ_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.groqApiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      max_tokens: maxTokens,
      temperature: 0.2,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Groq API error ${res.status}: ${text}`);
  }

  const data = (await res.json()) as {
    choices: Array<{ message: { content: string } }>;
  };
  return data.choices[0]?.message?.content ?? "";
}

function safeParseJson<T>(text: string, fallback: T): T {
  try {
    const clean = text
      .trim()
      .replace(/^```json?\s*/i, "")
      .replace(/```\s*$/, "");
    return JSON.parse(clean) as T;
  } catch {
    logger.warn("Failed to parse AI JSON", { text: text.slice(0, 200) });
    return fallback;
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Analyse a captain's distress message.
 * Returns structured AiAnalysis. Falls back gracefully on API error.
 */
export async function analyseDistressMessage(
  message: string,
  shipName: string,
): Promise<AiAnalysis> {
  const fallback: AiAnalysis = {
    severity: "high" as AlertSeverity,
    issueType: "distress signal",
    recommendedAction: "Dispatch nearest available ship for assistance.",
    summary: `${shipName} has sent a distress signal. Manual review required.`,
  };

  if (!config.groqApiKey) {
    logger.warn("No Groq API key — using fallback analysis");
    return fallback;
  }

  try {
    const raw = await callGroq(
      DISTRESS_SYSTEM_PROMPT,
      `Ship: ${shipName}\nDistress message: ${message}`,
    );
    const parsed = safeParseJson<AiAnalysis>(raw, fallback);
    logger.info("Distress analysed", { shipName, severity: parsed.severity });
    return parsed;
  } catch (err) {
    logger.error("AI distress analysis failed", err);
    return fallback;
  }
}

export interface FleetAdvisorInput {
  ships: Array<{
    shipId: string;
    name: string;
    status: string;
    fuel: number;
    position: { lat: number; lng: number };
    destination: string;
    inAdverseWeather: boolean;
    distanceToDest: number;
  }>;
  activeAlerts: Array<{ type: string; severity: string; message: string }>;
  activeZones: Array<{ name: string }>;
}

export interface FleetRecommendation {
  type: "REROUTE" | "ZONE_SUGGESTION" | "SEND_AID" | "MONITOR";
  shipId: string | null;
  priority: AlertSeverity;
  action: string;
  reasoning: string;
}

export interface FleetAdvisorOutput {
  recommendations: FleetRecommendation[];
  overallSituation: string;
}

/**
 * Proactive fleet advisor — analyses current state and suggests actions.
 */
export async function getFleetAdvisory(
  input: FleetAdvisorInput,
): Promise<FleetAdvisorOutput> {
  const fallback: FleetAdvisorOutput = {
    recommendations: [],
    overallSituation: "Fleet is operating. Manual review recommended.",
  };

  if (!config.groqApiKey) return fallback;

  try {
    const summary = JSON.stringify({
      distressedShips: input.ships.filter((s) => s.status === "distressed")
        .length,
      strandedShips: input.ships.filter((s) => s.status === "stranded").length,
      lowFuelShips: input.ships.filter((s) => s.fuel < 1000).map((s) => s.name),
      criticalAlerts: input.activeAlerts.filter(
        (a) => a.severity === "critical",
      ).length,
      activeZones: input.activeZones.length,
      adverseWeatherShips: input.ships
        .filter((s) => s.inAdverseWeather)
        .map((s) => s.name),
    });

    const raw = await callGroq(
      ADVISOR_SYSTEM_PROMPT,
      `Fleet state summary:\n${summary}`,
      800,
    );
    return safeParseJson<FleetAdvisorOutput>(raw, fallback);
  } catch (err) {
    logger.error("Fleet advisory failed", err);
    return fallback;
  }
}
