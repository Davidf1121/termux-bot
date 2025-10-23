# Termux Discord Bridge

Short: a Discord bot that executes (restricted) shell commands on the host.

Important before publishing
- Never commit .env or any file with tokens. If you accidentally committed secrets, remove them from git history and rotate tokens immediately.
- Add `.env` and `allowed_users.txt` to .gitignore (already included).

Make the repo public
- If creating a new repo:
  - gh repo create <name> --public --source=. --remote=origin --push
- If repo already exists remotely:
  - gh repo edit OWNER/REPO --visibility public
  - or use the GitHub web UI: Settings → Danger Zone → Change repository visibility.

Commands to remove a tracked .env and push:
- git rm --cached .env
- git commit -m "Remove env from repo"
- git push

If secrets were committed historically, use an expunging tool (git filter-repo or BFG) and rotate tokens.

Security notes
- Only add trusted Discord user IDs to AUTH_USER_IDS or manage allowed users carefully.
- Use COMMAND_WHITELIST to limit allowed commands.
- Run the bot in a sandbox/container when possible.

Quick setup:
1. On Termux, install Node.js: `pkg install nodejs` (or your preferred method).
2. Clone or copy this project into /data/data/com.termux/files/home or another folder.
3. Create `.env` from `.env.example` and set DISCORD_TOKEN and AUTH_USER_IDS.
4. Install dependencies: `npm install`
5. Run: `node index.js` (or use a process manager like pm2)

Usage:
- In Discord, send a message starting with the configured PREFIX (default `!term`).
  Example: `!term uptime`
