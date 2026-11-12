import { largestHole } from '../src/games/traffic/engine/geometry';
import { boxOf } from '../src/games/traffic/engine/solver-types';
import { NUMBERED_LEVELS } from '../src/games/traffic/levels';
console.log(NUMBERED_LEVELS.map((l) => l.number + ':' + largestHole(l.vehicles.map(boxOf), l.lot.halfW, l.lot.halfH).toFixed(2)).join(' '));
