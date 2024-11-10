CREATE DATABASE dungeon;
\c dungeon;
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(256),
    password VARCHAR(256)
);