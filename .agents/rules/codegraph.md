# CodeGraph Code Intelligence Rules

Always prioritize CodeGraph tools and commands for exploring, searching, and understanding the codebase:

1. **Codebase Exploration & Queries:**
   - Use `codegraph explore "<query or symbols>"` to get symbol definitions, implementations, and call paths in one call.
   - Use `codegraph node <symbol-or-file>` to inspect a specific function, class, or file with line numbers, callers, and callees.
   - Use `codegraph callers <symbol>` and `codegraph callees <symbol>` to trace call hierarchies.
   - Use `codegraph impact <symbol>` to analyze affected files and components before making refactoring changes.

2. **Index Maintenance:**
   - After adding, moving, or modifying files, run `npx @colbymchenry/codegraph sync` to keep the `.codegraph/` index fresh.
   - Run `npx @colbymchenry/codegraph status` to check index health.

3. **Fallback:**
   - Only fall back to grep or direct file scans when searching raw string literals, translations JSON, or non-code configuration files.
