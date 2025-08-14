# AICODE Agent Protocol v2.0
*Persistent Memory Layer for Multi-Session AI Coding*

## Core Mission
You are an AI coding assistant with **persistent memory** across sessions. Use structured AICODE comment tags to create a knowledge layer directly in code. These tags enable context recall, intelligent planning, and seamless collaboration between AI sessions and developers.

## The Five AICODE Tags

### AICODE-WHY
**Purpose:** Document the BUSINESS REASON - why code exists, not what it does  
**Use When:** Non-obvious business logic, compliance requirements, architectural decisions  
**Format:** `[comment] AICODE-WHY: [concise business rationale] [YYYY-MM-DD]`

```javascript
// AICODE-WHY: Payments >$10k require dual approval per SOX compliance [2025-08]
# AICODE-WHY: UTC timestamps prevent timezone bugs in distributed systems [2025-08]
<!-- AICODE-WHY: Custom sort needed for real-time priority queue [2025-08] -->
```

### AICODE-TRAP
**Purpose:** Mark dangerous gotchas, edge cases, and historical bugs  
**Use When:** Counter-intuitive behavior, integration quirks, data format issues  
**Format:** `[comment] AICODE-TRAP: [specific warning] [YYYY-MM-DD]`

```python
# AICODE-TRAP: Stripe webhooks arrive out of order - check event_id [2025-08]
// AICODE-TRAP: UserID is UUID in DB but string in API - cast carefully [2025-08]
/* AICODE-TRAP: Rate limit resets at UTC midnight, not local time [2025-08] */
```

### AICODE-LINK
**Purpose:** Connect related code that must change together  
**Use When:** Cross-file dependencies, coupled implementations, external docs  
**Format:** `[comment] AICODE-LINK: ./path/file.ext#Symbol | :L123 | URL`

```typescript
// AICODE-LINK: ./services/payment.ts#processPayment
// AICODE-LINK: ./config/stripe.json:L45 (webhook config)
# AICODE-LINK: https://docs.stripe.com/webhooks#signatures
```

### AICODE-TODO
**Purpose:** AI work queue - specific tasks for current/next session  
**Use When:** Breaking down features, noting improvements, planning refactors  
**Format:** `[comment] AICODE-TODO: [actionable task] [priority:high|med|low]`

```java
// AICODE-TODO: Add retry logic with exponential backoff [priority:high]
# AICODE-TODO: Optimize query for datasets >100k records [priority:med]
<!-- AICODE-TODO: Extract into reusable component [priority:low] -->
```

### AICODE-ASK
**Purpose:** Questions requiring human clarification  
**Use When:** Unclear requirements, business decisions, architectural choices  
**Format:** `[comment] AICODE-ASK: [specific question] @human`

```go
// AICODE-ASK: Redis vs Memcached for session store - performance critical? @human
# AICODE-ASK: Max retry count for failed webhooks - 3 or 5? @human
/* AICODE-ASK: Soft delete or cascade on user removal? @human */
```

## Memory Recall Protocol

### Session Start Checklist
```bash
# 1. Load context
rg -n --hidden --glob '!{.git,node_modules,dist,build,vendor,.next,.cache}' \
   'AICODE-(WHY|TRAP)' .

# 2. Check dependencies
rg -n 'AICODE-LINK' --glob '!{.git,node_modules,dist,build}' .

# 3. Review work queue
rg -n 'AICODE-TODO' --glob '!{.git,node_modules,dist,build}' . | grep -E 'priority:high'

# 4. Pending questions
rg -n 'AICODE-ASK' --glob '!{.git,node_modules,dist,build}' .
```

### Context-Aware Search Patterns
```bash
# Before debugging a payment bug
rg 'AICODE-TRAP.*payment' --glob '*.{js,ts,py}'

# Before refactoring authentication
rg 'AICODE-LINK.*auth' -A 1 -B 1

# Understanding business logic in specific module
rg 'AICODE-WHY' src/payments/

# Finding all high-priority tasks
rg 'AICODE-TODO.*priority:high'
```

## Comment Syntax Auto-Detection

**Always use the correct comment style for each file type:**

| Extension | Comment Style | Example |
|-----------|--------------|---------|
| `.js .ts .java .go .c .cpp .cs .kt .swift` | `//` | `// AICODE-WHY: ...` |
| `.py .rb .sh .toml .dockerfile .yml` | `#` | `# AICODE-WHY: ...` |
| `.html .xml .md` | `<!-- -->` | `<!-- AICODE-WHY: ... -->` |
| `.css .scss .sql` | `/* */` | `/* AICODE-WHY: ... */` |
| `.lua` | `--` | `-- AICODE-WHY: ...` |

## Placement Strategy

### File-Level (Top of file after imports)
```python
# AICODE-WHY: Handles async payment processing for enterprise tier [2025-08]
# AICODE-TRAP: Must init Stripe before any operations or silent fail [2025-08]
# AICODE-LINK: ./config/payment_providers.py#StripeConfig
```

### Function-Level (Directly above declaration)
```javascript
// AICODE-WHY: Custom validator required by PCI DSS v4.0 [2025-08]
// AICODE-TRAP: Legacy OAuth returns null userId - handle gracefully [2025-08]
// AICODE-TODO: Add comprehensive input sanitization [priority:high]
async function validatePayment(userId, amount) {
```

### Inline (Before complex logic blocks)
```typescript
// AICODE-TRAP: Array.sort() mutates in place - clone first [2025-08]
const sorted = [...payments].sort((a, b) => {
  // AICODE-WHY: Priority determines batch processing order [2025-08]
  return b.priority - a.priority;
});
```

## ⚖️ Quality Standards & Limits

### DO ✅
- **One line per comment** - force clarity through brevity
- **Focus on the 20% that causes 80% confusion**
- **Add date stamps** `[YYYY-MM-DD]` for aging/cleanup
- **Use specific metrics**: "payments >$10k" not "large payments"
- **Soft limit**: ≤5 AICODE comments per file (justify exceptions)
- **Always use AICODE- prefix** - makes agent comments instantly recognizable

### DON'T ❌
- Document obvious code ("loops through array")
- Use multi-line explanations
- Leave secrets/tokens/PII in comments
- Keep completed AICODE-TODO/answered AICODE-ASK
- Mix comment styles in one file
- Add AICODE tags to generated/vendor code
- Use shortened forms - always write full AICODE- prefix

## 🔄 Lifecycle Management

### Persistent Tags (Keep & Update)
- **AICODE-WHY**: Update when business logic changes
- **AICODE-TRAP**: Update when issue resolved, keep as warning
- **AICODE-LINK**: Update paths when files move

### Session Tags (Clean After Use)
- **AICODE-TODO**: Remove when complete, convert insights to AICODE-WHY if valuable
- **AICODE-ASK**: Remove after answer, document decision as AICODE-WHY

### Cleanup Commands
```bash
# Find completed tasks
rg 'AICODE-TODO.*\b(DONE|COMPLETED|FIXED)\b'

# Find answered questions  
rg 'AICODE-ASK.*\b(RESOLVED|ANSWERED)\b'

# Find stale tags (>6 months old)
rg 'AICODE-.*\[202[0-4]-' --glob '*.{js,ts,py}'

# Validate single-line rule
rg -U 'AICODE-.*\n.*[^}];?$' --glob '*.{js,ts,py}'

# Count AICODE comments per file
rg -c 'AICODE-' --glob '*.{js,ts,py}' | awk -F: '$2>5 {print}'
```

## 🛡️ Safety & Security Guardrails

### Before Any Changes
1. **Test First**: Write/run test before refactoring
2. **Minimal Diff**: Smallest change that works
3. **Check AICODE-LINKs**: Update all references in same commit
4. **Security Scan**: No secrets/tokens/PII in AICODE comments

### Commit Message Template
```
type(scope): concise summary

AICODE-WHY: Added business context for payment thresholds
AICODE-TRAP: Documented webhook ordering issue  
Closed AICODE-TODO: Input validation (high priority)
Resolved AICODE-ASK: Using Redis for session cache per @human
```

### CI/Pre-commit Checks
```yaml
# .pre-commit-config.yaml
- id: aicode-lint
  name: AICODE comment validator
  entry: scripts/validate-aicode.sh
  language: script
  files: \.(js|ts|py|rb|go|java)$
```

```bash
#!/bin/bash
# scripts/validate-aicode.sh
# Check for multi-line AICODE comments
if rg -U 'AICODE-.*\n\s*(//|#|/\*)' .; then
  echo "❌ Multi-line AICODE comments found"
  exit 1
fi

# Check for secrets in AICODE comments
if rg 'AICODE-.*\b(api[_-]?key|password|token|secret).*[:=]' .; then
  echo "❌ Potential secrets in AICODE comments"
  exit 1
fi

# Ensure AICODE- prefix is used
if rg '^\s*(//|#|/\*)\s*(WHY|TRAP|LINK|TODO|ASK):' .; then
  echo "❌ Found tags without AICODE- prefix"
  exit 1
fi
```

## 🎯 Usage Examples by Scenario

### Starting Work on Existing Module
```bash
# 1. Load all AICODE context
cd src/payments
rg 'AICODE-' .

# 2. Check specific file history
git log -p --grep='AICODE-' -- payment_processor.py

# 3. Review related modules
rg 'AICODE-LINK.*payment' ../
```

### Debugging Production Issue
```python
# AICODE-TRAP: Webhook can fire multiple times - idempotency key required [2025-08]
# AICODE-LINK: ./utils/idempotency.py#generate_key
if not idempotency_key:
    # AICODE-TODO: Add monitoring alert for missing keys [priority:high]
    logger.error("Missing idempotency key")
```

### Complex Refactor Planning
```javascript
// AICODE-WHY: Legacy system requires XML - migration planned Q3 [2025-08]
// AICODE-TRAP: XML parser fails silently on malformed input [2025-08]
// AICODE-LINK: ./migrations/xml_to_json_plan.md
// AICODE-TODO: Phase 1 - Add JSON parallel processing [priority:high]
// AICODE-TODO: Phase 2 - Migrate 10% traffic to JSON [priority:med]
// AICODE-ASK: Acceptable downtime window for cutover? @human
```

## Multi-Session Workflow

### Session Start (5 min)
1. **Context Load**: Search all AICODE- tags in working area
2. **Priority Check**: Filter AICODE-TODO by priority
3. **Question Review**: Check unanswered AICODE-ASK items
4. **Risk Assessment**: Review AICODE-TRAP warnings

### During Development
1. **Document Decisions**: Add AICODE-WHY for non-obvious choices
2. **Mark Dangers**: Add AICODE-TRAP immediately when found
3. **Connect Code**: Add AICODE-LINK for coupled changes
4. **Queue Work**: Add AICODE-TODO for identified improvements
5. **Request Input**: Add AICODE-ASK for ambiguous requirements

### Session End (5 min)
1. **Clean Completed**: Remove done AICODE-TODOs
2. **Update Progress**: Modify AICODE-TODO priorities/status
3. **Convert Knowledge**: AICODE-ASK answers → AICODE-WHY documentation
4. **Commit Pattern**: Include AICODE summary in message

## 🚀 Advanced Patterns

### Cross-Repository Links
```javascript
// AICODE-LINK: github.com/org/other-repo/blob/main/api.ts#L234
// AICODE-LINK: ../shared-lib/src/validators.ts#emailValidator
```

### Versioned Traps
```python
# AICODE-TRAP: [v3.2.1] Memory leak in cursor.fetchall() [2025-08]
# AICODE-TRAP: [Fixed v3.3.0] Use cursor.fetchmany(1000) instead [2025-08]
```

### Conditional TODOs
```typescript
// AICODE-TODO: [if-traffic>1M/day] Implement caching layer [priority:med→high]
// AICODE-TODO: [after-Q2-migration] Remove XML parser [priority:low]
```

### Team Mentions
```java
// AICODE-ASK: @security-team: Is SHA256 sufficient for this use case?
// AICODE-ASK: @frontend: Need loading state while processing? @human
```

## 📈 Success Metrics

Good AICODE implementation shows:
- **80% fewer "what does this do?" questions in PR reviews**
- **50% faster onboarding to complex modules**
- **Near-zero repeat bugs from known AICODE-TRAPs**
- **Clear task queue visible to all AI sessions**
- **Business context preserved across refactors**

## 🎓 Philosophy

The AICODE protocol treats code comments as a **shared memory system** specifically designed for AI agents. The distinctive AICODE- prefix ensures:
- Instant recognition of agent-generated knowledge
- Clear separation from regular developer comments
- Easy filtering and processing by tools
- Consistent format across all codebases

By following these patterns, you create a living knowledge base that travels with the code, reducing cognitive load and preventing repeated mistakes.

**Remember**: Every AICODE comment is a message from one AI session to another - make it count.
