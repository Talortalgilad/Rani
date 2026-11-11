import type { LevelData } from '../engine/level';
import type { ColorId, VehicleDef } from '../engine/state';

/**
 * The five tutorial levels, drawn by hand. Each one brings in one new thing, and says it in one short sentence.
 * z grows toward the player; a heading of 270 points to the station.
 */

const q = (...parts: [ColorId, number][]): ColorId[] => parts.flatMap(([c, n]) => Array<ColorId>(n).fill(c));
const lot = { halfW: 3.4, halfH: 3.6 };
const tut = (n: number, vehicles: VehicleDef[], queue: ColorId[], steps: LevelData['steps'], size = lot): LevelData => ({
  key: `t${n}`, kind: 'tutorial', number: n, world: 'city', hard: false, lot: size, vehicles, queue, steps,
});

export const TUTORIAL: LevelData[] = [
  // 1. tap a vehicle: two cars, both with a clear road
  tut(1,
    [
      { id: 0, type: 'car', color: 'red', x: -1.2, z: 0, heading: 270 },
      { id: 1, type: 'car', color: 'blue', x: 1.2, z: 0, heading: 270 },
    ],
    q(['red', 4], ['blue', 4]),
    [
      { text: 'הקישו על המכונית האדומה', hand: 0 },
      { text: 'יופי! עכשיו המכונית הכחולה', hand: 1 },
    ],
    { halfW: 2.3, halfH: 1.4 },
  ),
  // 2. a blocked vehicle: the green van cannot leave until the blue car has gone
  tut(2,
    [
      { id: 0, type: 'van', color: 'green', x: 0, z: 2.0, heading: 270 },
      { id: 1, type: 'car', color: 'blue', x: 0, z: -1.4, heading: 0 },
    ],
    q(['blue', 4], ['green', 6]),
    [
      { text: 'הקישו על הוואן הירוק', hand: 0, blocked: { text: 'הדרך חסומה! קודם שולחים את המכונית הכחולה', hand: 1 } },
      { text: 'עכשיו הדרך פנויה. הקישו על הוואן', hand: 0 },
    ],
    { halfW: 3.0, halfH: 3.7 },
  ),
  // 3. colours: passengers only board a vehicle of their own colour, and the number tells how many seats are left
  tut(3,
    [
      { id: 0, type: 'car', color: 'yellow', x: -2.3, z: 0, heading: 270 },
      { id: 1, type: 'car', color: 'red', x: 0, z: 0, heading: 270 },
      { id: 2, type: 'car', color: 'blue', x: 2.3, z: 0, heading: 270 },
    ],
    q(['blue', 4], ['yellow', 4], ['red', 4]),
    [
      { text: 'הנוסעים עולים רק לרכב בצבע שלהם. הראשון בתור כחול', hand: 2 },
      { text: 'המספר על הרכב הוא כמה מקומות נשארו. עכשיו הצהוב', hand: 0 },
      { text: 'ועכשיו האדום', hand: 1 },
    ],
    { halfW: 3.6, halfH: 1.4 },
  ),
  // 4. big vehicles and a vehicle at an angle: a bus holds 10, a van 6, a car 4
  tut(4,
    [
      { id: 0, type: 'car', color: 'orange', x: 2.2, z: 1.6, heading: 315 },
      { id: 1, type: 'van', color: 'purple', x: -0.4, z: 0.1, heading: 270 },
      { id: 2, type: 'bus', color: 'cyan', x: -2.9, z: 0.3, heading: 270 },
    ],
    q(['cyan', 10], ['purple', 6], ['orange', 4]),
    [
      { text: 'אוטובוס מכיל 10 נוסעים, ואן 6 ומכונית 4. הקישו על האוטובוס', hand: 2 },
      { text: 'ואן מכיל 6 נוסעים', hand: 1 },
      { text: 'גם רכב באלכסון יוצא לאורך החץ שלו', hand: 0 },
    ],
    { halfW: 4.2, halfH: 3.0 },
  ),
  // 5. think ahead: five cars, four places. Fill the station with cars nobody is waiting for and you are stuck.
  tut(5,
    [
      { id: 0, type: 'car', color: 'purple', x: -2.6, z: 0, heading: 270 },
      { id: 1, type: 'car', color: 'green', x: -1.3, z: 0, heading: 270 },
      { id: 2, type: 'car', color: 'yellow', x: 0, z: 0, heading: 270 },
      { id: 3, type: 'car', color: 'blue', x: 1.3, z: 0, heading: 270 },
      { id: 4, type: 'car', color: 'red', x: 2.6, z: 0, heading: 270 },
    ],
    q(['red', 4], ['blue', 4], ['yellow', 4], ['green', 4], ['purple', 4]),
    [
      { text: 'יש רק 4 מקומות בתחנה. תחשבו מי עולה ראשון!' },
    ],
    { halfW: 3.4, halfH: 1.4 },
  ),
];
