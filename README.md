
# Clan Seal Tracker

## Setup this project to run on your own server
- Checkout this git repository on your server
- Register for a developer app at https://www.bungie.net/en/Application
  - Select public auth to enable a few features (TODO in development. private might allow longer times between authorizations)
  - The application is automatically approved and can be edited later.
- Create settings.json and add your api key and clan group_id
- There are no dependencies to install, put you'll need PHP with CURL
- Each profile fetch API call needs seconds and megabytes of data, so everything is cached in files. You may need to enable folder and file creation/editing for the profiles/ and definitions/ directories.
- Individual users do not need to authenticate. Only public data is used.
- Apache may need to be given permission to write files and folders

- share your feedback or submit pull requests for improvements


## Resources
### API and development resources
- [Bungie developer application](https://www.bungie.net/en/Application)
- [Bungie API descriptions](https://bungie-net.github.io/multi/index.html)
- [Bungie github wiki](https://github.com/Bungie-net/api/wiki/): Official github for the API. Hosts public definitions and issues.
- [light.gg manifest changes](https://www.light.gg/db/changes/): See what changed and when in the manifest
- [Destiny Data Explorer](https://data.destinysets.com/): good for looking up hashes orr navigating hierarchical data structures in the manifest
  - [API Explorer](https://data.destinysets.com/api): Use the API from a GUI, and then navigate the manifest from there
- [D2 Momento](https://altbdoor.github.io/d2-memento/): The appearance of each craftable gun with each momento on it
- [Destiny API Discussion](https://discord.gg/E5uB4BW)

### Sites to compare against or look at for inspiration
- [Destiny Item Manager](https://app.destinyitemmanager.com/): DIM is great for moving gear and setting up loadots. Also see most profile data.
- [D2 Checklist](https://www.d2checklist.com/): See the weeklies you've completed on each character. Also see most profile data.
- [Braytech](https://bray.tech): 
  - [Voluspa commonality data](https://b.vlsp.network/Common): Get approximate number of players with gear or triumphs unlocked.
- [Destiny Sets](https://destinysets.com/): See what you've collected (might be abandoned from Season 18 onwards)
- [Blue Engram](https://engram.blue/crafting): a simple site for weapon crafting unlock progress
- [Today in Destiny](https://www.todayindestiny.com/)
- [Destiny Recipes](https://destinyrecipes.com/): various tools such as an end of season checklist
- [Destiny Emblem Collector](https://destinyemblemcollector.com/): how to get emblems
- [Charlemagne](https://warmind.io/): discord bot for LFGs, clan member seal and raid notifications, and leaderboards
- [Bungie's user profile page](https://www.bungie.net/7/en/User/Profile/): the official web-based representation of data
  - There are iOS and Android apps too. Those also let you buy bounties.
- Some old lists of sites
  - https://github.com/vpzed/Destiny2-API-Info/wiki/Destiny-2-Open-Source-Projects
  - https://www.reddit.com/r/DestinyTheGame/comments/jitt09/a_comprehensive_list_of_useful_external_destiny_2/

#### Other sites (not vetted)
- [Destiny Fate Finder](https://github.com/nwLSteam/DestinyFateFinder): looks at player history to see when they first played with current clan members
- [Party Randomizer](https://chrisfried.github.io/party-randomizer/): Selects randomized weapons for party members. Involves manual steps.
- [Destiny 2 Historical Heatmap](https://chrisfried.github.io/secret-scrublandeux/): Activity history
- [Rich Destiny App](https://richdestiny.app/): an exe that provides "rich presence" data to discord (PC only)
- [Redrix.io](https://redrix.io/): mobile app for crucible
- [Little Light](https://www.littlelight.club/): Mobile app for destiny
- [Hawthorne](https://www.hawthornebot.tech/hawthorne/home]: A discord bot, somewhat like Charlemagne
- [.Net Bungie API wrapper](https://github.com/EndGameGl/DotNetBungieAPI) (unofficial)
- [Seasonal predictions](https://predict.wastedondestiny.com/): guess what you think the next season will bring
- [Destiny Tracker](https://destinytracker.com/)
- [Destiny Theater](https://alpha.guardian.theater/): See twitch recordings from teammates and opponents
- [Ishtar Collective](https://www.ishtar-collective.net/): Lore
- [Trials Report](https://trials.report/)
- [Raid Report](https://raid.report/) / [Dungeon Report](https://dungeon.report/)
- [Parallel Program list](https://solely.gay/parallel): People who have received the Parallel Program emblem for contributions to the community
- [Cosmodrome](https://cosmodrome.page/): List of destiny-related projects

### Meme sites
- https://oracles.report/

## Debugging
- Several ids are automatically populated on column and row headings
- There are some useful functions in include.php
- Run the server locally with `php -S localhost:8000` in the project folder
- If some profiles have old data, you can force an update for all clan members with: `members.php?refresh`

-----

## Key concepts
### Group
A Destiny 2 clan is a Bungie group
You can fetch it's member list.

### User
This is the bungie.net account. It's main utility is giving you all of the memberships someone has, including the ones specific to a gaming platform.
A membership for one platform can override the details for a different platform.
This program uses the primary membership type and id as the profile key. It doesn't try to handle cases where someone has multiple active profiles that aren't being overriden.

### Profile / Account
This is a player in destiny. A number of components can be requested and the response can end up being very large.
A player can have multiple characters.

### Presentation Node
These form a hierarchy of display groups.
Some can have an associated record.

### Record
These are things that can be completed, mainly triumphs and triumph-like things.
A record has a list of objectives. The objectives are stored in two different places depending on whether they are listed in parallel or if there are multiple steps that must be earned in order.

### Destination
A main area, like the EDZ. A location is more specific. I don't know what a bubble is, but they are on the moon ghost checklist.

-----

## INTERNAL NOTES

### Implementation next steps
Files that should be accessible need to be in their own folder. (Security)
Setup database ? just use a file for now
Setup on remote server
Create github page
Add a license?
Add an info page
Add privacy info
Add disclaimer that I am not affiliated with Bungie
rewrite front end to provide better realtime info in browser? (use js)

### Feature ideas
track historical triumph values?
look into php 7 features
if automatically checking player data frequently, could add custom events to send to discord
  For example, notify users of mods they are missing being on sale
  Integration with Charlemagne LFG to show progress for the relevant activity and users that have joined (plus maybe those who have commented)
some "clans" are made of multiple in-game clans

### Other project ideas
Charlemagne calendar link?
How does charlemagne get realtime D2 data?

### Misc notes
Gilding count is a metric
