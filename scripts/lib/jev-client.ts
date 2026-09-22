interface JevChoiceParams {
  state: string;
  instructions: string;
  criteria: Record<string, string>;
}

interface JevChoiceResult {
  choice: string;
  confidence?: number;
  source: "typesafe-ai/jev" | "heuristic-fallback";
}

export class JevClient {
  private apiKey: string;
  private gatewayUrl = "https://ai-gateway.vercel.sh/v1/evaluate";
  private warnedVerification = false;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.AI_GATEWAY_API_KEY || "";
  }

  /**
   * Evaluates a decision using TypeSafe Jev via Vercel AI Gateway.
   * Gracefully falls back to heuristic if verification is required or key is missing.
   */
  async choose(params: JevChoiceParams): Promise<JevChoiceResult> {
    const options = Object.keys(params.criteria);
    const defaultChoice = options[0] || "";

    if (!this.apiKey) {
      return { choice: defaultChoice, source: "heuristic-fallback" };
    }

    try {
      const response = await fetch(this.gatewayUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "typesafe-ai/jev",
          state: params.state,
          questions: {
            decision: {
              type: "choice",
              instructions: params.instructions,
              criteria: params.criteria,
            },
          },
        }),
      });

      const json: any = await response.json();

      if (response.ok && json.results?.decision) {
        const res = json.results.decision;
        return {
          choice: res.answer || res.choice || defaultChoice,
          confidence: res.confidence ?? res.probability,
          source: "typesafe-ai/jev",
        };
      }

      if (json.error?.type === "customer_verification_required" && !this.warnedVerification) {
        this.warnedVerification = true;
        console.warn(
          "\n[Jev AI Notice]: Vercel AI Gateway requires adding a card to unlock free credits:\n" +
            "  -> Visit: https://vercel.com/d?to=%2F%5Bteam%5D%2F%7E%2Fai%3Fmodal%3Dadd-credit-card\n" +
            "  -> Proceeding with intelligent heuristic fallback for this run.\n"
        );
      } else if (!response.ok) {
        console.warn(`[Jev AI Notice]: ${json.error?.message || response.statusText}. Using fallback.`);
      }
    } catch (e: any) {
      console.warn(`[Jev AI Network Error]: ${e.message}. Using fallback.`);
    }

    // Heuristic fallback
    return { choice: defaultChoice, source: "heuristic-fallback" };
  }

  /**
   * Evaluates a form validation error with Jev AI and calculates the self-healed value.
   */
  async healFormError(field: string, errorText: string, currentValue: string): Promise<{
    strategy: string;
    healedValue: string;
    source: string;
    confidence?: number;
  }> {
    const isPhone = field.toLowerCase().includes("contact") || field.toLowerCase().includes("phone");

    if (isPhone) {
      const decision = await this.choose({
        state: `Field: "${field}", Current Input: "${currentValue}", Validation Error: "${errorText}"`,
        instructions: "What is the optimal self-healing recovery strategy for this phone validation error?",
        criteria: {
          STRIP_NON_DIGITS: "Strip all non-digit characters (+, -, spaces) leaving pure digits only (regex: ^\\d{10,}$)",
          LOCAL_11_DIGIT: "Normalize to a standard local 11-digit mobile number format starting with 017/018",
          REGENERATE_CLEAN: "Regenerate a clean 11-digit random mobile number without formatting symbols",
        },
      });

      let healedValue = currentValue.replace(/\D/g, "");
      if (decision.choice === "LOCAL_11_DIGIT" || healedValue.length < 10) {
        healedValue = `017${Math.floor(10000000 + Math.random() * 90000000)}`;
      } else if (healedValue.startsWith("880") && healedValue.length > 11) {
        healedValue = "0" + healedValue.slice(3);
      }

      return {
        strategy: decision.choice,
        healedValue,
        source: decision.source,
        confidence: decision.confidence,
      };
    }

    // Generic string fallback
    return {
      strategy: "TRIM",
      healedValue: currentValue.trim(),
      source: "heuristic-fallback",
    };
  }
}
