# Claude Code Project Rules

## Auto-commit + push policy

After every set of edits in this repo, commit the changes and push to
`origin/main` without asking. The owner has authorized this — don't pause for
confirmation. Workflow:

1. Stage only the files you actually touched (no `git add -A` that could pull
   in stray secrets).
2. Use a HEREDOC commit message that explains *why* the change matters,
   ending with the standard `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`
   trailer.
3. `git push origin main` immediately after the commit succeeds.
4. Report the new SHA range (`oldSha..newSha`) in the response so the owner
   can find the commit.

If `user.email` / `user.name` are unset, configure them locally (no
`--global`) to `riverzoficial@gmail.com` / "Juan Diego Rios Mesa" — also
without asking.

Skip the auto-push only when:
- The edit is a one-off scratch change the user said is exploratory
- Tests or build are visibly broken — fix first, push second
- The user explicitly says "don't push" or "don't commit"

Force-pushes, branch deletions, and writes outside this repo still need
explicit confirmation.

## Token Optimization

When asking for help, follow these guidelines to minimize token usage:

### DO:
- Point to specific files when you know them
- Describe the exact error or behavior
- Be specific about what you want (fix, add feature, explain)
- Combine related requests into one message

### DON'T:
- Ask to "analyze the entire project" (very expensive)
- Send multiple messages while Claude is working
- Request broad explorations without context

### Example - Bad (expensive):
```
"Analyze the entire project so you have more context"
```

### Example - Good (cheap):
```
"Static ads clone isn't sending to kie.ai.
Check: app/api/static-ads/process-queue/route.ts
Compare with lib/kie-client.ts"
```

## Project Quick Reference

### Stack
- Next.js 15, React 19, TypeScript, Tailwind, Supabase, Clerk

### Key Tables
- `user_credits` - clerk_user_id, credits, plan_type
- `projects` - groups generations
- `generations` - clerk_user_id, project_id, status, input_data
- `products` - research_data, research_status
- `pricing_config` - mode, credits_cost
- `ai_prompts` - key, prompt_text, is_active
- `admin_config` - kie_generation_model, kie_analysis_model

### Static Ads Pipeline
1. Clone: Creates project + generations (pending_analysis)
2. Process-queue: Gemini analyzes → adapts → generates prompt
3. createKieTask: Sends to Nano Banana Pro
4. Poll result: Saves to Supabase storage

### Critical Files
- `app/api/static-ads/clone/route.ts`
- `app/api/static-ads/process-queue/route.ts`
- `lib/kie-client.ts`
- `lib/get-ai-prompt.ts`

### Common Issues
- Missing admin_config entries (kie_generation_model)
- Inactive prompts in ai_prompts table
- Check generations.status for stuck items
