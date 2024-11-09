# Project Technical Specification

# Client Side

Client will need effectively two parts: an event handler and an input handler.

Input handler will catch the inputs we need and send them directly to the server to be handled. The server will have a relation between entities and the action they will perform this cycle, this will update that relation.

The event handler will take a list of events (update or refresh) and process them to produce the new game state.

# Server Side

The server will handle inputs, process them relative to the current game state, and send outputs once per second (a cycle).

Server can send out "update" events, each containing json information pertaining to all entities in a given room. These may be:

spawn: entity creation
updatestate: updating the state of an existing entity (movement, damage)
despawn: enemy deletion (death, leaving a room)

Any amount of these update events may be sent out at once.

Server can send out "refresh" events, containing all of the data required to build out a room. This may be necessary to resync clients or to facilitate entering a new room. If one of these is required, it should theoretically be the only event that needs to be sent that cycle.

Each entity will be assigned an ID on creation, which will be used to track their state through JS objects.
For instance, an object to relate ID to action to be performed this cycle.
