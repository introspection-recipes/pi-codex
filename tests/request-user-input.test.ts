import assert from "node:assert/strict";
import test from "node:test";
import { requestUserInputTool } from "../extensions/codex/request-user-input.js";

test("request_user_input resolves deterministically in headless mode", async () => {
  const previous = process.env.PI_ASK_USER_AUTO_APPROVE;
  process.env.PI_ASK_USER_AUTO_APPROVE = "1";
  try {
    const result = await requestUserInputTool.execute(
      "question",
      {
        questions: [
          {
            id: "approach",
            header: "Approach",
            question: "Which implementation should be used?",
            options: [
              { label: "Focused (Recommended)", description: "Change only the active surface." },
              { label: "Broad", description: "Refactor adjacent surfaces too." },
            ],
          },
        ],
      },
      undefined,
      undefined,
      { hasUI: false, mode: "json" } as never,
    );
    assert.equal(result.outcome.type, "declined");
    assert.equal(result.details.interrupt.metadata?.questionId, "approach");
  } finally {
    if (previous === undefined) delete process.env.PI_ASK_USER_AUTO_APPROVE;
    else process.env.PI_ASK_USER_AUTO_APPROVE = previous;
  }
});

test("request_user_input emits the durable host interrupt contract", async () => {
  const previousAuto = process.env.PI_ASK_USER_AUTO_APPROVE;
  const previousResume = process.env.PI_INTERRUPT_RESUME;
  delete process.env.PI_ASK_USER_AUTO_APPROVE;
  process.env.PI_INTERRUPT_RESUME = "1";
  try {
    const result = await requestUserInputTool.execute(
      "question",
      {
        questions: [
          {
            id: "scope",
            header: "Scope",
            question: "Which scope should be implemented?",
            options: [
              { label: "Focused (Recommended)", description: "Keep the patch narrow." },
              { label: "Expanded", description: "Include adjacent refactors." },
            ],
          },
        ],
      },
      undefined,
      undefined,
      { hasUI: false, mode: "json" } as never,
    );
    assert.equal(result.outcome.type, "awaiting_user");
    assert.equal(result.details.interrupt.reason, "input_required");
    assert.equal(result.details.interrupt.metadata?.questionId, "scope");
  } finally {
    if (previousAuto === undefined) delete process.env.PI_ASK_USER_AUTO_APPROVE;
    else process.env.PI_ASK_USER_AUTO_APPROVE = previousAuto;
    if (previousResume === undefined) delete process.env.PI_INTERRUPT_RESUME;
    else process.env.PI_INTERRUPT_RESUME = previousResume;
  }
});
