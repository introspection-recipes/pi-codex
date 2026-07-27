---
description: Review a working tree, branch, commit, or supplied diff for actionable bugs
argument-hint: [target]
---
Review ${1:-the current working tree}.

Use the `review` agent for an independent pass. Inspect the target and enough surrounding code to prove each issue. Report all discrete bugs the author would likely fix, ordered by severity, with tight file and line references. Ignore style-only observations and pre-existing problems. If no actionable findings qualify, say so and give an overall correctness verdict.
