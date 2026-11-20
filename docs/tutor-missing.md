# What Lolly's lessons still need (stage 1)

## Pictures (nothing is drawn as a substitute)
`thing:<thing>:<color>` is painted from the WHITE objects of the English game (public/english/paint). These four things of the lessons have no white picture yet, so they
show their real picture of the word on a tile of the colour (`THINGS_MISSING` in `src/games/english/tutor/things.ts`):

| thing | used in |
|---|---|
| apple (red, green) | u3 lessons |
| book (blue, purple, yellow) | u3 lessons |
| hat (green, pink, purple) | u3 lessons |
| kite (blue, green, purple) | u3 lessons |

A white picture of each (512 x 512, transparent, like paint/ball.webp) is all that is needed: add its id to `PAINT` and remove it from `THINGS_MISSING`.
The golden crown of the album is the 👑 character (no picture file); a picture of a golden crown would replace it.

## Recordings
None are missing: every clip of the 12 lessons and of the new steps is in the manifest (the test `tutor.test.ts` fails otherwise).
