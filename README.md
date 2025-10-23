# Termux Discord Bridge

A small Discord bot (Node.js) that executes shell commands on the host (designed to run on Termux or similar). This repository is public — read the security notes carefully before using.

Features
- Execute arbitrary shell commands or run executable files/scripts via Discord messages.
- Two prefix options supported: the configured prefix (default `!term`) and a bare `!`.
- Access control: authorized users (from DISCORD_AUTH env or runtime-added users) only.
- Runtime management: owner can add/remove/list allowed user IDs with bot commands.
- Persistent runtime allowed users stored in `allowed_users.txt` (gitignored).

Quick safety summary (read first)
- This bot executes commands on your device. Only use with accounts you fully trust.
- Never commit secrets (DISCORD_TOKEN, .env) — use `.env` locally and .env.example in repo.
- Use OWNER_ID and AUTH_USER_IDS to restrict access. Rotate your token if it was ever exposed.
- Consider running the bot inside a sandbox/container and avoid adding it to public servers.

Run without changing directories
- The bot loads its .env from the bot directory automatically.
- Examples (replace /full/path with your path):
  - node /full/path/to/termux-bot/index.js
  - npm --prefix /full/path/to/termux-bot start
  - or from the bot directory: cd /full/path/to/termux-bot && npm start

Setup
1. Copy `.env.example` to `.env` in the bot directory and edit values (do not commit `.env`).
2. Install dependencies: `npm install`
3. Start the bot: `node index.js` or `npm start` (see absolute path options above).

Environment (see .env.example)
- DISCORD_TOKEN — bot token (keep secret)
- AUTH_USER_IDS — comma-separated user IDs allowed initially
- OWNER_ID — (optional) ID allowed to add/remove users at runtime
- PREFIX — default command prefix (default `!term`)
- EXEC_TIMEOUT_MS, MAX_BUFFER_BYTES — execution tuning

How to use (examples)
- Run a command: `! uptime` or `!term uptime`
- Execute a script file (must be accessible and executable by the bot process): `! ./script.sh` or `! python3 script.py`
- If you run a file by path, ensure working directory and file permissions are correct.

Owner/runtime user management
- Only OWNER_ID (first env ID by default) may run these:
  - List authorized IDs: `! listusers` or `!term listusers`
  - Add an authorized ID: `! adduser 123456789012345678`
  - Remove an authorized ID: `! removeuser 123456789012345678`
- Added IDs are saved to `allowed_users.txt` (this file is in .gitignore).

Security & best practices
- Do NOT add this bot to public servers.
- Keep AUTH_USER_IDS and OWNER_ID limited to trusted accounts.
- Use minimal privileges for the user running the bot; avoid running as root.
- Log and monitor usage; rotate tokens if compromise suspected.

Repository hygiene
- `.gitignore` excludes `.env` and `allowed_users.txt`. If you accidentally commit secrets, remove them from history and rotate tokens immediately.
- Consider adding secret-scanning GitHub Actions for CI.

Questions or want features?
- If you want file upload support for large outputs, slash-command conversion, or safer execution sandboxes, say which and I will add it.
