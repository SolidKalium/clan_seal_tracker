# Clan Seal Tracker — PHP edition

The original server-rendered tracker. It will be retired once the [browser edition](../js/README.md) reaches parity. Shared Bungie API notes and resources are in the [root README](../README.md).

File paths resolve from `APP_ROOT` (this folder, defined in `include.php`), so scripts work regardless of the working directory. Cached API data (`definitions*/`, `profiles*/`, `groups/`) and `settings.json` live here and are ignored by git.

## Setup this project to run on your own server
- Checkout this git repository on your server and serve this `php/` folder
- Register for a developer app at https://www.bungie.net/en/Application
  - Select public auth to enable a few features (TODO in development. private might allow longer times between authorizations)
  - The application is automatically approved and can be edited later.
- Copy `settings.example.json` to `settings.json` in this folder and add your api key and clan group_id
- There are no dependencies to install, but you'll need PHP with CURL
- Each profile fetch API call needs seconds and megabytes of data, so everything is cached in files. You may need to enable folder and file creation/editing for the profiles/ and definitions/ directories.
- Individual users do not need to authenticate. Only public data is used.
- Apache may need to be given permission to write files and folders

- share your feedback or submit pull requests for improvements

## Debugging
- Several ids are automatically populated on column and row headings
- There are some useful functions in include.php
- Run the server locally with `php -S localhost:8000 -t php` from the repository root (or `php -S localhost:8000` inside `php/`), then open http://localhost:8000/
- If some profiles have old data, you can force an update for all clan members with: `members.php?refresh`

## Internal notes

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
look into php 7 features
