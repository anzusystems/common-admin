**Verdict: M1 and M2 are closed.** I found no High or Medium regression in the reviewed changes.

- **M1:** Both socket join paths validate the three-segment room shape. Document authorization then requires that exact room’s socket membership and a document name beginning with `<room>:`. The other listeners and BullMQ processors do not join sockets to a client-named room.
- **M2:** The client’s room name is no longer interpolated into a regex. With MongoDB’s default simple string collation, the range `[$gte: room + ':', $lt: room + ';')` selects exactly the `room:` prefix: `:` and `;` are adjacent, and `cms:article:10:` falls outside the range for `cms:article:1`.
- The stated `cms`, `dm:box`, and `cms:scenarioJob` shapes pass. An ID containing `:` would be refused; I found no evidence of an existing room using one.
- The tests cover rejected short rooms and cross-room documents, but [the deletion test](/home/volar/projects/anzusystems/krok5-praca/collab-next-wt/test/collabRoomHelper.test.ts:23) checks only the mocked Mongo filter, not its database boundary behavior. I ran no tests, as requested.

Low items: [the room validator](/home/volar/projects/anzusystems/krok5-praca/collab-next-wt/src/util/helper/collabRoomHelper.ts:4) accepts a trailing newline because JavaScript `$` can match before it; [invalid info subscriptions](/home/volar/projects/anzusystems/krok5-praca/collab-next-wt/src/server/event/listener/subscribeCollabRoomInfoListener.ts:13) receive no callback.

no blocking finding