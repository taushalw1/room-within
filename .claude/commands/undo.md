---
description: Undo the last change I asked for
---

Undo the most recent change.

1. Check `git status` and `git log --oneline -5` to see what has and hasn't
   been committed.
2. If there are uncommitted changes, those are the most recent work — describe
   in plain English what would be undone, and ask the user to confirm before
   discarding anything. Do not discard without a clear yes.
3. If everything is committed, the last change is the most recent commit.
   Describe it in plain English and confirm before reverting it with
   `git revert`.
4. After undoing, open the affected page in the browser preview so the user can
   see the site is back to how it was.

Never discard work without confirming first — she may have spent a while on it.
