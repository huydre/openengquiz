import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

export function seedModel(baseURL: string, apiKey: string, modelId: string) {
  return createOpenAICompatible({
    name: "seed-gateway",
    baseURL,
    apiKey,
    supportsStructuredOutputs: true,
    // ponytail: combo backends can ignore response_format; keep the schema in the prompt until they enforce it.
    transformRequestBody(body) {
      const format = body.response_format as { json_schema?: { schema: unknown } } | undefined;
      if (!format?.json_schema) return body;
      return {
        ...body,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: `Return only a JSON object matching this schema: ${JSON.stringify(format.json_schema.schema)}` },
          ...(body.messages as unknown[]),
        ],
      };
    },
  })(modelId);
}
