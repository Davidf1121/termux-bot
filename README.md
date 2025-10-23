# Termux Discord Bridge (Node.js)

Quick setup:
1. On Termux, install Node.js: `pkg install nodejs` (or your preferred method).
2. Clone or copy this project into /data/data/com.termux/files/home or another folder.
3. Create `.env` from `.env.example` and set DISCORD_TOKEN and AUTH_USER_IDS.
4. Install dependencies: `npm install`
5. Run: `node index.js` (or use a process manager like pm2)

Usage:
- In Discord, send a message starting with the configured PREFIX (default `!term`).
  Example: `!term uptime`

Security notes (read carefully):
- This bot executes shell commands on the host. Only add trusted Discord user IDs to AUTH_USER_IDS.
- Use COMMAND_WHITELIST to restrict allowed commands where possible.
- Do NOT add this bot to public servers or authorize unknown users.
- Consider running the bot under a restricted Termux user or container, and keep backups.

This code is provided as-is. Review and adapt before running.
