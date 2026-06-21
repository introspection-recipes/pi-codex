/**
 * Codex `update_plan` tool — verbatim port of the Codex plan tool.
 *
 * Source: codex-rs/core/src/tools/handlers/plan_spec.rs
 * Tracks an ordered list of plan steps with a single-in-progress invariant.
 * The harness renders the plan; the tool just validates and records it.
 */

import { Type, type Static } from "typebox";
import { defineTool } from "@earendil-works/pi-coding-agent";

const PlanItemSchema = Type.Object({
  step: Type.String({ description: "Task step text." }),
  status: Type.Union(
    [
      Type.Literal("pending"),
      Type.Literal("in_progress"),
      Type.Literal("completed"),
    ],
    { description: "Step status." }
  ),
});

const UpdatePlanParams = Type.Object({
  explanation: Type.Optional(
    Type.String({ description: "Optional explanation for this plan update." })
  ),
  plan: Type.Array(PlanItemSchema, { description: "The list of steps" }),
});

type UpdatePlanInput = Static<typeof UpdatePlanParams>;
interface UpdatePlanDetails {
  plan?: UpdatePlanInput["plan"];
  explanation?: string;
}

export const updatePlanTool = defineTool<
  typeof UpdatePlanParams,
  UpdatePlanDetails
>({
  name: "update_plan",
  label: "Update Plan",
  description:
    "Updates the task plan.\n" +
    "Provide an optional explanation and a list of plan items, each with a step and status.\n" +
    "At most one step can be in_progress at a time.",
  parameters: UpdatePlanParams,
  execute: async (_id, params: UpdatePlanInput) => {
    const inProgress = params.plan.filter(
      (item) => item.status === "in_progress"
    );
    if (inProgress.length > 1) {
      return {
        content: [
          {
            type: "text" as const,
            text: "Error: at most one plan item can be in_progress.",
          },
        ],
        details: {},
      };
    }
    return {
      content: [{ type: "text" as const, text: "Plan updated." }],
      details: { plan: params.plan, explanation: params.explanation },
    };
  },
});
