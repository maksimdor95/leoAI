# Interview Trainer Prompt V2

## Goal

`interview-prep` uses Prompt Architecture V2 to behave like a serious interview trainer instead of a generic assistant.

Core goals:

- strict but fair coaching
- mode-specific behavior
- anti-water feedback
- role-aware and seniority-aware adaptation
- multidimensional grading before generating the next trainer response

## Architecture

Prompt V2 is split into layers in `services/ai-nlp/src/services/interviewPrepPrompts.ts`:

- core persona
- anti-water rules
- role adaptation
- seniority expectations
- mode protocol
- response formatting rules
- grading rubric

This keeps prompt logic composable and makes future role packs possible without rewriting the whole trainer.

## Runtime flow

1. `conversation` sends interview mode requests to `ai-nlp`.
2. `grade-answer` evaluates the candidate answer with a multidimensional rubric.
3. `respond` uses vacancy profile, history, prep plan, and grading output to generate the next trainer message.
4. For `mock`, repeated answers are accumulated and later summarized by `generate-mock-summary`.

## Grading contract

Prompt V2 grading returns:

- `overallScore`
- `dimensionScores.structure`
- `dimensionScores.depth`
- `dimensionScores.metrics`
- `dimensionScores.tradeOffs`
- `dimensionScores.communication`
- `dimensionScores.seniorityFit`
- `fatalGaps`
- `strengths`
- `improvements`
- `followUpToProbe`
- `modelStructure`

This contract is consumed by:

- `services/ai-nlp/src/controllers/interviewPrepController.ts`
- `services/conversation/src/services/aiClient.ts`
- `services/conversation/src/services/dialogueEngine.ts`

## Behavior by mode

- `diagnostics`: structured intake and gap mapping
- `theory`: definition -> intuition -> usage -> mistakes -> mini-check
- `case`: one case at a time, no answer leak, hard critique on structure/metrics/trade-offs
- `mock`: interviewer behavior, one question at a time, pressure via follow-up probing
- `star`: validate Situation, Task, Action, Result, ownership, and numbers
- `employer_questions`: tailored, high-signal questions to ask the employer

## Future extension

Prompt V2 intentionally provides a universal core. Specialized role packs can be added later for:

- PM/Product
- Engineering/System Design
- Analytics/Data
- Leadership/Management

Each role pack should extend the core instead of replacing it.

## PM/Product role pack

The first specialized pack extends the universal core for Product interviews.

It strengthens:

- product sense and problem framing
- metric choice and guardrails
- prioritization logic
- experimentation and validation
- roadmap and execution trade-offs
- stakeholder conflict and decision quality

For PM/Product cases and mocks, the trainer now pushes on:

- goal -> user -> metric -> options -> prioritization -> experiment -> trade-offs
- clarity of business impact and user value
- evidence of judgment rather than generic feature brainstorming

## Analytics/Data role pack

The second specialized pack extends the universal core for analytics and data-heavy interviews.

It strengthens:

- hypothesis quality
- metric definition and guardrails
- experiment design
- causality vs correlation reasoning
- data quality and bias awareness
- interpretation quality under ambiguity
- decision-making with imperfect evidence

For Analytics/Data cases and mocks, the trainer now pushes on:

- business question -> hypothesis -> metric -> data limits -> method -> interpretation -> recommendation
- explicit discussion of uncertainty, bias, and limitations
- distinction between reporting numbers and shaping a decision
- analytical rigor instead of generic “let’s look at the data” language

The PM/Product role pack is activated automatically when the vacancy profile looks product-oriented.
