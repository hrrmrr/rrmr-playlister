import fs from 'fs';
import path from 'path';
import WebSocket from 'ws';
import http from 'http';
import readline from 'readline';
import { bumpers } from './bumpers.mjs';
import { trolls } from './trolls.mjs';

//	These two variables must be updated EVERY TIME before the code is run.
//	You can get these by logging in via Twitch with the BROADCASTER_TWITCH_NAME account at https://ytvizzy.com/bot
var BROADCASTER_OAUTH = 'xnytk2uy16my28yv479m436dptg3bd';
var BROADCASTER_REFRESH = 'fqmsv7ofdca67wmmt7bst22chxst93emw86diee38zwqni146v';
/*
	If website is unavailable, you'll need to authorize with twitch.
	Full functionality requires the following scopes: user:bot, user:read:chat, user:write:chat, channel:read:redemptions, channel:manage:redemptions, channel:manage:vips
	See included files in /twitch_authorize directory for a simple PHP example (and the required app client ID). 
	See also https://dev.twitch.tv/docs/authentication/getting-tokens-oauth/#authorization-code-grant-flow for confusing details.
*/

//	IMPORTANT: USERNAMES IN THE CODE MUST BE IN ALL LOWERCASE.
//	Using mixed case will cause the code to fail at identifying users.
//	This goes for BROADCASTER_TWITCH_NAME, BOT_ADMINS, TWITCH_MODS, USERS_VIP, everything.

var BROADCASTER_TWITCH_NAME = 'username';		// Name of the account the bot will be running as. 
var BROADCASTER_USER_ID = '12345678901';		// Numeric ID for that account, converter: https://betterbanned.com/en/tools/convert-twitch-username-to-channel-id

// Users with bot superpowers.
// BOT_ADMINS can use all commands, make infinite requests without time restrictions, and request full playlists.
var BOT_ADMINS = [BROADCASTER_TWITCH_NAME, 'hrrmrrfrrmrr'];		// Yes, you probably want to remove hrrmrrfrrmrr

// Your mods on twitch.
// Only required if is_vipAutomatic (below) is set to true *or* the "Skip! [mods only]" redeem is active.
var TWITCH_MODS = [
	BROADCASTER_TWITCH_NAME
	// , 'other_mod'
];

var maxRequests = 5;			// Number of requests each user is allowed
var is_rolling = true;			// if true, users may have up to "maxRequests" requests in the queue at once
								// if false, users may only make "maxRequests" requests per stream

const MIN_SPACING = 2;			// Number of requests to put between requests from any one user (when possible)

var is_queuePublic = true;		// if true, BROADCASTER_TWITCH_NAME's requests will appear in the !queue

var is_groupByArtist = true;	// if true, bot will automatically group the same artist together in the queue
const MAX_GROUPING = 5;			// The most videos by the same artist that can be grouped together at once.

var is_greet = false;			// if true, bot will say BOT_GREETING to first time chatters
const BOT_GREETING = "VoHiYo";	// Can include emotes or just text

const is_redeemsActive = false;	// if true, bot will monitor channel point redeems
const is_favoriteActive = false;	// if true, !favorite and all releated functionality will be active
const is_imagesActive = false;	// if true, any links from giphy.com or gifdb.com in chat will be displayed on screen

const is_vipAutomatic = false;	// if true, users will be made VIP when they make a request (badges removed on !shutdown)
// if is_vipAutomatic is true, populate USERS_VIP with users you want to be permanently VIP
var USERS_VIP = ['vip_username'];

const MAX_LENGTH_SS = 600;						// Max. video length (in seconds) for a request
const MAX_LENGTH_LABEL = "10 minutes";			// Label to display in error messages
const LASTCALL_MAX_LENGTH_SS = 900;				// Max. video length (in seconds) during lastcall (and "Play an extra long song!" redeems)
const LASTCALL_MAX_LENGTH_LABEL = "15 minutes";	// Label to display in error messages

// Max. video length (in seconds) to be considered a "short", 0 to disable
// "Short" videos do not count as a request and automatically play after the current video
// Value should match SHORTS_LEN_SS in index.html
const SHORTS_LEN_SS = 100;		

// How long to wait after the client starts a new video before announcing it (in miliseconds)
// This is to compensate for the time between the client and when users actually see the video begin
// Value should be equal to (or slightly less than) LATENCY_MS in index.html
const LATENCY_MS = 13333;		

const USERS_IGNORED = [BROADCASTER_TWITCH_NAME, 'deepbot', 'fossabot', 'kofistreambot', 'moobot', 'nightbot', 'sery_bot', 'songlistbot', 'streamelements', 'streamlabs', 'tangerinebot', 'wizebot'];

// Users in USERS_LIMITED are unable to request the same artist twice in the same stream.
const USERS_LIMITED = [
	'bad_requester_name'
];


//////////////// Edit below this line at your own peril. ////////////////
const DEBUG = false;	// if true, be verbose about debug info

var STREAM_NUM = new Date().toISOString().split('T')[0];
const LOG_FILENAME = "_playlists/" + STREAM_NUM + "_playlist.txt";
const FAVS_LOG_FILENAME = "_favorites/" + STREAM_NUM + "_favorites.txt";

if (!fs.existsSync("./_playlists")) { fs.mkdirSync("./_playlists", { recursive: true }); console.log("Created playlists directory."); }
if (!fs.existsSync("./_favorites")) { fs.mkdirSync("./_favorites", { recursive: true }); console.log("Created favorites directory."); }
if (!fs.existsSync("./_points")) { fs.mkdirSync("./_points", { recursive: true }); console.log("Created points directory."); }

const MOD_COMMANDS = ['!play', '!pause', '!skip', '!break', '!unbreak', '!invert', '!spin', '!label', '!nolabel'];
const alias = {
	"!sr" : "!songrequest"
	, "!st" : "!songrequest"	// a common typo

	, "!link" : "!song"

	, "!ws" : "!wrongsong"

	, "!schedule" : "!queue"
	, "!s" : "!queue"
	, "!q" : "!queue"
	, "!ql" : "!queue"
	, "!sq" : "!queue"
	, "!que" : "!queue"

	, "!n" : "!skip"

	, '!ungroup' : '!nogroup'

	, "!pos" : "!setpos"

	, '!m' : '!move'

	, '!find' : '!search'
	, '!sq' : '!search'

	, "!ded" : "!dedicate"
	, "!d" : "!dedicate"
	, "!srs on" : "!open"
	, "!srs off" : "!close"

	, '!qn' : '!queuenext'
	, '``' : '!queuenext'

	, '!bump' : '!bumper'
	, '!b' : '!bumper'
	, '!t' : '!troll'

	, '!sq' : '!showqueue'
	, '!hq' : '!hidequeue'

	, '!favourite' : '!favorite'
	, '!fave' : '!favorite'
	, '!fav' : '!favorite'
	, '!f' : '!favorite'
	, '1f' : '!favorite'

	, '!favouritelast' : '!favoritelast'
	, '!favelast' : '!favoritelast'
	, '!favlast' : '!favoritelast'
	, '!fl' : '!favoritelast'
	, '1fl' : '!favoritelast'

	, '!myfavourites' : '!myfavorites'
	, '!myfavorite' : '!myfavorites'
	, '!myfaves' : '!myfavorites'
	, '!myfave' : '!myfavorites'
	, '!myfav' : '!myfavorites'
	, '!mytop' : '!myfavorites'
	, '!mf' : '!myfavorites'

	, '!myfan' : '!myfans'
	, '!who' : '!myfans'

	, '!myreqs' : '!mine'
	, '!myreq' : '!mine'
	, '!my' : '!mine'

	, '!next' : '!when'
	, '!w' : '!when'

	, '!last' : '!lastsong'
	, '!ls' : '!lastsong'

	, '!point' : "!points"
	, '!pts' : "!points"
	, '!pt' : "!points"

	, '!leaderboard' : "!top"
	, '!lb' : "!top"

	, '!gc' : "!grantcount"

	, '!vid' : "!video"
	, '!v' : "!video"

	, '!novid' : "!novideo"
	, '!nov' : "!novideo"
	, '!nv' : "!novideo"

	, '!sd' : '!shutdown'
	, '!title' : '!settitle'
	, '!tit' : '!settitle'
};


//// Internal use only, don't touch. ////
var websocketSessionID;
var websocketClient;
const CLIENT_ID = 'udr74w98aqicso6yo5ssc1gg9qiynx';
const CLIENT_SECRET = '8fg0z8403nyq5ph4tfipmk7abepdao';

// var is_greet = true;
var firsts = {};
USERS_IGNORED.forEach(function(who, idx) { firsts[who] = true; });

var requesters = {};
var favorites = {};
var points = {};

var bonusReqs = {};
var lastcalls = {};
var playNexts = {};
var longSongs = {};
var shorts = {};
shorts[BROADCASTER_TWITCH_NAME] = true;		// Prevents "shorts" from BROADCASTER_TWITCH_NAME from being bumped up.

var curQueue = -1;
var queue = [];
var commands = [];
var requests = [];
var is_on = true;
var is_open = true;
var is_lastcall = false;
var is_announced = false;
var is_firstOut = false;

const ENTER = "\r\n";

var log_count = 0;
var whenAdjust = 0;
var captainDJ = false;
var userIDs = {};	

// var skipInterval;
////////////////////////////////////////////////////////////////////////////////////////////////////


// Take input from the console as if it were twitch chat
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
rl.on('line', (input) => { processChatMessage(input, BROADCASTER_TWITCH_NAME, false); });

function countFiles(dirPath) {
  try {
    const entries = fs.readdirSync(dirPath);
    let fileCount = 0;

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry);
      const stat = fs.statSync(fullPath);
      if (stat.isFile()) fileCount++;
    }

    return fileCount;
  } catch (err) {
    console.error('Error counting files:', err);
    return 0;
  }
}


// Start executing the bot from here
(async () => {
	await getAuth();
	startWebSocketClient();
})();


async function getAuth() {
	// https://dev.twitch.tv/docs/authentication/validate-tokens/#how-to-validate-a-token
	let response = await fetch('https://id.twitch.tv/oauth2/validate', {
		method: 'GET',
		headers: { 'Authorization': 'OAuth ' + BROADCASTER_OAUTH }
	});

	if (response.status != 200) {
		let data = await response.json();
		console.error("Token is not valid. /oauth2/validate returned status code " + response.status);
		console.error(data);
		process.exit(1);
	}

	console.log("Validated access token.");
}

async function refreshAccessToken() {
    try {
        const response = await fetch('https://id.twitch.tv/oauth2/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                client_id: CLIENT_ID,
                client_secret: CLIENT_SECRET,
                grant_type: 'refresh_token',
                refresh_token: BROADCASTER_REFRESH
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('Failed to refresh access token:', errorData);
            // process.exit(1); // Exit if the token cannot be refreshed
        }
        else {
	        const data = await response.json();
	        console.log('Access token refreshed successfully.');
	        // console.log('Access token refreshed successfully:', data);

	        // Update the global BROADCASTER_OAUTH and BROADCASTER_REFRESH
	        BROADCASTER_OAUTH = data.access_token;
	        if (data.refresh_token) BROADCASTER_REFRESH = data.refresh_token;
        }
    } catch (error) {
        console.error('Error refreshing access token:', error);
        refreshAccessToken();
        // process.exit(1); // Exit if there’s a critical error
    }
}

var reconnectTimeout;
function startWebSocketClient() {
	websocketClient = new WebSocket('wss://eventsub.wss.twitch.tv/ws');

	websocketClient.on('error', console.error);

	websocketClient.on('open', () => { 
		clearInterval(reconnectTimeout);
		console.log('WebSocket connection opened to Twitch.'); 
	});

	websocketClient.on('close', () => { 
		console.log('WebSocket connection closed!  Reconnecting in 10 sec.'); 

		clearInterval(reconnectTimeout);
		reconnectTimeout = setInterval(function() { startWebSocketClient(); }, 10000);
	});

	websocketClient.on('message', (data) => {
		clearInterval(reconnectTimeout);
		handleWebSocketMessage(JSON.parse(data.toString())); 
	});

	// return websocketClient;
}

function isNumeric(value) { return !isNaN(value) && !isNaN(parseFloat(value)); }

function processChatReply(chatReply, msg) {
	if (chatReply == 'both') {
		sendChatMessage(msg);
		console.log(msg);
	}
	else if (chatReply) sendChatMessage(msg);
	else console.log(msg);
}

function processChatMessage(msg, userName, chatReply = true) {
	let is_mod = BOT_ADMINS.includes(userName); // isBotAdmin(userName);

	if (is_greet && !firsts[userName]) {
		firsts[userName] = true;
		sendChatMessage("@" + userName + " " + BOT_GREETING);
	}

	msg = msg.replace(/["\\]/g, " ").replace(/\s+/g, ' ').trim();

	// convert from google URL
	// https://www.google.com/url?sa=t&source=web&rct=j&opi=89978449&url=https://www.youtube.com/watch%3Fv%3DhRIRTQ_k-Sg&ved=2ahUKEwigw82TqJONAxW1LtAFHY-KBToQ6soFegUIABCkCQ&usg=AOvVaw3vXug3g9nh7ijlPq3kL6kS
	if (msg.indexOf('https://www.google.com/url') == 0 && msg.indexOf('https://www.youtube.com/watch') != -1) {
		msg = msg.substr(msg.indexOf('https://www.youtube.com/watch'));
		if (msg.indexOf('&') != -1) msg = msg.substr(0, msg.indexOf('&'));
		msg = msg.replace(/%3F/g, '?').replace(/%3D/g, '=').replace(/%26/g, '&');
	}

	// fix missing https://
	if (msg.indexOf('youtu.be/') == 0 || msg.replace('www.', '').replace('m.', '').replace('music.', '').indexOf('youtube.com/') == 0)
		msg = 'https://' + msg;

	// add !songrequest if just a URL
	if (
		msg.indexOf('https://youtu.be/') == 0
		|| msg.replace('www.', '').indexOf('https://youtube.com/shorts/') == 0 
		|| msg.indexOf('https://www.youtube.com/playlist?list=') == 0 
		|| msg.indexOf('https://www.youtube.com/results?search_query=') == 0 
		|| (msg.indexOf('https://') == 0 && msg.indexOf('youtube.com/watch') != -1)
	)
		msg = '!songrequest ' + msg;
	else if (
		msg.indexOf('https://giphy.com/gifs/') == 0
		|| msg.replace(/[0-9]/g, '').indexOf('https://media.giphy.com/media/') == 0
		|| msg.indexOf('https://gifdb.com/images/') == 0
		|| msg.indexOf('https://gifdb.com/gif/') == 0
	)
		msg = '!image ' + msg;

	let first = msg.toLowerCase().split(' ')[0];
	for (let key in alias) {
		if (first == key) {
			first = alias[key].split(" ")[0];
			if (msg.indexOf(" ") == -1) msg = alias[key];
			else msg = alias[key] + " " + msg.substr(msg.indexOf(" ") + 1);
		}
	}

	if (DEBUG) console.log('msg: ' + msg);

	if (first == '!songrequest' || first == '!queuenext') {
		let queueNext = false;
		if (first == '!queuenext') {
			if (is_mod) {
				queueNext = true;
				msg = msg.replace('!queuenext ', '');
			}
			else {
				sendChatMessage('Sorry @' + userName + ", that's an admin-only command.");
				return;
			}
		}
		else
			msg = msg.replace('!songrequest ', '');

		if (!is_mod) {
			if (!is_on) {
				sendChatMessage('Sorry @' + userName + ", but we're no longer taking requests!");
				return;
			}
		}

		// Send request to the client for youtube data
		let req = {
			"result" : "request"
			, "requester" : userName
			, "query" : ""
			, "id_yt" : ""
			, "id_pl" : ""
			, "chatReply" : chatReply
			, "is_mod" : is_mod
			, "is_userLimited" : (USERS_LIMITED.includes(userName) && !is_mod)
			, "is_latest" : true
			, "startSeconds" : 0
		};
		if (queueNext) req.next = 1;

		if (is_mod && msg.indexOf('@') == 0) {
			let space = msg.indexOf(' ');
			req.requester = msg.substr(0, space).replace('@', '').trim().toLowerCase();
			msg = msg.substr(space).trim();
		}

		if (msg.indexOf('https://') == 0) {
			// https://www.youtube.com/watch?app=desktop&v=fdgdtRv8tGg
			let vPos = msg.indexOf('&v=');
			if (msg.indexOf('youtube.com/watch?') != -1 && vPos != -1)
				msg = 'https://youtu.be/' + msg.substr(vPos + 3);

			req.id_yt = msg
				.replace('youtube.com/watch?v=', 'youtu.be/')
				.replace('youtube.com/shorts/', 'youtu.be/')
				.replace('m.', '')
				.replace('www.', '')
				.replace('music.', '')
				.split('?')[0]
				.split('&')[0]
				.split(' ')[0]
			;

			// https://youtu.be/NF0KRBSwqWI?t=86
			vPos = msg.indexOf('&t=');
			if (vPos == -1) vPos = msg.indexOf('?t=');
			if (vPos != -1) {
				try {
					req.startSeconds = msg.substr(vPos + 3);
					if (req.startSeconds.indexOf("&") > 0)
						req.startSeconds = req.startSeconds.substr(0, req.startSeconds.indexOf("&"));
					req.startSeconds = parseInt(req.startSeconds);
					if (req.startSeconds < 6) req.startSeconds = 0;
				}
				catch (error) { }
			} 

			if (req.id_yt.indexOf('https://youtu.be/') == 0) {
				req.id_yt = req.id_yt.split('https://youtu.be/')[1];
				if (DEBUG) console.log('id_yt: ' + req.id_yt);
			}
			else if (msg.indexOf('youtube.com/results?search_query=') != -1) {
				req.id_yt = '';
				req.query = msg.split('youtube.com/results?search_query=')[1].split('&')[0].replace(/\+/g, ' ');
			}
			else if (is_mod && msg.indexOf('youtube.com/playlist?list=') != -1) {
				// https://www.youtube.com/playlist?list=PLGI55acJeEwOIaaYbXPCziJHfZCRPDJg7
				req.id_yt = '';
				req.id_pl = msg.split('youtube.com/playlist?list=')[1].split('&')[0];
			}
			else {
				processChatReply(chatReply, 'Sorry @' + userName + ', only youtube video URLs are accepted.');
				return;
			}
		}
		else if (msg.indexOf(' ') == -1 && msg.length > 7 && msg.length < 13)
			req.id_yt = msg;
		else if (msg.length < 5) {
			processChatReply(chatReply, 'Sorry @' + userName + ', searches must contain at least 5 characters.');
			return;
		}
		else {
			req.query = msg.replace(/- /g, ' ').replace(/ -/g, ' ').replace(/[()\[\]]/g, ' ').replace(/\s+/g, ' ');
		}

		if (req.id_yt.length >= 7) {
			let is_dupe = false;
			requests.forEach(function(track, idx) {
				if (track.id_yt == req.id_yt) is_dupe = true;
			});

			if (!is_dupe) requests.push(req);
		}
		else if (req.id_pl.length >= 11 || req.query.length >= 3) // req.id_yt.length >= 7 || 
			requests.push(req);
		else
			console.log("Invalid request.", req);
	}
	else if (first == '!wrongsong') { // remove song
		msg = msg.replace('!wrongsong', '').trim().toLowerCase();
		if (is_mod && msg.indexOf('@') == 0) {
			userName = msg.split(' ')[0].replace('@', '');
			msg = msg.substr(userName.length + 1);
		}

		let qIdx = -1;
		let lastIdx = -1;
		let msgIdx = -1;
		const to = queue.length;
		for (var i = curQueue + 1; i < to; i++) {
			if (queue[i].requester && queue[i].requester == userName) {
				qIdx = i;
				if (queue[i].is_latest) lastIdx = i;
				if (msg && queue[i].title?.toLowerCase().indexOf(msg) != -1) msgIdx = i;
			}
		}

		if (msgIdx != -1) qIdx = msgIdx;
		else if (lastIdx != -1) qIdx = lastIdx;

		var retMsg = '';
		if (qIdx != -1) {
			retMsg = "Removed @" + userName + "'s request '" + queue[qIdx].title + "' from queue.";
			queue.splice(qIdx, 1);

			if (requesters[userName] > 1) requesters[userName]--;
			else delete requesters[userName];
			if (requesters[userName] >= maxRequests || lastcalls[userName]) bonusRequest(userName);

			consoleQueue();
		}
		else retMsg = 'No upcoming requests found for @' + userName + '.';

		processChatReply('both', retMsg);
	}
	else if (first == '!queue') {
		if (chatReply) {
			let upNext = '';
			let comma = '';
			for (var i = curQueue + 1 - whenAdjust; i < queue.length && upNext.length < 133 && upNext.indexOf('Secret sauce!') == -1; i++) {
				if (is_queuePublic || (queue[i].requester && queue[i].requester != BROADCASTER_TWITCH_NAME)) {
					upNext += comma + queue[i].title;
					comma = ', ';
				}
			}

			if (upNext == '') processChatReply(chatReply, 'No songs in queue!  Request something!');
			else processChatReply(chatReply, 'Up soon: ' + upNext);
		}
		else {
			if (curQueue >= queue.length) console.log('No songs in queue!');
			else consoleQueue();
		}
	}
	else if (first == '!when') {
		let upNext = '';
		for (var i = curQueue + 1 - whenAdjust; i < queue.length && upNext == ''; i++) {
			if (queue[i].requester == userName) {
				let diff = i - curQueue + whenAdjust;
				if (diff == 1)
					upNext = "@" + userName + " Your request, " + queue[i].title + ', is up next!';
				else 
					upNext = "@" + userName + " Your next request, " + queue[i].title + ', plays in ' + diff + ' songs.';
			}
		}

		if (upNext == '') processChatReply(chatReply, 'Sorry @' + userName + ", but you don't have any upcoming requests in the queue.");
		else processChatReply(chatReply, upNext);
	}
	else if (first == '!mine') {
		let upNext = "";
		let comma = '';
		let more = 0;
		for (var i = curQueue + 1 - whenAdjust; i < queue.length; i++) {
			if (queue[i].requester == userName) {
				if (upNext.length < 250) {
					upNext += comma + queue[i].title.substr(0, 40) + (queue[i].title.length > 40 ? "…" : "");
					comma = ", ";
				}
				else more++;
			}
		}

		if (upNext == '') processChatReply(chatReply, 'Sorry @' + userName + ", but you don't have any upcoming requests in the queue.");
		else processChatReply(chatReply, '@' + userName + "'s requests: " + upNext + (more > 0 ? " (" + more + " more)" : ""));
	}
	else if (first == '!song') {
		try {
			let reply = "Now: " + queue[curQueue - whenAdjust].title;
			if (queue[curQueue - whenAdjust].requester) reply += ", req by @" + queue[curQueue - whenAdjust].requester;
			reply += ".  https://youtu.be/" + queue[curQueue - whenAdjust].id_yt; // + " [" + (curQueue + 1) + " of " + queue.length + "]";

			processChatReply(chatReply, reply);
		}
		catch (error) { }
	}
	else if (first == '!lastsong') {
		try {
			let reply = "Previously: " + queue[curQueue - 1 - whenAdjust].title;
			if (queue[curQueue - 1 - whenAdjust].requester) reply += ", req by @" + queue[curQueue - 1 - whenAdjust].requester;
			reply += ".  https://youtu.be/" + queue[curQueue - 1 - whenAdjust].id_yt; // + " [" + (curQueue + 1) + " of " + queue.length + "]";

			processChatReply(chatReply, reply);
		}
		catch (error) { }
	}
	else if (first == '!next') {
		try {
			let reply = "Next: " + queue[curQueue + 1 - whenAdjust].title;
			if (queue[curQueue + 1 - whenAdjust].requester) reply += ", req by @" + queue[curQueue + 1 - whenAdjust].requester;
			reply += ".  https://youtu.be/" + queue[curQueue + 1 - whenAdjust].id_yt; // + " [" + (curQueue + 1) + " of " + queue.length + "]";

			processChatReply(chatReply, reply);
		}
		catch (error) { }
	}
	else if (first == '!dedicate') {
		try {
			let to = msg.replace('!dedicate ', '');
			processChatReply(true, userName + " would like to dedicate " + queue[curQueue - whenAdjust].title + " to " + to + ".");
		}
		catch (error) { }
	}
	else if (first == '!yay') {
		commands.push({ "result" : "sound", "file" : "yay" });
	}
	else if (first == '!clap') {
		commands.push({ "result" : "sound", "file" : "claps" });
	}
	else if (first == '!rejoice') {
		commands.push({ "result" : "sound", "file" : "rejoice" });
	}
	else if (first == '!favorite' && is_favoriteActive) {
		commands.push({ "result" : "favorite", "userName" : userName, "comment" : msg.replace('!favorite', '').trim() });
	}
	else if (first == '!favoritelast' && is_favoriteActive) {
		commands.push({ "result" : "favoritelast", "userName" : userName, "comment" : msg.replace('!favoritelast', '').trim() });
	}
	else if (first == '!myfavorites' && is_favoriteActive) {
		try {
			myFavorites(userName);
		} catch (e) { }
	}
	else if (first == '!myfans') {
		try {
			yourFavorites(userName);
		} catch (e) { }
	}
	else if (first == '!points' && is_favoriteActive) {
		let splitMsg = msg.split(" ");
		if (splitMsg.length > 1 && splitMsg[1].length) userName = splitMsg[1].toLowerCase().replace('@', '');

		if (points[userName] === undefined) {
			var dir = '_points/' + userName;

			if (fs.existsSync(dir)) {
				points[userName] = countFiles(dir);
				processChatReply(true, '@' + userName + "'s requests have been favorited " + points[userName] + " times.");
			}
			else
				processChatReply(true, '@' + userName + "'s requests have been favorited 0 times.");
		}
		else
			processChatReply(true, '@' + userName + "'s requests have been favorited " + points[userName] + " times.");
	}
	else if (first == '!top') {
		try {
			let sortedKeys = Object.keys(points).sort((k1, k2) => points[k2] - points[k1]);
			let top5 = '';
			let comma = '';
			let cnt = 0;

			for (let i = 0; i < sortedKeys.length && top5.length < 250; i++) {
			  const key = sortedKeys[i];
			  if (!USERS_IGNORED.includes(key) && points[key]) {
				  top5 += comma + key + " (" + points[key] + " pts)";
				  comma = ", ";
				  cnt++;
			  }
			}

			if (top5 == '') top5 = "No users with points found!  Try again later!";
			else top5 = "Top " + cnt + ": " + top5;
			processChatReply(true, top5);
		}
		catch (e) { console.log('!top error'); }
	}
	else if (first == '!video') {
		commands.push({ "result" : "video" });
	}
	else if (first == '!novideo') {
		if (queue[curQueue].requester == userName || TWITCH_MODS.includes(userName))
			commands.push({ "result" : "novideo" });
		else
			processChatReply(chatReply, "Only the requester and mods can !novideo.");
	}
	else if (first == '!grantcount' && msg.indexOf(' ') != -1) {
		let user = msg.split(' ')[1].toLowerCase().replace('@', '');
		if (user) {
			if (bonusReqs[user]) 
				processChatReply(false, '@' + user + ' has ' + bonusReqs[user] + ' additional requests.');
			else
				processChatReply(false, '@' + user + ' has no additional requests.');
		}
	}
	else if (first == '!nudge') {
		commands.push({ "result" : "nudge" });
	}
	else if (first == '!image' && is_imagesActive) {
		try {
			let earl = msg.replace('!image ', '').split(' ')[0];
			
			if (earl.indexOf('https://giphy.com/gifs/') == 0) {
				// https://giphy.com/gifs/donnathomas-rodgers-omg-oh-no-whats-going-on-8alkKbd04Se6OpETBx
				// https://media0.giphy.com/media/v1.Y2lkPTc5MGI3NjExY2tqcWZxZXdoNGw5emtlcDZjd2M4bnJtMm1qMnVuZzhoOGFlejZ6ciZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/YBHJyPCU9h1VewdaPZ/giphy.gif
				if (earl.lastIndexOf("-") > earl.lastIndexOf("/"))
					earl = "https://media.giphy.com/media/" + earl.substr(earl.lastIndexOf("-") + 1) + "/giphy.gif";
				else // https://giphy.com/gifs/CovFciJgWyxUs
					earl = "https://media.giphy.com/media/" + earl.substr(earl.lastIndexOf("/") + 1) + "/giphy.gif";
			}
			else if (earl.indexOf('https://gifdb.com/gif/') == 0) {
				// https://gifdb.com/gif/sexy-couple-te-amo-love-ilz9n5hpyqmy5ujk.html
				// https://gifdb.com/images/high/sexy-couple-te-amo-love-ilz9n5hpyqmy5ujk.gif
				earl = "https://gifdb.com/images/high/" + earl.substr(earl.lastIndexOf("/") + 1).replace(".html", "") + ".gif";
			}

			// if (earl.replace(/[0-9]/g, '').indexOf('https://media.giphy.com/media/') == 0 && earl.substr(-4) == ".gif")
			if (earl.substr(-4) == ".gif")
				commands.push({ "result" : "image", "file" : earl });
		} catch (e) { return false; }				
	}

	else if (is_mod) { // MOD_COMMANDS
		if (MOD_COMMANDS.includes(msg)) {
			msg = msg.substr(1);
			processChatReply(false, msg + ' command received.');
			commands.push({ "result" : msg });
		}
		else if (first == '!reconnect') {
			// await getAuth();
			startWebSocketClient();
		}
		else if (first == '!clear') {
			queue = [];
			curQueue = 0;
			console.log('Queue cleared.');
		}
		else if (first == '!settitle') {
			try {
				let splitMsg = msg.split(" ");
				if (splitMsg.length >= 3 && isNumeric(splitMsg[1])) {
					let i = splitMsg[1];
					queue[i].title = msg.replace('!settitle ', '').replace(i + ' ', '');
					if (queue[i].title.indexOf(' - ') == -1) {
						queue[i].artist = queue[i].title;
						queue[i].song = '';
					}
					else {
						let sp = queue[i].title.split(" - ");
						queue[i].artist = sp[0].trim();
						queue[i].song = sp[1].trim();
					}

					consoleQueue();
				}
			}
			catch (e) { return false; }				
		}
		else if (first == '!marknext') {
			let splitMsg = msg.split(" ");
			if (splitMsg.length >= 2 && isNumeric(splitMsg[1]) && queue[splitMsg[1]]) {
				queue[splitMsg[1]].next = true;
				console.log(queue[splitMsg[1]].title + " marked as next.");
			}
			else console.log("Invalid !marknext request.");
		}
		else if (first == '!search') {
			let word =  msg.replace('!search ', '').trim();
			if (word.length > 0) searchQueue(word);
			else console.log('Invalid search.');
		}
		else if (first == '!shutdown') {
			commands.push({ "result" : "shutdown" });

			var wait = 1111;
			if (is_vipAutomatic)
				Object.keys(userIDs).forEach(userName => {
					if (!USERS_VIP.includes(userName)) {
						setTimeout(function() { 
							console.log("Removing VIP from " + userName);
							makeNotVIP(userName);
						}, wait);

						wait += 2222;
					}
				});

			fs.appendFile(LOG_FILENAME, ")" + ENTER, (err) => {
				if (err) console.error('Error appending to file:', err);
				else console.log('Full playlist saved to ' + LOG_FILENAME);
			});
			wait += 3333;

			if (is_favoriteActive) {
	 			let sorted = Object.entries(favorites).sort(([, a], [, b]) => b.score - a.score);
				if (sorted.length) {
					var favout = "## Most favorited tracks:" + ENTER;

					setTimeout(function() { 
						console.log("Most favorited tracks:");

						let cnt = 0;
						sorted.slice(0, 10).forEach(item => {
							console.log("* " + (++cnt) + ": [" + item[1].title + "](https://youtu.be/" + item[1].id_yt + ") " + item[1].score + "pts");
							favout += 
								"* " + (cnt)
								+ ": [" + item[1].title + "](https://youtu.be/" + item[1].id_yt + ") " 
								+ item[1].score + "pts (" + item[1].requester + ")" + ENTER;
						});
					}, wait);
					wait += 3333;

					setTimeout(function() { 
						fs.appendFile(FAVS_LOG_FILENAME, favout, (err) => { });
					}, wait);	
					wait += 1111;
				}
			}

			setTimeout(function() { process.exit(); }, wait);
		}
		else if (first == '!vip') {
			let splitMsg = msg.split(" ");
			if (splitMsg[1]) makeVIP(splitMsg[1]);
		}
		else if (first == '!unvip') {
			let splitMsg = msg.split(" ");
			if (splitMsg[1]) makeNotVIP(splitMsg[1]);
		}
		else if (first == '!bumper') {
			let splitMsg = msg.split(" ");

			if (splitMsg.length >= 2) {
				if (isNumeric(splitMsg[1])) {
					if (bumpers[splitMsg[1]]) {
						let bump = bumpers[splitMsg[1]];

						queue.splice(curQueue + 1, 0, {
							"reqCount" : -1
							, "id_yt" : bump.id_yt
							, "title" : bump.title
							, "seconds" : 0
							, "is_video" : true
						});

						processChatReply(false, "Queued bumper '" + bump.title + "'");
						setTimeout(function() { consoleQueue(); }, (chatReply ? 1 : 3000));
					}
					else processChatReply(false, "Invalid bumper request.");
				}
				else {
					splitMsg[1] = splitMsg[1].toLowerCase();

					let len = bumpers.length;
					let idx = -1;
					for (var i = 0; i < len && idx == -1; i++) {
						if (bumpers[i].title.toLowerCase().indexOf(splitMsg[1]) != -1) idx = i;
					}

					if (idx == -1)
						processChatReply(false, "Failed to find bumper '" + splitMsg[1] + "'");
					else {
						let bump = bumpers[idx];

						queue.splice(curQueue + 1, 0, {
							"reqCount" : -1
							, "id_yt" : bump.id_yt
							, "title" : bump.title
							, "seconds" : 0
							, "is_video" : true
						});

						processChatReply(false, "Queued bumper '" + bump.title + "'");
						setTimeout(function() { consoleQueue(); }, (chatReply ? 1 : 3000));
					}
				}
			}
			else
				processChatReply(false, "Invalid bumper request.");
		}
		else if (first == '!troll') {
			let splitMsg = msg.split(" ");

			if (splitMsg.length >= 2) {
				if (isNumeric(splitMsg[1])) {
					if (trolls[splitMsg[1]]) {
						let bump = trolls[splitMsg[1]];

						queue.splice(curQueue + 1, 0, {
							"reqCount" : -1
							, "id_yt" : bump.id_yt
							, "title" : bump.title
							, "seconds" : 0
							, "is_video" : true
						});

						processChatReply(false, "Queued trolls '" + bump.title + "'");
						setTimeout(function() { consoleQueue(); }, (chatReply ? 1 : 3000));
					}
					else processChatReply(false, "Invalid trolls request.");
				}
				else {
					splitMsg[1] = splitMsg[1].toLowerCase();

					let len = trolls.length;
					let idx = -1;
					for (var i = 0; i < len && idx == -1; i++) {
						if (trolls[i].title.toLowerCase().indexOf(splitMsg[1]) != -1) idx = i;
					}

					if (idx == -1)
						processChatReply(false, "Failed to find troll '" + splitMsg[1] + "'");
					else {
						let bump = trolls[idx];

						queue.splice(curQueue + 1, 0, {
							"reqCount" : -1
							, "id_yt" : bump.id_yt
							, "title" : bump.title
							, "seconds" : 0
							, "is_video" : true
						});

						processChatReply(false, "Queued trolls '" + bump.title + "'");
						setTimeout(function() { consoleQueue(); }, (chatReply ? 1 : 3000));
					}
				}
			}
			else
				processChatReply(false, "Invalid trolls request.");
		}
		else if (first == '!grant' && msg.indexOf(' ') != -1) {
			let who = msg.split(' ')[1].toLowerCase().replace('@', '');
			if (who) {
				bonusRequest(who);
				processChatReply('both', '@' + who + ' has been granted an additional request.');
			}
		}
		else if (first == '!setpos' && msg.indexOf(' ') != -1) {
			let idx = msg.split(' ')[1];
			if (isNumeric(idx) && idx < queue.length) {
				if (idx < 0) idx = 0;
				curQueue = parseInt(idx - 1);
				processChatReply(false, 'Next up: ' + queue[curQueue + 1].title);
				setTimeout(function() { consoleQueue(); }, 3000);
			}
			else processChatReply(false, 'Invalid position.');
		}
		else if (first == '!move' && msg.split(' ').length == 3) {
			let from = msg.split(' ')[1];
			let to = msg.split(' ')[2];

			if (
				isNumeric(from) && isNumeric(to)
				&& from > curQueue && from < queue.length
				&& to > curQueue && to < queue.length
			) {
				let [element] = queue.splice(from, 1); // Remove element
				// if (to > from + 2 && to > 0) to--;	// actually want 1 spot earlier since we splice'd one out

				if (to > 0) element.reqCount = queue[to - 1].reqCount;
				else element.reqCount = 1;

				queue.splice(to, 0, element); // Insert at new position				
				processChatReply(false, 'Moved ' + queue[to].title + ' from ' + from + ' to ' + to + '.');
				setTimeout(function() { consoleQueue(); }, 3000);
			}
			else processChatReply(false, 'Invalid move position.');
		}
		else if (first == '!nix' && msg.indexOf(' ') != -1) {
			let from = msg.split(' ')[1];
			if (isNumeric(from) && from > curQueue && from < queue.length) {
				let [nixed] = queue.splice(from, 1);
				processChatReply(false, 'Nixed ' + nixed.title + ' from queue.');
				setTimeout(function() { consoleQueue(); }, (chatReply ? 1 : 3000));
			}
			else processChatReply(false, 'Invalid position for !nix.');
		}
		else if (first == '!setmax' && msg.indexOf(' ') != -1) {
			try {
				maxRequests = parseInt(msg.split(' ')[1]);
				processChatReply("both", 'Maximum requests changed to ' + maxRequests + '.');
			}
		    catch (err) { console.error('!setmax error', err); }

		}
		else if (first == '!setpri' && msg.indexOf(' ') != -1) {
			try {
				if (msg.split(' ').length == 2) {
					let pri = parseInt(msg.split(' ')[1]);
					queue.forEach(function(track, idx) { track.reqCount = pri; });

					processChatReply(false, 'Set priority for all tracks to ' + pri + '.');
				}
				else {
					let split = msg.split(' ');
					let target = parseInt(split[1]);
					let pri = parseInt(split[2]);
					queue[target].reqCount = pri;

					processChatReply(false, 'Set priority for ' + queue[target].title + ' to ' + pri + '.');
				}
			}
		    catch (err) { console.error('!setpri error', err); }
		}
		else if (first == '!open') {
			is_open = true;
			is_lastcall = false;
			processChatReply("both", 'Requests are now open!');
		}
		else if (first == '!close') {
			is_open = false;
			processChatReply("both", 'Requests are now closed!');
		}
		else if (first == '!lastcall') { doLastcall(); }
		else if (first == '!on') {
			is_on = true;
			processChatReply(false, 'Requests turned on.');
		}
		else if (first == '!off') {
			is_on = false;
			processChatReply(false, "Requests turned off.  Don't forget the redeem.");
		}
		else if (first == '!group') {
			is_groupByArtist = true;
			processChatReply(false, "Now grouping by artist.");
		}
		else if (first == '!nogroup') {
			is_groupByArtist = false;
			processChatReply(false, "No longer grouping by artist.");
		}
		else if (first == '!rolling') {
			is_rolling = true;
			processChatReply(false, "Requests now rolling.");
		}
		else if (first == '!norolling') {
			is_rolling = false;
			processChatReply(false, "Requests no longer rolling.");
		}
		else if (first == '!showqueue') {
			is_queuePublic = true;
			processChatReply(false, "hrrmrr's queued requests are now public.");
		}
		else if (first == '!hidequeue') {
			is_queuePublic = false;
			processChatReply(false, "hrrmrr's queued requests are now hidden.");
		}
		else if (first == '!greet') {
			is_greet = true;
			processChatReply(false, "Now greeting new chatters.");
		}
		else if (first == '!nogreet') {
			is_greet = false;
			processChatReply(false, "No longer greeting new chatters.");
		}
	}
}



function readdirAsync(path) {
  return new Promise((resolve, reject) => {
    fs.readdir(path, (err, files) => {
      if (err) reject(err);
      else resolve(files);
    });
  });
}

async function myFavorites(userName) {
  let topPoints = [];

  await Promise.all(
    Object.keys(points).map(async (key) => {
      try {
      	if (key != userName) {
	        const files = await readdirAsync("_points/" + key);
	        const count = files.filter(file =>
	          file.toLowerCase().includes(userName)
	        ).length;
	        topPoints.push([key, count]);
      	}
      } catch (err) {
        console.log("error reading points dir", err);
      }
    })
  );

  let reply = "";
  let comma = "";

  topPoints
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .forEach(([key, value]) => {
    	if (value > 0) {
			reply += `${comma}${key} (${value}pts)`;
			comma = ", ";
    	}
    });

    if (reply == "") processChatReply(true, "Not enough users here!  Try again later.");
  	else processChatReply(true, `@${userName}'s most favorited: ` + reply);
}

async function yourFavorites(userName) {
  let topPoints = [];

  await Promise.all(
    Object.keys(points).map(async (key) => {
      try {
      	if (key != userName) {
	        const files = await readdirAsync("_points/" + userName);
	        const count = files.filter(file =>
	          file.toLowerCase().includes(key)
	        ).length;
	        topPoints.push([key, count]);
      	}
      } catch (err) {
        console.log("error reading points dir", err);
      }
    })
  );

  let reply = "";
  let comma = "";

  topPoints
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .forEach(([key, value]) => {
    	if (value > 0) {
			reply += `${comma}${key} (${value}pts)`;
			comma = ", ";
    	}
    });

    if (reply == "") processChatReply(true, "Not enough users here!  Try again later.");
  	else processChatReply(true, `@${userName}'s biggest fans: ` + reply);
}

async function makeVIP(userName) {
    try {
		let response = await fetch('https://api.twitch.tv/helix/users?login=' + userName, {
			method: 'GET'
			, headers: {
				'Authorization': 'Bearer ' + BROADCASTER_OAUTH,
				'Client-Id': CLIENT_ID,
				'Content-Type': 'application/json'
			}
		});

		if (response.status != 200) {
			let data = await response.json();
			if (DEBUG) { 
				console.error("Failed to get user info");
				console.error(data);
			}
		}
		else { 
			let data = await response.json();
			
			if (data.data && data.data[0] && data.data[0].id) {			
				if (DEBUG) console.log('user info', data);
				// console.log("ID: " + data.data[0].id);
				userIDs[userName] = data.data[0].id;

				// curl -X POST 'https://api.twitch.tv/helix/channels/vips?broadcaster_id=123&user_id=456'
				let VIPresponse = await fetch(
					'https://api.twitch.tv/helix/channels/vips?broadcaster_id=' + BROADCASTER_USER_ID + "&user_id=" + data.data[0].id
					, {
						method: 'POST',
						headers: {
							'Authorization': 'Bearer ' + BROADCASTER_OAUTH,
							'Client-Id': CLIENT_ID,
							'Content-Type': 'application/json'
						}
					}
				);

				if (VIPresponse.status != 204) {
					console.error("Failed to VIP " + userName);
					if (DEBUG) console.error(VIPresponse);
				}
				else if (DEBUG) console.log("VIP sucessful"); // , VIPresponse);
			}
			else console.log("Cannot VIP, error finding ID for @" + userName);
		}
    } catch (err) {
        console.error('fetch() error', err);
        return null;
    }
}

async function makeNotVIP(userName) {
    try {
    	if (!userIDs[userName]) {
			let response = await fetch('https://api.twitch.tv/helix/users?login=' + userName, {
				method: 'GET'
				, headers: {
					'Authorization': 'Bearer ' + BROADCASTER_OAUTH,
					'Client-Id': CLIENT_ID,
					'Content-Type': 'application/json'
				}
			});

			if (response.status != 200) {
				let data = await response.json();
				if (DEBUG) { 
					console.error("Failed to get user info");
					console.error(data);
				}

				return;
			}
			else {
				let data = await response.json();
				if (DEBUG) console.log('user info', data);
				userIDs[userName] = data.data[0].id;
	    	}
    	}

		// curl -X POST 'https://api.twitch.tv/helix/channels/vips?broadcaster_id=123&user_id=456'
		let VIPresponse = await fetch(
			'https://api.twitch.tv/helix/channels/vips?broadcaster_id=' + BROADCASTER_USER_ID + "&user_id=" + userIDs[userName]
			, {
				method: 'DELETE',
				headers: {
					'Authorization': 'Bearer ' + BROADCASTER_OAUTH,
					'Client-Id': CLIENT_ID,
					'Content-Type': 'application/json'
				}
			}
		);

		// console.log(VIPresponse);

		if (VIPresponse.status != 204) {
			console.error("Failed to un-VIP " + userName);
			if (DEBUG) console.error(VIPresponse);
		}
		else if (DEBUG) console.log("Un-VIP sucessful"); // , VIPresponse);
    } catch (err) {
        console.error('fetch() error', err);
        return null;
    }
}


async function handleWebSocketMessage(data) {
	switch (data.metadata.message_type) {
		case 'session_welcome': // First message you get from the WebSocket server when connecting
			websocketSessionID = data.payload.session.id; // Register the Session ID it gives us

			// Listen to EventSub, which joins the chatroom from your bot's account
			await registerEventChatListeners();
			if (is_redeemsActive) await registerEventRedeemListeners();

			console.log('Server ready!');
			console.log('Note: typing !commands in this console works the same as typing them in chat.');
			console.log('You can also paste youtube URLs into the console (by right-clicking with your mouse) to add them to the queue.')
		break;
		case 'notification': // An EventSub notification has occurred, such as channel.chat.message
			switch (data.metadata.subscription_type) {
				case 'channel.chat.message':
					if (DEBUG) console.log(`MSG #${data.payload.event.broadcaster_user_login} <${data.payload.event.chatter_user_name}> ${data.payload.event.message.text}`);

					let userName = data.payload.event.chatter_user_name.toLowerCase();
					if (points[userName] === undefined) {
						var dir = '_points/' + userName;

						if (fs.existsSync(dir)) {
							points[userName] = await countFiles(dir);
							if (DEBUG) console.log(userName + ' has ' + points[userName] + " pts");
						}
						else {
							if (DEBUG) console.log(userName + " has 0 pts, creating directory");

							points[userName] = 0;
							fs.mkdirSync(dir);
						}
					}

					if (!USERS_IGNORED.includes(userName))
						processChatMessage(data.payload.event.message.text.trim(), userName);
				break;	// end: case 'channel.chat.message':

				case 'channel.channel_points_custom_reward_redemption.add':
					if (DEBUG) console.log('channel.channel_points_custom_reward_redemption.add', data.payload);
					let user = data.payload.event.user_login;

					switch (data.payload.event.reward.title) {
						case 'One more request!':
							bonusRequest(user);
							sendChatMessage('@' + user + ' has been granted another request.');
						break;

						case 'Play this next!':
							bonusRequest(user);
							playNexts[user] = 1;
						break;

						case 'Play an extra long song!':
							bonusRequest(user);
							
							if (longSongs[user])
								longSongs[user]++;
							else
								longSongs[user] = 1;
						break;

						case 'Troll Time':
							if (trolls.length) {
								let bumpIdx = Math.floor(Math.random() * trolls.length);
								let [bump] = trolls.splice(bumpIdx, 1);

								queue.splice(curQueue + 1, 0, {
									"reqCount" : -1
									, "id_yt" : bump.id_yt
									, "title" : bump.title
									, "seconds" : 0
									, "is_video" : true
								});

								processChatReply(false, "Queued trolltime '" + bump.title + "'");
								sendChatMessage('@' + user + ' has summoned something trollish up next.');
								setTimeout(function() { consoleQueue(); }, 3000);
							}
							else console.log("ERROR: no options available for 'troll time' redeem!");
						break;

						// An example, sounds not actually included.
						// case 'Sound: Applause':
						// 	commands.push({ "result" : "sound", "file" : "claps" });
						// break;

						case "I'm the DJ!":
							captainDJ = user;
							setTimeout(function() {
								processChatReply('both', "@" + captainDJ + " is no longer in control!");
								captainDJ = false;
							}, 1800000);

							processChatReply('both', "@" + user + " has commandeered the ship for the next 30 minutes!");
						break;

						case 'Skip my request!': // !skip my request
							if (queue[curQueue]) {
								if (user == queue[curQueue].requester)
									commands.push({ "result" : "skip" });
								else
									sendChatMessage("Sorry @" + user + " but this isn't your request to skip.");
							}
							else
								sendChatMessage("Nothing currently playing!");
						break;

						case '!play':
						case '!pause':
						case '!break':
						case '!skip':
							commands.push({ "result" : data.payload.event.reward.title.substr(1) });
						break;

						case '!open':
							is_open = true;
							is_lastcall = false;
							sendChatMessage('Requests are now open!');
						break;

						case '!close':
							is_open = false;
							sendChatMessage('Requests are now closed!');
						break;

						case '!lastcall':
							doLastcall();
						break;

						case 'Skip! [mods only]':
							if (TWITCH_MODS.includes(user)) commands.push({ "result" : "skip" });
							else sendChatMessage('@' + user + " You're no mod!");
						break;

						case 'Add to Favorites!':
							if (is_favoriteActive)
								commands.push({ "result" : "favorite", "userName" : user, "comment" : "" });
						break;
					}
				break;	// case 'channel.chat.message':
			}
		break;	// case 'notification':
	}
}

function doLastcall() {
	is_lastcall = true;
	is_rolling = false;

	sendChatMessage("It's last call!  Everyone has 10 minutes to make one final request!");

	setTimeout(function() {
		sendChatMessage('Two minutes left to make a request!');
	}, 480000);

	setTimeout(function() {
		sendChatMessage('Requests are now closed!');
		is_open = false;
	}, 600000);
}

async function sendChatMessage(chatMessage) {
	chatMessage = chatMessage
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&amp;/g, '&')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
	;

	if (chatMessage.length > 480) {
		chatMessage = chatMessage.substr(0, 480) + ' ';

		let pPos = chatMessage.lastIndexOf('. ');
		if (pPos < chatMessage.lastIndexOf('? ')) pPos = chatMessage.lastIndexOf('? ');
		if (pPos < chatMessage.lastIndexOf('! ')) pPos = chatMessage.lastIndexOf('! ');

		chatMessage = chatMessage.substr(0, pPos + 1);
	}

    try {
		let response = await fetch('https://api.twitch.tv/helix/chat/messages', {
			method: 'POST',
			headers: {
				'Authorization': 'Bearer ' + BROADCASTER_OAUTH,
				'Client-Id': CLIENT_ID,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				broadcaster_id: BROADCASTER_USER_ID,
				sender_id: BROADCASTER_USER_ID,
				message: chatMessage
			})
		});

		if (response.status != 200) {
			let data = await response.json();
			if (DEBUG) { 
				console.error("Failed to send chat message.", chatMessage);
				console.error(data);
			}
			
			if (data.error == 'Unauthorized') {
				if (DEBUG) console.log('Attempting to refresh access token.');
				await refreshAccessToken();
				sendChatMessage(chatMessage);
			}
		}
    } catch (err) {
        console.error('fetch() error', err);
        return null;
    }
}

async function registerEventChatListeners() {
    try {
		// Register channel.chat.message
		let response = await fetch('https://api.twitch.tv/helix/eventsub/subscriptions', {
			method: 'POST',
			headers: {
				'Authorization': 'Bearer ' + BROADCASTER_OAUTH,
				'Client-Id': CLIENT_ID,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				type: 'channel.chat.message',
				version: '1',
				condition: {
					broadcaster_user_id: BROADCASTER_USER_ID,
					user_id: BROADCASTER_USER_ID
				},
				transport: {
					method: 'websocket',
					session_id: websocketSessionID
				}
			})
		});

		if (response.status == 401) {
			console.error("Failed to subscribe to channel.message.  Invalid OAuth token!");

			await refreshAccessToken();
	        registerEventChatListeners();
		}
		else if (response.status != 202) {
			let data = await response.json();
			console.error("Failed to subscribe to channel.chat.message. API call returned status code " + response.status);
			console.error(data);
			// process.exit(1);
		} else {
			let data = await response.json();
			console.log(`Subscribed to channel.chat.message [${data.data[0].id}]`);
		}	
    } catch (err) {
        console.error('channel.chat.message fetch() error', err);
        registerEventChatListeners();
        return;
    }
}

async function registerEventRedeemListeners() {
	// Register channel.channel_points_custom_reward_redemption.add
    try {
		let response = await fetch('https://api.twitch.tv/helix/eventsub/subscriptions', {
			method: 'POST',
			headers: {
				'Authorization': 'Bearer ' + BROADCASTER_OAUTH,
				'Client-Id': CLIENT_ID,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				type: 'channel.channel_points_custom_reward_redemption.add',
				version: '1',
				condition: {
					broadcaster_user_id: BROADCASTER_USER_ID
				},
				transport: {
					method: 'websocket',
					session_id: websocketSessionID
				}
			})
		});

		if (response.status == 401) {
			console.error("Failed to subscribe to channel.channel_points_custom_reward_redemption.add.  Invalid OAuth token!");

			await refreshAccessToken();
	        registerEventChatListeners();
		}
		else if (response.status != 202) {
			let data = await response.json();
			console.error("Failed to subscribe to channel.channel_points_custom_reward_redemption.add. API call returned status code " + response.status);
			console.error(data);
			// process.exit(1);
		} else {
			let data = await response.json();
			console.log(`Subscribed to channel.channel_points_custom_reward_redemption.add [${data.data[0].id}]`);
		}
    } catch (err) {
        console.error('channel.channel_points_custom_reward_redemption.add fetch() error', err);
        registerEventRedeemListeners();
        return;
    }
}

function bonusRequest(user) {
	user = user.replace('@', '');
	if (bonusReqs[user]) bonusReqs[user]++; else bonusReqs[user] = 1;
}

function searchQueue(findTerm) {
	findTerm = findTerm.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
	if (DEBUG) console.log('search for ' + findTerm);

	for (let i = 0; i < queue.length; i++) {
		let cur = queue[i];

		if (cur.title?.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "").indexOf(findTerm) != -1) {
			let reqby = '';
			let tag = '[-] ';
			if (i == curQueue) tag = "[!] ";
			else if (i > curQueue) tag = "[+] ";
			if (cur.requester) reqby = " (" + cur.requester + ")" + " " + cur.reqCount;

			console.log(tag + i + ": " + cur.title + reqby);
		}
	}
}


function consoleQueue() {
	let until = curQueue + 35;
	if (until > queue.length) until = queue.length;

	let secondsTotal = 0;
	let secondsRemain = 0;

	if (!DEBUG) console.clear();
	console.log('--------------------------------------------------------------------------------------------------------------------');
	for (let i = 0; i < queue.length; i++) {
		let cur = queue[i];

		secondsTotal += cur.seconds;
		if (i >= curQueue) {
			if (i != curQueue) secondsRemain += cur.seconds;

			if (i < until) {
				let min = Math.floor(cur.seconds / 60);
				let secs = cur.seconds - (min * 60);
				if (secs < 10) secs = "0" + secs;

				let reqby = '';
				if (cur.requester) reqby = " (" + cur.requester + ")" + " " + cur.reqCount;

				console.log(
					i + ": "
					+ cur.title.substr(0, 75).trim() + (cur.title.length > 75 ? "…" : "")
					+ reqby + " [" + min + ":" + secs + "]"
				);
			}
		}
	}

	if (until == queue.length) console.log("///////// END OF PLAYLIST /////////");
	console.log('--------------------------------------------------------------------------------------------------------------------');

	let min = Math.round(secondsRemain / 60);
	let hour = Math.floor(min / 60);
	min -= (hour * 60);

	let minTot = Math.round(secondsTotal / 60);
	let hourTot = Math.floor(minTot / 60);
	minTot -= (hourTot * 60);
	console.log('>> ' + hour + 'h' + min + 'm remaining, ' + hourTot + 'h' + minTot + 'm total');
}


function replyok(res) {
	res.writeHead(200, {'Content-Type' : 'text/plain; charset=utf-8'});
	res.write('{"result":"ok"}');
	res.end();	
}

http.createServer((req, res) => {
	var file = req.url.substr(1);
	if (req.url == '/') {
		console.log('>>> Playlister loaded!')
		res.setHeader("Content-Security-Policy", "script-src * 'unsafe-inline' 'unsafe-eval' data: blob:;");
		file = 'index.html';
	}


	if (file == 'ping') {
		res.writeHead(200, {'Content-Type' : 'text/plain; charset=utf-8'});
		if (commands.length > 0) res.write(JSON.stringify(commands.shift()));
		else if (requests.length > 0) res.write(JSON.stringify(requests.shift()));
		else res.write('{"result":"pong"}');
		res.end();
	}

	else if (file == 'playing') {
		if (queue[curQueue] && !is_announced) {
			is_announced = true;
			whenAdjust = 1;

			let reply = "Now: " + queue[curQueue].title; // Playing:
			if (queue[curQueue].requester) reply += ", req by @" + queue[curQueue].requester;
			reply += ".  https://youtu.be/" + queue[curQueue].id_yt; 
			reply += " [" + (curQueue + 1) + " of " + queue.length + "]";

			setTimeout(function() { 
				whenAdjust = 0;
				sendChatMessage(reply); 
			}, LATENCY_MS);

			try {
				let cur = '';
				if (log_count++ % 44 == 0) {
					if (log_count > 1) cur = ")" + ENTER;

					cur += "[Part " 
						+ Math.ceil(log_count / 44)
						+ "](https://www.youtube.com/watch_videos?video_ids=" + queue[curQueue].id_yt;
				}
				else cur = "," + queue[curQueue].id_yt;

				fs.appendFile(LOG_FILENAME, cur, (err) => {
					if (err) console.error('Error appending to file:', err);
					else if (DEBUG) console.log('Playlist: ' + cur);
				});
			} catch (err) {
		        console.error('Error:', err.message);
		        return null;
		    }
		}
		replyok(res);		
	}

	else if (file == 'playerror') {
	    if (queue[curQueue]) {
			let reply = "Error playing " + queue[curQueue].title + "."
			if (!is_rolling && queue[curQueue].requester && queue[curQueue].requester != BROADCASTER_TWITCH_NAME) {
				let userName = queue[curQueue].requester;
				if (requesters[userName] > 1) requesters[userName]--;
				else delete requesters[userName];
				if (requesters[userName] >= maxRequests || lastcalls[userName]) bonusRequest(userName);

				reply += "  Request refunded to @" + userName + '.';
				processChatReply('both', reply);
			}
			else processChatReply(false, reply);
	    } 

		replyok(res);
	}

	else if (file == 'message') {
	    let body = '';
	    req.on('data', (chunk) => { body += chunk.toString(); });

		req.on('end', () => {
		    if (DEBUG) console.log('message: ' + body);

			let jsonData = JSON.parse(body);
			processChatReply((jsonData.msg.indexOf(BROADCASTER_TWITCH_NAME) == -1), jsonData.msg);
			replyok(res);
		});
	}

	else if (file == 'favorite') {
	    let body = '';
	    req.on('data', (chunk) => { body += chunk.toString(); });

		req.on('end', () => {
		    if (DEBUG) console.log('favorite: ' + body);

			let jsonData = JSON.parse(body);
			let out = "["  + jsonData.title.replace(/\[/g, "").replace(/\]/g, "") + "](https://youtu.be/" + jsonData.id_yt + ")" + ENTER;

			fs.appendFile("_favorites/" + jsonData.userName + '.txt', out, (err) => {
				if (err) console.error('Error appending to file:', err);
				else { 
					if (jsonData.userName != BROADCASTER_TWITCH_NAME)
						processChatReply(true, 'Added ' + jsonData.title + " to @" + jsonData.userName + "'s favorites.");
				}
			});

			// create "points" file
			if (jsonData.requester && jsonData.requester != jsonData.userName) {
				let target = "_points/" + jsonData.requester + "/" + jsonData.id_yt + jsonData.userName  + '.txt';

				if (!fs.existsSync(target)) {
					if (favorites[jsonData.id_yt])
						favorites[jsonData.id_yt].score++;
					else
						favorites[jsonData.id_yt] = {
							"id_yt" : jsonData.id_yt
							, "title" : jsonData.title
							, "requester" : jsonData.requester
							, "score" : 1
						};

					if (!points[jsonData.requester]) points[jsonData.requester] = 1;
					else points[jsonData.requester]++;

					fs.appendFile(target, " ", (err) => {
						if (err) console.error('Error appending to file:', err);
						else if (DEBUG) console.log('Created ' + "_points/" + jsonData.requester + "/" + jsonData.id_yt + jsonData.userName  + '.txt');
					});
				}
			}

			replyok(res);
		});
	}

	else if (file == 'queue') {
	    let body = '';
	    req.on('data', (chunk) => { body += chunk.toString(); });

		req.on('end', () => {
		    if (DEBUG) console.log('queue: ' + body);

			let jsonData = JSON.parse(body);
			if (jsonData.chatReply != false) jsonData.chatReply = true;
			replyok(res);

			// Check for duplicate vids
			let dupeIdx = -1;
			queue.forEach(function(track, idx) {
				if (
					track.id_yt == jsonData.id_yt 
					|| track.title.toLowerCase().replace(/ /g, '').replace(/-/g, '') == jsonData.title.toLowerCase().replace(/ /g, '').replace(/-/g, '')
				)
					dupeIdx = idx;
			});

			// if someone's requested something BROADCASTER has up later, nix the first one
			if (
				queue[dupeIdx] 
				&& dupeIdx > curQueue 
				&& !jsonData.is_mod
				&& (jsonData.autoplay || playNexts[jsonData.requester] || queue[dupeIdx].requester == BROADCASTER_TWITCH_NAME)
			) {
				queue.splice(dupeIdx, 1);
				dupeIdx = -1;
			}

			if (dupeIdx != -1) {
				if (dupeIdx <= curQueue)
					processChatReply((jsonData.requester != BROADCASTER_TWITCH_NAME), "Failed to add '" + jsonData.title + "' request from @" + jsonData.requester + ", already been played!");
				else
					processChatReply((jsonData.requester != BROADCASTER_TWITCH_NAME), "Failed to add '" + jsonData.title + "' request from @" + jsonData.requester + ", already in queue.");
			}
			else {
				let is_mod = BOT_ADMINS.includes(jsonData.requester); // isBotAdmin(jsonData.requester);
				if (jsonData.is_mod) is_mod = jsonData.is_mod;

				// Check for length
				if (!is_lastcall && jsonData.seconds > MAX_LENGTH_SS && !is_mod && !longSongs[jsonData.requester])
					processChatReply((jsonData.requester != BROADCASTER_TWITCH_NAME), "Failed to add '" + jsonData.title + "' request from @" + jsonData.requester + ", max. length is " + MAX_LENGTH_LABEL + ".");
				else if ((is_lastcall || longSongs[jsonData.requester]) && jsonData.seconds > LASTCALL_MAX_LENGTH_SS && !is_mod)
					processChatReply((jsonData.requester != BROADCASTER_TWITCH_NAME), "Failed to add '" + jsonData.title + "' request from @" + jsonData.requester + ", max. length for long songs is " + LASTCALL_MAX_LENGTH_LABEL + ".");
				else {
					if (!is_rolling && bonusReqs[jsonData.requester]) {
						if (bonusReqs[jsonData.requester] > 1) bonusReqs[jsonData.requester]--;
						else delete bonusReqs[jsonData.requester];
					}
					else if (jsonData.requester && !shorts[jsonData.requester] && jsonData.seconds <= SHORTS_LEN_SS) {
						if (USERS_LIMITED.includes(jsonData.requester)) shorts[jsonData.requester] = true;
						jsonData.next = true;
					}
					else if (!is_mod) { // if (bonusReqs[userName] == null) {
						if (!is_open && requesters[jsonData.requester] !== undefined) {
							sendChatMessage('Sorry @' + jsonData.requester + ', requests are closed.');
							return;
						}
						else if (is_lastcall && lastcalls[jsonData.requester]) {
							sendChatMessage('Sorry @' + jsonData.requester + ", but you've already made your lastcall request.");
							return;
						}
						else if (
							!is_lastcall
							&& !is_rolling
							&& requesters[jsonData.requester] != null 
							&& requesters[jsonData.requester] >= maxRequests
						) {
							sendChatMessage('Sorry @' + jsonData.requester + ", you've hit the max of " + maxRequests + " requests.");
							return;
						}
					}

					if (playNexts[jsonData.requester]) {
						jsonData.next = true;
						delete playNexts[jsonData.requester];
					}					

					if (longSongs[jsonData.requester] && jsonData.seconds > MAX_LENGTH_SS) {
						if (longSongs[jsonData.requester] > 1) longSongs[jsonData.requester]--;
						else delete longSongs[jsonData.requester];
					}

					let qIdx = -1;
					let requesterCount = 0;

					if (
						is_vipAutomatic
						&& !userIDs[jsonData.requester]
						&& !TWITCH_MODS.includes(jsonData.requester)
					 	&& !USERS_VIP.includes(jsonData.requester)
					 	&& !USERS_LIMITED.includes(jsonData.requester)
					 ) makeVIP(jsonData.requester);

					if (jsonData.next === undefined) {
						if (requesters[jsonData.requester] == null) requesters[jsonData.requester] = 1;
						else requesters[jsonData.requester]++;
						jsonData.reqCount = requesters[jsonData.requester];

						let is_userLimited = USERS_LIMITED.includes(jsonData.requester);
						if (is_userLimited) jsonData.reqCount = Math.round(jsonData.reqCount * 1.444);
						let is_reqdBefore = false;
						let reqdMatch = '';
						let lastRequestAt = -1;
						let artistCount = 1;
						let lastArtist = false;
						let artistMatch = false;
						let thisArtist = jsonData.artist?.toLowerCase().replace(/[^a-zA-Z0-9 `?:&/@=#.\-_\+,~%!*'()]/g, '');

						queue.forEach(function(track, idx) {
							let trackArtist = track.artist?.toLowerCase().replace(/[^a-zA-Z0-9 `?:&/@=#.\-_\+,~%!*'()]/g, '');

							if (idx > curQueue) {
								if (qIdx == -1 && !track.next) {
									if (
										is_groupByArtist 
										&& thisArtist == lastArtist
										&& thisArtist != trackArtist
										&& (is_mod || artistCount < MAX_GROUPING)
										&& !is_userLimited
									) {
										qIdx = idx;
										artistMatch = true;
									}
									else if (
										track.reqCount > jsonData.reqCount
										&& idx > lastRequestAt
									)
										qIdx = idx;
								}

								if (track.requester == jsonData.requester && track.seconds > SHORTS_LEN_SS) requesterCount++;
							}

							if (track.requester == jsonData.requester) {
								track.is_latest = false;

								if (trackArtist == thisArtist) {
									is_reqdBefore = true;
									reqdMatch = jsonData.artist;
								}
								else if (thisArtist == jsonData.track?.toLowerCase().replace(/[^a-zA-Z0-9 `?:&/@=#.\-_\+,~%!*'()]/g, '')) {
									is_reqdBefore = true;
									reqdMatch = track.artist;
								}
								
								if (!artistMatch && track.seconds && track.seconds > SHORTS_LEN_SS) {
									qIdx = -1;
									lastRequestAt = idx + MIN_SPACING;
								}
							}
							else if (!artistMatch && track.reqCount < jsonData.reqCount)
								qIdx = -1; 

							if (trackArtist == lastArtist) artistCount++; else artistCount = 1;
							lastArtist = trackArtist;
						});

						if (
							!is_mod
							&& !is_lastcall 
							&& is_rolling 
							&& requesterCount >= maxRequests 
							&& jsonData.seconds > SHORTS_LEN_SS
						)  {
							if (bonusReqs[jsonData.requester]) {
								if (bonusReqs[jsonData.requester] > 1) bonusReqs[jsonData.requester]--;
								else delete bonusReqs[jsonData.requester];
							}
							else {
								sendChatMessage('Sorry @' + jsonData.requester + ", you've hit the max of " + maxRequests + " queued requests.  Please wait for one of yours to be played before requesting again.");
								return;
							}
						}

						if (is_userLimited && is_reqdBefore && !is_mod) {
							sendChatMessage('Sorry @' + jsonData.requester + ", but you've already requested " + reqdMatch + ".  Please choose a different artist!");
							return;
						}

						jsonData.artistMatch = artistMatch;
						if (artistMatch) {
							jsonData.reqCount = queue[qIdx - 1].reqCount;
							jsonData.next = true;
						}
					}
					else {	// is marked "play next"
						qIdx = curQueue;
						while(queue[++qIdx] && queue[qIdx].next !== undefined) { }
						jsonData.reqCount = 0;

						queue.forEach(function(track, idx) {
							if (track.requester == jsonData.requester) track.is_latest = false;
						});
					}

					if (qIdx == -1) {
						qIdx = queue.length;

						if (USERS_LIMITED.includes(jsonData.requester))
							commands.push({ "result": "altsong", "broadcaster": BROADCASTER_TWITCH_NAME });
						else if (
							is_groupByArtist
							&& queue[qIdx - 1]
							&& queue[qIdx - 1].artist
							&& jsonData.artist?.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "") == queue[qIdx - 1].artist?.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "")
						) {
							jsonData.artistMatch = true;
							jsonData.next = true;
						}

						queue.push(jsonData);
					} 
					else { 
						queue.splice(qIdx, 0, jsonData);

						// check if this artist is requested later, and move those requests up if found
						if (is_groupByArtist && jsonData.requester != "" && jsonData.artist != "") {
							let added = 0;
							for (var i = qIdx + 1; i < queue.length; i++) {
								if (queue[i].artist == jsonData.artist) {
									let moo = queue.splice(i, 1)[0];
									moo.artistMatch = true;
									moo.next = true;

									queue.splice((qIdx + ++added), 0, moo);
								}
							}
						}
					}

					let diff = qIdx - curQueue + whenAdjust;
					let whenUp = 'Queued in ' + diff + ' songs.';
					if (diff <= 1) whenUp = 'Playing next!';

					if (is_lastcall) {
						lastcalls[jsonData.requester] = 1;

						if (!is_mod) {
							if (bonusReqs[jsonData.requester])
								whenUp += " [" + bonusReqs[jsonData.requester] + " request" + (bonusReqs[jsonData.requester] == 1 ? "" : "s") + " left]";
							else
								whenUp += " [0 requests left]";
						}
					}
					else if (!is_mod && is_rolling && !jsonData.next) {
						whenUp += " [" + (++requesterCount) + " of " + maxRequests + " queued]";
					}
					else if (!is_mod && !is_rolling) {
						let remaining = maxRequests - requesters[jsonData.requester];
						if (remaining <= 0 && bonusReqs[jsonData.requester])
							remaining = bonusReqs[jsonData.requester];

						if (remaining <= 0) {
							whenUp += " [0 requests left]";

							if (!is_firstOut) {
								is_firstOut = true;

								setTimeout(function(who) {
									bonusRequest(who);
									processChatReply('both', '@' + who + ' gets a free request for being the first to run out.');
								}, 3333, jsonData.requester);
							}
						}
						else if (remaining == 1) whenUp += " [1 request left]";
						else if (isNumeric(remaining)) whenUp += " [" + remaining + " requests left]";
					}

					let wot = "Added: " + jsonData.title;
					if (jsonData.requester) wot += ", req by @" + jsonData.requester;
					let whereto = "both";
					if (jsonData.requester == BROADCASTER_TWITCH_NAME) whereto = false;
					processChatReply(whereto, wot + '.  ' + whenUp);
					setTimeout(function() { consoleQueue(); }, (jsonData.chatReply ? 1 : 3000));
				}

				if (jsonData.autoplay) commands.push({ "result" : "nudge" });
			}
		});
	}

	else if (file == 'next') {
		if (DEBUG) console.log('NEXT request ' + (curQueue + 1) + ' of ' + queue.length);

		res.writeHead(200, {'Content-Type' : 'text/plain; charset=utf-8'});

		if ((curQueue + 1) >= queue.length || queue.length == 0) { // nothing in queue
			console.log(">> no requests..");

			if (is_on) {
				res.write('{"error":"norequests", "broadcaster":"' + BROADCASTER_TWITCH_NAME + '"}');
				setTimeout(function() { commands.push({ "result" : "nudge" }); }, LATENCY_MS);
			}
			else
				res.write('{"result":"pong"}');
		}
		else {
			++curQueue;

			if (captainDJ) {
				let idx = false;
				for (var i = curQueue; i < queue.length && !idx; i++)
					if (queue[i].requester == captainDJ) idx = i;

				if (idx > curQueue) {
					let [element] = queue.splice(idx, 1);
					queue.splice(curQueue, 0, element);		
					processChatReply(false, 'Captain moved ' + queue[curQueue].title + ' to next!');					
				}
			}

			is_announced = false;
			res.write(JSON.stringify(queue[curQueue]));
			consoleQueue();	
		}

		res.end();
	}

	else {	// actual file request
		fs.readFile(file, null, function (error, data) {
			if (error) {
				res.writeHead(404);
				res.write('FOUR OH FOUR!');
			} else {
				if (file.indexOf('.html') != -1) res.writeHead(200, {'Content-Type' : 'text/html; charset=utf-8'});
				else res.writeHead(200, {'Content-Type' : 'text/plain; charset=utf-8'});
				
				res.write(data);
			}

			res.end();
		});
	}
}).listen(80);


