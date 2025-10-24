const { Client, GatewayIntentBits } = require('discord.js');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
// load .env located in the bot directory (so running node from another cwd still picks it up)
require('dotenv').config({ path: path.join(__dirname, '.env') });

const TOKEN = process.env.DISCORD_TOKEN;
// keep raw env list separate (immutable)
const AUTH_USER_IDS_ENV = (process.env.AUTH_USER_IDS || '').split(',').map(s => s.trim()).filter(Boolean);

const PREFIX = process.env.PREFIX || '!term';
// accept both configured prefix and bare "!" (avoid duplicates)
const PREFIX_ALIASES = Array.from(new Set([PREFIX, '!'])).sort((a, b) => b.length - a.length);
const EXEC_TIMEOUT = parseInt(process.env.EXEC_TIMEOUT_MS || '10000', 10);
const MAX_BUFFER = parseInt(process.env.MAX_BUFFER_BYTES || '200000', 10);

if (!TOKEN) {
	console.error('DISCORD_TOKEN is required in environment.');
	process.exit(1);
}
if (AUTH_USER_IDS_ENV.length === 0) {
	console.error('AUTH_USER_IDS must contain at least one Discord user ID.');
	process.exit(1);
}

// file to persist additional allowed users (one ID per line)
const ALLOWED_USERS_FILE = path.join(__dirname, 'allowed_users.txt');

// state file to persist current working directory
const STATE_FILE = path.join(__dirname, 'state.json');
let currentDir = process.cwd();

// load file-managed user IDs
let fileUserIds = new Set();
function loadFileUserIds() {
	try {
		if (!fs.existsSync(ALLOWED_USERS_FILE)) return;
		const raw = fs.readFileSync(ALLOWED_USERS_FILE, 'utf8');
		raw.split(/\r?\n/).map(s => s.trim()).filter(Boolean).forEach(id => fileUserIds.add(id));
	} catch (e) {
		console.error('Failed to load allowed users file:', e);
	}
}
function saveFileUserIds() {
	try {
		const arr = Array.from(fileUserIds);
		fs.writeFileSync(ALLOWED_USERS_FILE, arr.join('\n'), 'utf8');
	} catch (e) {
		console.error('Failed to save allowed users file:', e);
	}
}
loadFileUserIds();

// load persisted cwd if available
function loadState() {
	try {
		if (!fs.existsSync(STATE_FILE)) return;
		const raw = fs.readFileSync(STATE_FILE, 'utf8');
		const j = JSON.parse(raw);
		if (j && j.cwd && typeof j.cwd === 'string' && fs.existsSync(j.cwd) && fs.statSync(j.cwd).isDirectory()) {
			currentDir = j.cwd;
		}
	} catch (e) {
		console.error('Failed to load state:', e);
	}
}
function saveState() {
	try {
		fs.writeFileSync(STATE_FILE, JSON.stringify({ cwd: currentDir }), 'utf8');
	} catch (e) {
		console.error('Failed to save state:', e);
	}
}
loadState();

// merged set of authorized IDs (env + file)
const AUTH_USER_IDS = new Set([...AUTH_USER_IDS_ENV, ...fileUserIds]);

if (AUTH_USER_IDS.size === 0) {
	console.error('AUTH_USER_IDS must contain at least one Discord user ID (env or allowed_users.txt).');
	process.exit(1);
}

// designate an owner (first env ID if provided, otherwise first from file)
// only the owner can add/remove users at runtime
const OWNER_ID = process.env.OWNER_ID || AUTH_USER_IDS_ENV[0] || Array.from(fileUserIds)[0];

const client = new Client({
	intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.DirectMessages]
});

function isAuthorized(userId) {
	return AUTH_USER_IDS.has(userId);
}

// replace isAllowedCommand to allow any command
function isAllowedCommand(cmd) {
	// whitelist removed: allow any command
	return true;
}

function chunkString(str, size) {
	const chunks = [];
	for (let i = 0; i < str.length; i += size) chunks.push(str.slice(i, i + size));
	return chunks;
}

client.on('ready', () => {
	console.log(`Logged in as ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
	try {
		if (message.author.bot) return;

		const content = message.content.trim();

		// accept any of the alias prefixes (longest-first)
		const matchedPrefix = PREFIX_ALIASES.find(p => content.startsWith(p));
		if (!matchedPrefix) return;

		// owner-only management commands (adduser, removeuser, listusers)
		const commandRaw = content.slice(matchedPrefix.length).trim();
		const [cmd, ...args] = commandRaw.split(/\s+/);

		if (cmd === 'adduser' || cmd === 'removeuser' || cmd === 'listusers') {
			if (!OWNER_ID) {
				await message.reply('No owner configured; cannot manage users.');
				return;
			}
			if (message.author.id !== OWNER_ID) {
				await message.reply('Only the bot owner can manage allowed users.');
				return;
			}

			if (cmd === 'listusers') {
				const list = Array.from(AUTH_USER_IDS).join('\n') || '(none)';
				await message.reply('Authorized user IDs:\n' + '```' + list + '```');
				return;
			}

			const targetId = args[0];
			if (!targetId) {
				await message.reply('Usage: ' + PREFIX + ' adduser <discord_user_id> OR ' + PREFIX + ' removeuser <discord_user_id>');
				return;
			}

			if (cmd === 'adduser') {
				if (AUTH_USER_IDS.has(targetId)) {
					await message.reply('User ID already authorized.');
					return;
				}
				// persist to file-managed set and update merged set
				fileUserIds.add(targetId);
				saveFileUserIds();
				AUTH_USER_IDS.add(targetId);
				await message.reply('Added user ID: ' + targetId);
				return;
			}

			if (cmd === 'removeuser') {
				if (!AUTH_USER_IDS.has(targetId)) {
					await message.reply('User ID not found in authorized list.');
					return;
				}
				// only remove from file-managed set; env IDs remain
				if (fileUserIds.has(targetId)) {
					fileUserIds.delete(targetId);
					saveFileUserIds();
					AUTH_USER_IDS.delete(targetId);
					await message.reply('Removed user ID: ' + targetId);
					return;
				} else {
					await message.reply('Cannot remove env-provided ID. Remove it from the DISCORD_AUTH env variable instead.');
					return;
				}
			}
		}

		// After owner-management, require authorization for normal commands
		if (!isAuthorized(message.author.id)) {
			await message.reply('You are not authorized to run commands.');
			return;
		}

		const command = commandRaw; // reuse parsed command raw
		if (!command) {
			await message.reply('No command provided.');
			return;
		}

		// handle builtin `cd` command locally so working directory persists
		if (command === 'cd' || command.startsWith('cd ')) {
			const targetRaw = command === 'cd' ? '' : command.slice(3).trim();
			let target;
			if (!targetRaw) {
				target = process.env.HOME || os.homedir() || currentDir;
			} else if (targetRaw.startsWith('~')) {
				target = path.resolve((process.env.HOME || os.homedir()), targetRaw.slice(1));
			} else if (path.isAbsolute(targetRaw)) {
				target = targetRaw;
			} else {
				target = path.resolve(currentDir, targetRaw);
			}

			try {
				if (!fs.existsSync(target) || !fs.statSync(target).isDirectory()) {
					await message.reply(`cd: no such directory: ${target}`);
					return;
				}
				currentDir = target;
				saveState();
				await message.reply(`Changed directory to: \`${currentDir}\``);
			} catch (e) {
				await message.reply('cd error: ' + (e.message || String(e)));
			}
			return;
		}

		// decide whether to run via PTY (for commands that expect a terminal)
		const needPty = /\b(proot|proot-distro|top|htop|passwd|sudo)\b/.test(command);

		await message.channel.sendTyping();

		if (needPty) {
			// If pty is not available, inform user
			if (!pty) {
				await message.reply('This command requires a pseudo-terminal (PTY). Install node-pty in the bot directory: `npm install node-pty` and restart the bot.');
				return;
			}

			// spawn a shell in a PTY and run the command
			try {
				let collected = '';
				// spawn a login shell running the command
				const ptyProcess = pty.spawn('/bin/sh', ['-lc', command], {
					name: 'xterm-color',
					cwd: currentDir,
					env: process.env,
					cols: 120,
					rows: 40
				});

				// collect output
				ptyProcess.onData((data) => {
					collected += data;
					// avoid unbounded growth in extreme cases
					if (collected.length > MAX_BUFFER) {
						collected = collected.slice(-MAX_BUFFER);
					}
				});

				// timeout/kill guard
				const killTimer = setTimeout(() => {
					try { ptyProcess.kill(); } catch (_) {}
				}, EXEC_TIMEOUT + 2000);

				ptyProcess.onExit(async () => {
					clearTimeout(killTimer);
					const out = collected || '(no output)';
					const chunks = chunkString(out, 1900);
					for (const c of chunks) {
						await message.reply('```' + c + '```');
					}
				});
			} catch (e) {
				await message.reply('PTY execution error: ' + (e.message || String(e)));
			}
			return;
		}

		// fallback: normal exec for non-interactive commands
		exec(command, { timeout: EXEC_TIMEOUT, maxBuffer: MAX_BUFFER, shell: '/bin/sh', cwd: currentDir }, (err, stdout, stderr) => {
			let reply = '';
			if (err) {
				reply += `Exit/Error: ${err.code || err.message}\n`;
			}
			if (stdout) reply += `STDOUT:\n${stdout}\n`;
			if (stderr) reply += `STDERR:\n${stderr}\n`;
			if (!reply) reply = '(no output)';

			// Chunk and send to avoid message length limits
			const chunks = chunkString(reply, 1900);
			(async () => {
				for (const c of chunks) {
					// send as code block for readability
					await message.reply('```' + c + '```');
				}
			})();
		});
	} catch (e) {
		console.error('message handler error', e);
	}
});

client.login(TOKEN);