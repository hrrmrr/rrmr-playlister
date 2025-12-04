# RRMR Playlister
A (relatively) simple way to take music requests from youtube via Twitch chat.  While there are a few steps to setting it up, they're all quite simple.  Ask your favorite AI if you don't know how something is done.

This code, in a word, is *janky*.  It was written *ad hoc* before fully realizing the scope, and thus many things could've been done smarter than they are.  That being said, this code has had hundreds of hours of testing and is as bulletproof as it can be.

## Features:

* Priority Sorting of Requests
Playlister doesn't just first in, first out with requests, but instead sorts them based on how many requests that user has made.  E.g. everyones first requests get played before any second requests.  This way, even people who are joining late can still parcipate.

* Smrt Region-Restricted Workaround
If you have a global audience, their valid Youtube URLs often aren't valid in your country.  Playlister can detect when this occurs and automatically tries to replace their requests.

* Incorporated into Twitch and discord
Easily take requests *and* give your users a place to save their favorites!

## Setup

1. Install Node.js

2. Open a Node.js command prompt and navigate to your copy of Playlister

3. Use npm to add the needed components:
	* fs
	* path
	* WebSocket
	* http
	* readline

4. Open *reqbot.js* in your preferred text editor
This file contains some variables you **must** update before using Playlister (and several others you may want to change depending on your stream.)

``BROADCASTER_TWITCH_NAME``		Username (in all lowercase!) of the stream
``BROADCASTER_USER_ID``			Numeric ID of that account

You can get the ID for your username at https://betterbanned.com/en/tools/convert-twitch-username-to-channel-id

``BOT_ADMINS``					Users (in all lowercase!) with access to **all** bot commands.  *Choose wisely!*
``TWITCH_MODS``					Your Twitch mods (in all lowercase!)

Listing your Twitch mods is only necessary if you're using the ``is_vipAutomatic`` option, or the *Skip! [Mods Only]* redeem.

Starting on line 49, there are 4 variables that define how certain aspects of Playlister behave.

``is_greet``					Set to *true* if you want the bot to greet people when they first say something in chat
``is_redeemsActive``			Set to *true* if you're incorporating channel point redeems into the code
``is_favoriteActive``			Set to *true* to activate user favorites
``is_imagesActive``				Set to *true* if you want links to giphy.com and gifdb.com to be shown on screen
``is_vipAutomatic``				Set to *true* if you want Playlister to automatically VIP anyone who requests a video

These VIP badges, when enabled, are temporary and will be removed when the *!shutdown* command is given.

5. Open *index.html* in your preferred text editor
On line 30 of this file, there is one variable that must be updated: ``YOUTUBE_API_KEY``.  You can find instructions on how to aquire your own key at https://developers.google.com/youtube/v3/getting-started

Next is ``COUNTRY_CODE`` which you'll need to update if you're not streaming from the US.  Below that, you find variables for ``LATENCY_MS`` and ``SHORTS_LEN_SS``.  You'll want to update them here too if you changed them in *reqbot.js*.

On line 38, you'll find 3 variables you'll need to update if you want to incorporate discord to save user favorites.  You can find instructions on how to get these values at https://support.discord.com/hc/en-us/articles/206346498-Where-can-I-find-my-User-Server-Message-ID

``DISCORD_SERVER_ID`` 			Numeric ID of your discord server
``DISCORD_CHANNEL_ID``			Numeric ID of the channel to share user favorites
``DISCORD_UNSORTED_THREAD_ID``	Numeric ID of the thread (in above channel) to save favorites for unknown users

On line 42, there's an empty structure ``userThreads``.  Below it is where you can define individual threads for each user.  Just like ``DISCORD_UNSORTED_THREAD_ID`` above, these threads must be created in the ``DISCORD_CHANNEL_ID`` channel.  (You can only get an ID for a thread after it's been created.  And yes, usernames should be in all lowercase.)

If you're not planning on using Playlister for a music stream, you'll want to comment out line 257: ``+ '&topicId=/m/04rlf'`` (as this tells Youtube search to look for music.)

## Running Playlister

Once all that's sorted, running Playlister is quite simple.  First, update ``BROADCASTER_OAUTH`` and ``BROADCASTER_REFRESH`` in *reqbot.js*, something that must be done each time you want to use Playlister.  You can get these values by logging in via Twitch at https://ytvizzy.com/bot

Once that's done, navigate to the directory containing the code and run ``node reqbot.js``.  The code will connect to your chat room and begin accepting requests.  Next, open http://localhost in a browser.  (It is suggested that you add this external browser to OBS, as the client is known to freeze randomly when used as a browser source.)  It's also suggested that you add the extensions *Unhook Youtube* (to remove annoying cards from popping up over the video) and *VolumeVibe* (to help maintain a more constant volume level).

Playlister expects something to be shown behind it, so its background is that of a typical greenscreen.  You can make this transparent by adding a *Chroma Key* filter in OBS and changing it to *Green*.  For even more transparency, you can also add a *Luma Key* filter (set to its minimal values).

## Admin Commands

* ``!songrequest [@username] <request>``
**Shortcuts: !sr**

Admins can make requests for other users by using the syntax ``!sr @username https://youtu.be/url`` or ``!sr @username search terms``.

Admins can also request full youtube playlists by using a playlist URL.  E.g. ``!sr https://www.youtube.com/playlist?list=PLGI55acJeEwPEtC3hkRoc7ZqKdrD0fsru``.  Only the first 50 videos of a playlist can be added this way.

* ``!queuenext [@username] <request>``
**Shortcuts: !qn ``**

Same as ``!songrequest`` but automatically queues the request up next.


* ``!wrongsong [@username] <match>``
**Shortcuts: !ws**

Admins can remove requests from other users by using the syntax ``!ws @username match``.  The last argument is optional, but the last song with "match" in its title will be removed instead of their last request.


* ``!nix <x>``
**Shortcuts: none**

Admins can delete requests from the playlist with ``!nix <x>`` where *x* is the number of the request to remove.


* ``!move <from> <to>``
**Shortcuts: !m**

Moves a request in the queue.  ``!m <from> <to>``  Note: moving a request down in the queue moves everything after it up one, possibly putting it a spot later than you intended.


* ``!skip``
**Shortcuts: !n**

Skips to the next request.


* ``!lastcall``
**Shortcuts: none**

When !lastcall is activated, the bot tells everyone they have 10 minutes left to make one more request.  Any user may make a request during this time regardless of how many they've already made.  Once the 10 minutes is up, the bot closes the requests and only users who haven't requested anything this stream may make one (or users who use a redeem for an additional request.  See below.)


* ``!pause``
**Shortcuts: none**

Pauses the video.


* ``!play``
**Shortcuts: none**

Resumes playing the video.


* ``!break``
**Shortcuts: none**

Tells the client not to advance to the next request (when the current video ends) until a ``!skip`` command is received.


* ``!unbreak``
**Shortcuts: none**

Cancels the above command.


* ``!search <match>``
**Shortcuts: !find !sq**

Displays all tracks matching the provided text.  E.g. ``!search text`` displays all requests with "text" in the title.


* ``!settitle <x> <new title>``
**Shortcuts: !title**

Changes the title of a request.  ``!title 11 Eleven - A New Name`` renames the 11th request to *Eleven - A New Name*.


* ``!setpos <x>``
**Shortcuts: !pos**

Changes the current position of the queue so that request ``<x>`` will play next.


* ``!shutdown``
**Shortcuts: !sd**

Pauses the video and begins shutting down the server.  Also removes VIP badges if ``is_vipAutomatic`` is set to *true*.


* ``!troll <match>``
**Shortcuts: !t**

Adds a video from *trolls.mjs* with a title that includes *<match>*.  E.g. ``!troll whip`` would add (the only example video) *Where There's a Whip, There's a Way!*.  Users may also randomly request these videos with the *Troll Time!* redeem (see below).


* ``!bumper <match>``
**Shortcuts: !b**

Same as ``!troll``, but pulls from *bumpers.mjs* instead.  These are intended for (usually short) bumpers to be played between requests.


* ``!open`` / ``!close``
**Shortcuts: none**

Sets request status to open or closed, respectively.  Users who haven't made a request this stream will still be able to make a single request even when requests are closed.  Additional requests from redeems are also still active.


* ``!on`` / ``!off``
**Shortcuts: none**

Sets request status to on or off, respectively.  When requests are off, only admins can make requests.


* ``!group`` / ``!nogroup``
**Shortcuts: none / !ungroup**

Turns on/ off the automatic grouping requests by same artist.


* ``!greet`` / ``!ungreet``
**Shortcuts: none**

Turns on/ off the automatic greeting by the bot.


* ``!showqueue`` / ``!hidequeue``
**Shortcuts: !sq / !hq**

``!showqueue`` makes BROADCASTER_TWITCH_NAME's requests appear in ``!queue`` requests.  ``!hidequeue`` hides them from users.


## User Commands

* ``!songrequest``
**Shortcuts: !sr**

Users can make a request either by searching ``!sr talking heads cities`` *or* by pasting a youtube video URL in chat.  The ``!songrequest`` command isn't needed if a youtube URL is at the start of a message, and message in chat that starts with a youtube URL is assumed to be a request by the code.


* ``!wrongsong <match>``
**Shortcuts: !ws**

Removes the last request from that user.  If the optional argument is provided, the last request with that argument in its title will be removed instead.  E.g. ``!ws match`` would remove the last request with "match" in its title, and the last request made if no matches are found.


* ``!queue``
**Shortcuts: !q !schedule !s**

Displays the next few requests in the queue.


* ``!when``
**Shortcuts: !next !w**

Displays how many videos are in the queue before the user's next request.


* ``!mine``
**Shortcuts: !my**

Displays what upcoming requests user has in the queue.


* ``!dedicate <who>``
**Shortcuts: !ded !d**

Lets user dediate the current song to someone or something.  E.g. ``!ded the concept of shame``


* ``!favorite <note>``
**Shortcuts: !fave !fav !f**

Adds the current video to the user's favorites and (if configured) posts it to their discord thread.  If the optional argument is included, the bot will include it in the discord message.  E.g. ``!f this song is groovy``


* ``!favoritelast``
**Shortcuts: !favlast !fl**

Same as !favorite, except it adds the previous video instead.


* ``!points <who>``
**Shortcuts: !pts !pt**

Displays how many points the user has, or the user indicated if the optional argument is included.


* ``!top``
**Shortcuts: !leaderboard !lb**

Displays the requesters (active in chat) with the most points.


* ``!myfavorites``
**Shortcuts: !myfavs !mf**

Displays whose requests the user has favorited the most.


* ``!myfans``
**Shortcuts: !myfan !who**

Displays who's favorited the user's requests the most.


* ``!song``
**Shortcuts: !link**

Displays the request currently playing.


* ``!lastsong``
**Shortcuts: !last !ls**

Displays the request playing previously.


* ``!image``
**Shortcuts: none**

If ``is_imagesActive``	is true, allows users to display any image from giphy.com or gifdb.com (both direct .GIF URLs and site URLS are supported.)  Much like ``!songrequest``, the ``!image!`` command isn't needed if the URL is at the start of a message.


## Channel Point Redeems

If ``is_redeemsActive`` is true, redeems will work automatically if they have the exact same names as listed below.  To use different names for your redeems, you'll need to find the command in *reqbot.js* (starting on line 1334) and modify it there.

* ``One more request!``

Allows the user to make another request.

* ``Play this next!``

Allows the user to make another request and schedules to be played next.


* ``Play an extra long song!``

Allows user to request a song that's longer than ``MAX_LENGTH_SS`` (but shorter than ``LASTCALL_MAX_LENGTH_SS``).


* ``Troll Time``

Randomly adds a video from *trolls.js* next in the queue.


* ``I'm the DJ!``

Allows a user to temporarily take control of requests.  For the next 30 minutes, Playlister will prioritize any requests from that user.


* ``Skip my request!``

Allows a user to skip their own request if it's currently playing.


* ``Skip! [mods only]``

Allows users listed in ``TWITCH_MODS`` to skip the current request.


* ``Add to Favorites!``

Adds the current video to the user's favorites (and their discord thread, if configured.)

### Admin Redeems

The following redeems are also available and work exactly like their corresponding command.  These are intended to only be used as shortcuts by the streamer, so it's suggested you make them excessively costly to prevent other users from redeeming them.

* ``!lastcall``
* ``!play``
* ``!pause``
* ``!skip``
* ``!break``
* ``!open``
* ``!close``

