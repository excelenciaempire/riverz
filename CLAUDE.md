# Claude Code Project Rules

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
