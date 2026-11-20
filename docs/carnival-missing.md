# What the carnival still needs (stage 3)

Nothing was drawn as a substitute. Each picture below is looked for by name in `public/park/items/<name>.webp` (512 x 512, transparent, like the others); the moment the file is there it is drawn,
with no change in the code (`src/lobby/carnival/friends.ts`: ACCESSORIES and ACCESSORY_MISSING; a test fails when a file appears and the list is not updated).

## Pictures
| name | for | where it sits |
|---|---|---|
| `lollyschool` | the school of Lolly (SPEC-tutor.md 2): a small building | `.cvw-school`, at SCHOOL in layout.ts. Until it exists Lolly stands alone at that place with the ❗ |
| `partyhat` | the party hat on the day of the party | over the head |
| `crown` | the crown of the best friend (level 5) | over the head |
| `glasses`, `scarf`, `bow` | gifts of level 4 (the others: balloons and the medal, which exist) | face, neck, head |

The shops of accessories (SPEC-carnival.md 5.4) are postponed: with only the chef's hat, the balloons and the medal there is nothing to sell. They come when the pictures above exist.

## Recordings
None are missing: every line of the cards, the questions, the party, the gift and the quests is recorded (a test checks them).

## Not done in this stage
- the long press on a resident to open his card (the card opens from the book of residents, "הכרטיס שלו")
- putting a gift on another resident (it is put on the one who gave it)
