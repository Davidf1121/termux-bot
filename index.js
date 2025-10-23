const { Client, GatewayIntentBits } = require('discord.js');
const { exec } = require('child_process');
require('dotenv').config();

const fs = require('fs');
const path = require('path');

const TOKEN = process.env.DISCORD_TOKEN;
// keep raw env list separate (immutable)
const AUTH_USER_IDS_ENV = (process.env.AUTH_USER_IDS || '').split(',').map(s => s.trim()).filter(Boolean);

const WHITELIST = (process.env.COMMAND_WHITELIST || '').split(',').map(s => s.trim()).filter(Boolean);
const PREFIX = process.env.PREFIX || '!term';
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

function isAllowedCommand(cmd) {
	if (WHITELIST.length === 0) return true;
	return WHITELIST.some(prefix => cmd === prefix || cmd.startsWith(prefix + ' ') || cmd.startsWith(prefix + '\t'));
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
		if (!content.startsWith(PREFIX)) return;

		// owner-only management commands (adduser, removeuser, listusers)
		const commandRaw = content.slice(PREFIX.length).trim();
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

		const command = commandRaw; // reuse parsed command raw
		if (!command) {
			await message.reply('No command provided.');
			return;
		}

		if (!isAuthorized(message.author.id)) {
			await message.reply('You are not authorized to run commands.');
			return;
		}

		if (!isAllowedCommand(command)) {
			await message.reply('This command is not allowed by the server whitelist.');
			return;
		}

		await message.channel.sendTyping();

		exec(command, { timeout: EXEC_TIMEOUT, maxBuffer: MAX_BUFFER, shell: '/bin/sh' }, (err, stdout, stderr) => {
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