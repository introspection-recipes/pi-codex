import { askUserQuestion } from "@introspection-ai/recipes/interactions";
import { Type } from "typebox";
import { defineTool } from "@earendil-works/pi-coding-agent";

const QuestionOption = Type.Object({
  label: Type.String({ description: "Short option label." }),
  description: Type.String({ description: "Impact or tradeoff of choosing this option." }),
});

const Question = Type.Object({
  id: Type.String({ description: "Stable snake_case identifier for the answer." }),
  header: Type.String({
    maxLength: 12,
    description: "Short heading, at most 12 characters.",
  }),
  question: Type.String({ description: "The decision or clarification to show the user." }),
  options: Type.Array(QuestionOption, {
    minItems: 2,
    maxItems: 3,
    description: "Two or three mutually exclusive choices. Put the recommended choice first.",
  }),
});

const RequestUserInputParams = Type.Object({
  questions: Type.Array(Question, {
    minItems: 1,
    maxItems: 1,
    description:
      "Exactly one question per call so terminal, RPC, and durable interrupt hosts share one contract.",
  }),
  autoResolutionMs: Type.Optional(
    Type.Number({
      minimum: 60_000,
      maximum: 240_000,
      description: "Optional auto-resolution window for useful but non-blocking questions.",
    }),
  ),
});

export const requestUserInputTool = defineTool({
  name: "request_user_input",
  label: "Ask user",
  description:
    "Ask one structured question when a genuinely user-owned decision blocks better work. " +
    "Do not ask for discoverable facts or choices with a safe conventional default.",
  promptSnippet: "Ask the user for one blocking decision with structured answer choices.",
  promptGuidelines: [
    "Use only when the answer materially changes the work and cannot be discovered locally.",
    "Put the recommended option first and suffix its label with '(Recommended)'.",
    "The UI allows custom text; do not add an Other option.",
  ],
  parameters: RequestUserInputParams,
  executionMode: "sequential",
  async execute(toolCallId, params, signal, _onUpdate, ctx) {
    const question = params.questions[0];
    const expiresAt = params.autoResolutionMs
      ? new Date(Date.now() + params.autoResolutionMs).toISOString()
      : undefined;
    return askUserQuestion(
      {
        question: question.question,
        header: question.header,
        options: question.options.map((option) => ({
          label: option.label,
          value: option.label,
          description: option.description,
        })),
        metadata: { questionId: question.id },
        expiresAt,
      },
      {
        toolCallId,
        ctx,
        signal,
        ...(params.autoResolutionMs ? { timeoutMs: params.autoResolutionMs } : {}),
      },
    );
  },
});
