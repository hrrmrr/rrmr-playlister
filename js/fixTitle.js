/*
function fixTitle(text) {
}
*/

function cleanText(input) {
  const keywords = [
  	'official', 'remaster', 'hd', 'hq', 'mv', 'audio', 'video', 'edit', 'lyric', 'lyrics', 'feat'
  	, 'visualiser', 'version', 'track', 'remastered', 'mix', '4k', 'upgrade', 'mix', 'stero', 'mono'
  	, 'song', 'full', 'album', 'stream', 'visualizer', 'upscale', 'videoclipe', 'ft', 'unofficial'
  	, 'quality', 'subbed', 'subtitulado', 'officiel', 'release', 'captioned', 'stereo', 'mono'
  	, 'videoclip'
  ];
  const keywordPattern = keywords.join('|');

  const pattern = new RegExp(
    `(\\([^)]*\\b(?:${keywordPattern})\\b[^)]*\\))|(\\[[^\\]]*\\b(?:${keywordPattern})\\b[^\\]]*\\])`,
    'gi'
  );

  return input.replace(pattern, '').replace(/\s{2,}/g, ' ').trim();
}

function stripWords(str) {
	const removeList = [
	  ' official extended version',
	  ' official music video',
	  'official youtube channel',
	  ' - official music video',
	  ' - the midnight special',
	  'official song premiere',
	  ' | pbs digital studios',
	  ' touch and go records',
	  'with official lyrics',
	  'fuzz club session: ',
	  ' performance video',
	  ' - lullaby version',
	  ' - 2022 remaster',
	  ' - final version',
	  'official lyrics',
	  ' - stereo hq',
	  ' *[rare]*',
	  ' - studio version',
	  ' - radio edit',
	  ' - 2022 remaster',
	  ' - remaster',
	  ' - original',
	  'ipecac recordings -',
	  'lookout! records',
	  ' original song',
	  ' lcy uncut',
	  ' closed captioned',
	  ' revised audio',
	  '[music video]',
	  'official video',
	  'official audio',
	  'official promo',
	  'music video',
	  'lyric video',
	  'visualizer',
	  'visualiser',
	  'remastered',
	  'video edit',
	  '| the muppets',
	  '| letterman',
	  'music vid',
	  '[blank]',
	  '[mv]',
	  '.wmv',
	  '.mp4',
	  '.mov',
	  '[]',
	  '()'
	];

  // Escape special regex characters in each word, then join them into a single pattern
  const pattern = new RegExp(`\\b(${removeList.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`, 'gi');
  return str.replace(pattern, '').replace(/\s{2,}/g, ' ').replace(/-\s*-/g, '-').trim();
}


function fixTitle(text) {
	console.log('fixTitle("' + text + '")');

	text = text 
		.replace(/{/g, "[")
		.replace(/}/g, "]")
		.replace(/\( /g, "(")
		.replace(/ \)/g, ")")
		.replace(/’/g, "'")
		.replace(/‘/g, "'")
	;

	if (text.indexOf("triple j - ") == 0 && text.indexOf("' for Like A Version") != -1) {
    try {
			// triple j - Billie Eilish covers Michael Jackson 'Bad' for Like A Version
    	// Sycco covers The Pointer Sisters’ ‘Jump (For My Love)' for Like A Version
    	// King Stingray cover Coldplay 'Yellow' for Like A Version
			text = text 
				.replace(" cover ", " covers ")
				.replace("triple j - ", "")
				.replace(" for Like A Version", "")
			;

			let sp = text.split(" covers ");
			text = sp[0] + " - " + sp[1]; // .split("'")[1];
    } catch (err) {
        console.error('like a version parse error:', err);
    }
	}	
	else if (text.indexOf("triple j - ") == 0 && text.indexOf(" at triple j's Beat the Drum") != -1) {
    try {
    	// The Cat Empire and Owl Eyes cover Kylie Minogue 'Confide In Me' at triple j's Beat The Drum
    	// triple j - The Cat Empire and Owl Eyes cover Kylie Minogue 'Confide In Me' at triple j's Beat the Drum
			text = text 
				.replace(" cover ", " covers ")
				.replace("triple j - ", "")
				.replace(" at triple j's Beat the Drum", "")
			;

			let sp = text.split(" covers ");
			text = sp[0] + " - " + sp[1]; // .split("'")[1];
    } catch (err) {
        console.error('Beat The Drum parse error:', err);
    }
	}
	else if (
		text.indexOf('"') > 0
		&& (
			text.indexOf('Drag City - ') == 0
			|| text.indexOf('Kill Rock Stars - ') == 0
			|| text.indexOf('The Ed Sullivan Show - ') == 0
			|| text.indexOf('Austin History Center - ') == 0
		)
	) {
		let sp = text.split(" - ")[1].split('"');
		text = sp[0].trim() + " - " + sp[1].trim();
	}
	else if (text.indexOf("-") == -1 && text.indexOf(', "') > 0) {
		let sp = text.split(', "');
		text = sp[0].trim() + " - " + sp[1].trim();
	}
	else if (text.indexOf("-") == -1 && text.indexOf('"') > 0) {
		let sp = text.split('"');
		text = sp[0].trim() + " - " + sp[1].trim();
	}


	text = cleanText(text);

	// asian formats	
	if (text.indexOf('『') != -1 && text.indexOf('』') != -1) {
		if (text.indexOf('- ') == -1)		// POLYSICS『How are you?』
			text = text.replace("『", " - ").replace("』", "");
		else														// 葛東琪 - 懸溺『我主張制止不了就放任，餘溫她卻喜歡過門，臨走呢 還隨手關了燈。』【動態歌詞MV】
			text = text.substr(0, text.indexOf("『"));
	}
	else if (text.indexOf('「') != -1 && text.indexOf('」') != -1) {		// 「テレキャスター･ストライプ」
		let match = text.replace("ー", "-").match(/^(.+?)「(.+?)」/);
		if (match) text = match[1] + " - " + match[2];
	} 

	text = text
		// .replace(/’/g, "'")
		// .replace(/[\u0000-\u001F\u007F-\u009F\u061C\u200E\u200F\u202A-\u202E\u2066-\u2069]/g, "")
		.replace(' - Topic - ', ' - ')
		.replace(/-\s*-/g, '-')

		// raidtrain specifics
		// .replace('THE MONKEES - Listen To The Band', 'The Monkees - Listen To The Band')
		// .replace('Muppet Songs: Kermit and Fozzie - Movin\' Right Along', 'The Muppets - Movin\' Right Along')
		// .replace('Harry Nilsson "Think About Your Troubles"', 'Harry Nilsson - Think About Your Troubles')
		// .replace('The Rolling Stones - Miss you live Texas 1978 (Remastered)', 'Rolling Stones - Miss You')
		// .replace('The Rolling Stones - Miss You - OFFICIAL PROMO', 'Rolling Stones - Miss You')
		// .replace('R.E.M. These Days (Live)', 'R.E.M. - These Days')
		// .replace('Nirvana\'s Smells Like Teen Spirit Butcher', 'Nirvana - Smells Like Teen Spirit, kinda')
		// .replace('Sonic Youth Hey Joni', 'Sonic Youth - Hey Joni')
		// .replace('sjobi1 - Shirley Muldowney', 'L7 - Shirley')
		// .replace('Fugazi Waiting Room (music video)', 'Fugazi - Waiting Room')
		// .replace('"Cannibal Holocaust" ~ Brutal Juice', 'Brutal Juice - Cannibal Holocaust')
		// .replace('"Nationwide" ~ Brutal Juice', 'Brutal Juice - Nationwide')
		// .replace('The Ronettes - Be My Baby | Colorized (1964) 4K', 'The Ronettes - Be My Baby')
		// .replace('Mudhoney - Overblown (Singles Soundtrack) - 1992', 'Mudhoney - Overblown')
		// .replace('Janis Bers - NOW FOR SOMETHING COMPLETELY DIFFERENT', '(a brief intermission)')
		// .replace('The Unfolding "How To Blow Your Mind And Have A Freak-Out Party" 1967', 'The Unfolding - ')

		.replace('Artur Miles - ', 'Arthur Miles - ')
		.replace('Arthuer Miles - ', 'Arthur Miles - ')
		.replace('DEVOvision -', 'DEVO -')
		.replace('Suicide Band Official -', 'Suicide -')
		.replace('TomTomClub.Com -', 'Tom Tom Club -')
		.replace('yesofficial -', 'Yes -')
		.replace('officialprimus -', 'Primus -')
		.replace('TheCarsOfficial -', 'The Cars -')
		.replace('remhq -', 'R.E.M. -')
		.replace('iamAURORA -', 'Aurora -')
		.replace('crackerrocks -', 'Cracker -')
		.replace('djshadow -', 'DJ Shadow -')
		.replace('benfoldsTV -', 'Ben Folds -')
		.replace('Chumbawamba -', 'Chumbawumba -')
		.replace('UNKLEofficial -', 'UNKLE -')
		.replace('TCLDelirium -', 'Claypool Lennon Delirium -')

		.replace(': NPR Music Tiny Desk Concert', ' - Tiny Desk Concert')
		.replace(': Tiny Desk Concert', ' - Tiny Desk Concert')
		// .replace('', '')

		.replace('Nathaniel Merriweather - To Catch a Thief', 'Loveage - To Catch a Thief')
		// .replace('', '')

		.replace("björk: ", "Björk - ")
		.replace("AnnieBurbankPiano - ", "Annie Burbank - ")
		.replace("mirahmusic -", "Mirah - ")
		// .replace("", "")

		.replace('Somebody knows the secret sauce recipe #shorts #goodburger #nickelodeon #comedy #allthat #fastfood', 'Secret sauce!')
		.replace('edatlin - Secret Sauce', 'Secret sauce!')
		
		.replace(' - Full Performance (Live on KEXP at Home)', ' - Live on KEXP at Home')
		.replace(' - Full Performance (Live on KEXP)', ' - Live on KEXP')

		.replace('Your Gonna', "You're Gonna")
		.replace(/Business/g, 'Buisness')
		.replace(/business/g, 'buisness')
		.replace(/Wednesday/g, 'Wendsday')
		.replace(/wednesday/g, 'wendsday')

		.replace(/[‐‑‒–—―⁻₋−﹘﹣－]/g, "-")

		.replace(/---/g, ' - ')
		.replace(/--/g, ' - ')
		.replace(/ : /g, ' - ')
		.replace(/ • /g, ' - ')
		.replace(/ ● /g, ' - ')
		.replace(/ · /g, ' - ')
		.replace(/ ~ /g, ' - ')
		.replace(/ \| /g, ' - ')

		.replace(' /// ', ' - ')
		.replace(' // ', ' - ')
		.replace(', "', ' - ')
		// .replace(' / ', ' - ') // too common!

		// .replace(' 『', ' - ')
		// .replace(' 『', ' - ')
		// .replace(' 「', ' - ')
		// .replace(' 「', ' - ')
		// .replace('』', ' (')
		// .replace('』', ' (')
		// .replace('」', ' (')
		// .replace('」', ' (')


		.replace('F***ck', 'Fuck')
		.replace('F**ck', 'Fuck')
		.replace('F**k', 'Fuck')
		.replace('F**K', 'Fuck')
		.replace('F***', 'Fuck')
		.replace('F*ck', 'Fuck')
		.replace('F...', 'Fuck')
		.replace('C*nt', 'Cunt')
		.replace('S**t', 'Shit')
		.replace('Sh*t', 'Shit')
		.replace('Bit*h', 'Bitch')

		.replace(/ Fag/g, ' F*g')
		.replace(/ fag/g, ' f*g')
		.replace(/Fag /g, 'F*g ')
		.replace(/fag /g, 'f*g ')
		.replace(/ Fags/g, ' F*gs')
		.replace(/ fags/g, ' f*gs')
		.replace(/Fags /g, 'F*gs ')
		.replace(/fags /g, 'f*gs ')
		.replace(/Nigger/g, 'N*gger')
		.replace(/nigger/g, 'n*gger')

		.replace(/ The /g, ' the ')
		// .replace(' with ', ' w/ ')
		.replace(/“/g, '"')
		.replace(/”/g, '"')
		.replace(/\s*-\s*\d+\s*-\s*/g, " - ")	// replace " - xxx - " with just a " - "
		.replace(/^\d{1,3} -\s*/, '')					// remove xxx - if xxx is numeric 
		.replace(/\s*#\w+\b/g, '')						// remove all #words
		.replace(/ \./g, '.')
		.replace('- -', '-')
		.replace('- ', ' - ')
		.replace(' -', ' - ')
		.replace(/[-\s(\[:]+$/, '')
		.replace(/  /g, ' ')
	;

	// count '-'s and remove first bit if more than 1
	// if (text.split(" - ").length > 2)
	// 	text = text.substr(text.indexOf(" - ") + 3);
	// else if (text.split(" - ").length < 2)
		// text = text
		// 	.replace(' / ', ' - ')
		// 	.replace(': ', ' - ')
		// ;

	return stripWords(text).trim();
}
