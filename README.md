# cs375-multi-dungeon

Simple "real-time" multiplayer dungeon game made with HTML/CSS/JS.

## Requirements
<ul>
  <li>Node.JS</li>
  <li>PostgreSQL</li>
  <li>PixiJS</li>
  <li>WebSockets (ws library)</li>
</ul>

## Setup

### Installing Dependencies
Run `npm install` to install all project dependencies.

### Database Setup
Run `npm run setup` to run the SQL script that setups up the database and the user table. After that, please create a new file called `env.json` at the root directory of the project. This file will contain all the credentials needed to access a PostgreSQL database from our code. Please define the following fields in the file:
<ul>
  <li>user</li>
  <li>host</li>
  <li>database</li>
  <li>password</li>
  <li>port</li>
</ul>

## Running

Run `npm run start`. Access locally through the link output into the console.

## Original Contract

-   Deploy
-   Can navigate game world by moving avatar via arrow keys and change rooms, level map is hardcoded
-   Each player's avatar is recognizable (e.g. username displayed above head)
-   Can send chat messages to users in same room
-   Can battle users and enemies, gain XP, level up
-   Optional: Inventory mechanic
-   WebSockets
-   Postgres
-   Authentication, authorization
