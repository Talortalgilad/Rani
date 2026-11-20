# What the carnival still needs

## Pictures
None are missing. The nine pictures of sheet 39 (`carnival-art-4.json`) are in `public/park/items`: `lollyschool` (the school), `partyhat`, `crown`, `glasses`, `scarf`, `bow`, and the three new ones `sunglasses`, `flowercrown`, `cape`.
`ACCESSORY_MISSING` in `src/lobby/carnival/friends.ts` is empty (a test fails when a file appears and the list is not updated, and the other way round).

How they were cut: `python3 scripts/carnival-art-flat.py` (a flood from the page colour: `rembg` could not be installed in the session that did this, so the cut does not guess; the frames of the glasses and the fringe of the scarf stay, and the empty lenses, the neck of the scarf and the inside of the flower crown are transparent). `scripts/carnival-art.py carnival-art-4.json` is the same sheet with rembg, if you want to compare.

## Recordings
None are missing: every line of the cards, the questions, the party, the gift and the quests is recorded (a test checks them). The shops have no spoken line (the texts are short Hebrew labels and nothing is read by the voice of the phone).

## The shops of accessories (SPEC-carnival.md 5.4); the quest qs_hat ("dress a hat on a squishy") is done by dressing a party hat or a flower crown from the shop
Built: the hat shop (world 7) sells the party hat, the flower crown, the bow, the glasses and the sunglasses; the toy shop (world 10) sells the scarf, the cape, the balloons and the medal. The price is in **stars** (3-8), not in hearts: the hearts are the level of the carnival and never go down, so nothing spends them. If you want hearts after all, a separate spendable counter has to be added.
You buy one, it waits in the stock, and you drag it onto a squishy: it stays with him. One thing for each part of the body (head, face, neck, back, hand, chest): a new one takes the place of the old one, which goes back to the stock.

## Not done in this stage
- the long press on a resident now opens his card; putting a gift on another resident (it is put on the one who gave it)
- taking an accessory off a squishy directly (it is changed by dressing him in another one of the same place)
