/**
 * The song at the end of every world: a short chant on a steady beat. Each word takes one beat; a word with a picture lights up and
 * the picture hops when it is said (Rani taps it). The text is read by the voice of the device (a chant, not a tune).
 */
export interface SongWord { t: string; pic?: string }
export interface Song { world: number; title: string; bpm: number; lines: SongWord[][] }

const w = (t: string, pic?: string): SongWord => ({ t, pic });

export const SONGS: Record<number, Song> = {
  1: { world: 1, title: 'My room', bpm: 84, lines: [
    [w('Ball', 'ball'), w('ball,'), w('bounce'), w('the'), w('ball!')],
    [w('Book', 'book'), w('book,'), w('read'), w('the'), w('book!')],
    [w('Bed', 'bed'), w('bed,'), w('time'), w('for'), w('bed!')],
    [w('Clap,'), w('clap,'), w('clap,'), w('clap!')],
  ] },
  2: { world: 2, title: 'The kitchen', bpm: 84, lines: [
    [w('Pizza', 'pizza'), w('pizza,'), w('yummy,'), w('yum!')],
    [w('Apple', 'apple'), w('apple,'), w('red'), w('and'), w('sweet!')],
    [w('Milk', 'milk'), w('milk,'), w('cold'), w('and'), w('white!')],
    [w('Clap,'), w('clap,'), w('yummy,'), w('yum!')],
  ] },
  3: { world: 3, title: 'The garden', bpm: 88, lines: [
    [w('Swing', 'swing'), w('swing,'), w('up'), w('and'), w('down!')],
    [w('Bike', 'bike'), w('bike,'), w('ride'), w('around!')],
    [w('Slide', 'slide'), w('slide,'), w('wheee,'), w('wheee!')],
    [w('Clap,'), w('clap,'), w('in'), w('the'), w('park!')],
  ] },
  4: { world: 4, title: 'Drawing studio', bpm: 84, lines: [
    [w('Pencil', 'pencil'), w('pencil,'), w('draw'), w('a'), w('line!')],
    [w('Paint'), w('with'), w('the'), w('brush', 'brush'), w('brush!')],
    [w('Red,'), w('blue,'), w('yellow,'), w('pink!')],
    [w('Clap,'), w('clap,'), w('what'), w('a'), w('picture!', 'picture')],
  ] },
};
