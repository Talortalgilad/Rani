# Squishy workshop, stage 3: the carnival (SPEC-squishy.md 3)

- **Shelf -> carnival:** on the page of a squishy of the shelf, "שלחי לקרנבל" / "החזירי למדף". Up to 8 live there (`Store.carnival`, ids of shelf squishies; a ninth is refused with a message). They stay on the shelf too.
- **Residents:** `src/lobby/carnival/mine.ts` makes a resident from the saved data (`id sq_<id>`). Favourite food = the one she chose; favourite colour = the main colour of the body; character, game, number, hobby and party day by the id. They are always out (the tier limit is for the others), have wishes, queues, a friendship meter, a card and a place in the book ("הכנתי בעצמי" with a small star).
- **Picture:** drawn once from the saved data with the workshop's own flat drawing (`drawSquishy`), 256 x 256, kept in memory for the session (`flatPicture`), put in the residents' atlas: no squeeze mesh, no per-frame drawing, no extra draw call.
- **Name:** has no recording and is only written; the two places that say a name skip them (a test checks it). No voice of the phone.
- **Toys:** the squishy made for an order is saved with the one who ordered it (`orders.toys`, the last 8); the resident with his picture (else one of the others) carries it, small, at his side.
- **Building:** "סדנת הסקווישים" (the picture of the kiosk of the workshop) stands at `WORKSHOP` (layout.ts), with the line of the squishies that wait, and a number over it (the orders that wait). A tap goes through the gate like every game and the workshop opens straight on the first order (`sessionStorage sq-orders`).
- **Accessories:** `scripts/accessory-anchors.py` also makes `shape:<mold>` anchors for the 18 molds (from the template and the place where the workshop draws the face); a squishy of the donut mold wears no scarf (the face is on the lower part of the ring).
- **Quests:** `qs_workshop` (a squishy on the shelf) and `qs_order` (an order done).
