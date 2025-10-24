# Termux Discord Bridge

A Discord bot (Node.js) that executes shell commands on the host. This repository is public — do NOT commit secrets.

Quick install
1. Copy `.env.example` to `.env` and edit values (do NOT commit `.env`).
2. In the bot directory run:
   - npm install
   - npm start

Note about node-pty and PTY-required commands
- `node-pty` is optional. The bot works without it for non-interactive commands.
- Commands that expect a pseudo-terminal (examples: `proot`, `proot-distro`, `top`, `htop`, interactive installers) will request node-pty at runtime if needed.
- If you want PTY support, install `node-pty` manually in the bot directory:
  - First check available versions: `npm view node-pty versions --json`
  - Then install a matching version: `npm install --save node-pty@<version>`
  - Or try: `npm install --save node-pty` (it will pick a compatible release)
- On Termux you may need build tools before installing native modules:
  - `pkg install clang make python pkg-config` (or equivalent)

Troubleshooting ETARGET / "No matching version" errors
- ETARGET means your package.json requested a version that npm can't find. Removing the problematic pin (done in this repo) fixes `npm install`.
- To find valid versions: `npm view node-pty versions --json`
- If a specific version is required by your environment, install that exact version with `npm install node-pty@x.y.z`.

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
