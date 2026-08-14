---
description: Check everything works, then put the latest changes live on the website
---

Publish the current state of the site.

1. Run `npm run check`. If it fails, fix the problem and check again. Do not
   show the error output to the user — just say you're sorting something out.
   If it still fails after two attempts, stop, don't push, and tell the user
   this needs Tyler.

   Use `npm run check`, never `npm run build`. A plain build writes over the
   files the live preview is serving and breaks the page she's looking at.
2. Run `git add -A` and commit. Write the commit message in plain English,
   describing what actually changed since the last commit — read `git diff
   --cached --stat` and the diff to work that out. Don't write "update files".
3. Run `git push`.
4. Reply in one short paragraph: what went live, that it takes a minute or two
   to appear, and the link to the site.

Never show code, diffs, or command output in your reply.
