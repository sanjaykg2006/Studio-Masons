# Agent Workflow

Follow this process for every task:

1. Understand the user's specific request.
2. Identify the minimum files required.
3. Read only those files.
4. Implement the requested change.
5. Verify the result.
6. Stop when the task is complete.

Restrictions:

* Do not analyze the entire codebase unless explicitly asked.
* Do not read node_modules unless required for the task.
* Do not inspect unrelated files.
* Do not perform speculative fixes.
* Do not make unrelated improvements.
* Do not generate lengthy explanations.

Debugging:

* Start from the file or error mentioned by the user.
* Expand the search only when necessary.
* Find the root cause before proposing fixes.
* Prefer the smallest valid fix.

Output Format:

* Summary of changes.
* Files modified.
* Verification performed.
