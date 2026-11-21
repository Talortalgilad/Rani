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

## Stage 4: reasons to come back (SPEC-carnival.md 4.7)
What is not in the repo is not drawn, not made up and not read by the voice of the phone; it is only listed here.
| what | for | what is done instead |
|---|---|---|
| a sleep hat (pyjamas) | at night some squishies in pyjamas | nothing: only the lamps and the night sky, and the greeting "לילה טוב, רני!" |
| a small suitcase | the guest of the day arrives with one | nothing is drawn: he arrives with the "!" bubble and the banner "יש לנו אורח היום!" |
| music for the parade | Friday's parade, "with music" | none: the rhythm is her taps, each with a small sound effect (the ones the app already has) |
| a nest | the egg "in a nest" | none needed: the picture of the egg (`egg.webp`) already has its nest |
| a recording of the chirp of a baby | the baby chirps | two high pops of the existing sound effects |
| the four sentences of `voice/carnival-stage4-lines-to-record.csv` (cs_gift_done, cs_gift_decor, cs_gift_accessory, cs_album_empty) | the windows of the gift and the album | text only, nothing is said (never the voice of the phone). The buttons and titles of those windows ("המכתבים שלי", "האלבום שלי", "כן, תישאר!", "אולי מחר", the bar of the parade) are not meant to have a voice |
Everything else of the stage is recorded and used (`cs_egg_found`, `cs_egg_wait`, `cs_egg_hatch`, `cs_baby_hello`, `cs_i_grew`, `cs_mail`, `cs_letter.0-2`, `cs_visitor`, `cs_visitor_stay`, `cs_daily_gift`, `cs_collected`, `cs_welcome_back`, `cs_parade`, `cs_good_night`, `cs_good_morning`, and the quests `qs_egg`, `qs_mail`, `qs_gift`, `qs_visitor`, `qs_parade`).

## Decisions of stage 4 (not in the spec, to check)
- An egg comes at the even levels 4, 6, 8 ... (the first six new residents come with the levels 2, 3, 5, 7, 9, 11; the twelve others come from eggs and guests).
- Parents' area: "קרנבל: בדיקת הימים": skip a day forward (the clock of the carnival only) and start the parade on the next entry.
- "We collected for you": 2 hearts for each day away, at most 10.
- A decoration from the gift of the day is built for free once.
