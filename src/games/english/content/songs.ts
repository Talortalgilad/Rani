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
  5: { world: 5, title: 'Candy shop', bpm: 88, lines: [
    [w('One,'), w('two,'), w('three,'), w('four,'), w('five!')],
    [w('Candy', 'candy'), w('candy,'), w('sweet'), w('and'), w('nice!')],
    [w('Ice', 'icecream'), w('cream,'), w('cold'), w('as'), w('ice!')],
    [w('Cookie', 'cookie'), w('cookie,'), w('yum,'), w('yum!')],
  ] },
  6: { world: 6, title: 'My family', bpm: 84, lines: [
    [w('Mom', 'mom'), w('mom,'), w('I'), w('love'), w('you!')],
    [w('Dad', 'dad'), w('dad,'), w('I'), w('love'), w('you!')],
    [w('Ray', 'brother'), w('is'), w('my'), w('brother!')],
    [w('Friends', 'friends'), w('and'), w('family,'), w('hooray!')],
  ] },
  7: { world: 7, title: 'The wardrobe', bpm: 88, lines: [
    [w('Hat', 'hat'), w('hat,'), w('on'), w('my'), w('head!')],
    [w('Shoes', 'shoes'), w('shoes,'), w('on'), w('my'), w('feet!')],
    [w('Dress', 'dress'), w('dress,'), w('twirl'), w('and'), w('spin!')],
    [w('Clap,'), w('clap,'), w('I'), w('look'), w('great!')],
  ] },
  8: { world: 8, title: 'Dance party', bpm: 96, lines: [
    [w('Jump', 'jump'), w('jump,'), w('jump'), w('up'), w('high!')],
    [w('Clap', 'clap'), w('clap,'), w('clap'), w('your'), w('hands!')],
    [w('Dance', 'dance'), w('dance,'), w('dance'), w('with'), w('me!')],
    [w('Sing', 'sing'), w('sing,'), w('sing'), w('a'), w('song!')],
  ] },
  9: { world: 9, title: 'Weather', bpm: 84, lines: [
    [w('Sun', 'sun'), w('sun,'), w('hot'), w('and'), w('bright!')],
    [w('Rain', 'rain'), w('rain,'), w('drip'), w('drop'), w('drip!')],
    [w('Umbrella', 'umbrella'), w('up,'), w('up,'), w('up!')],
    [w('Rainbow', 'rainbow'), w('rainbow,'), w('hello!')],
  ] },
  10: { world: 10, title: 'The zoo', bpm: 92, lines: [
    [w('Lion', 'lion'), w('lion,'), w('roar,'), w('roar,'), w('roar!')],
    [w('Monkey', 'monkey'), w('monkey,'), w('jump'), w('and'), w('swing!')],
    [w('Elephant', 'elephant'), w('big'), w('and'), w('gray!')],
    [w('Cat', 'cat'), w('and'), w('dog,'), w('hooray!')],
  ] },
  11: { world: 11, title: 'Ninja park', bpm: 96, lines: [
    [w('Ninja,'), w('ninja,'), w('climb'), w('the'), w('wall!', 'wall')],
    [w('Over'), w('the'), w('rope,', 'rope'), w('hop,'), w('hop,'), w('hop!')],
    [w('Under'), w('the'), w('bridge,', 'bridge'), w('shh,'), w('shh!')],
    [w('Ninja,'), w('ninja,'), w('you'), w('did'), w('it!')],
  ] },
  12: { world: 12, title: 'The big show', bpm: 100, lines: [
    [w('Mom', 'mom'), w('and'), w('dad,', 'dad'), w('clap'), w('for'), w('me!')],
    [w('Pizza', 'pizza'), w('and'), w('cookie,', 'cookie'), w('yum,'), w('yum!')],
    [w('Dance', 'dance'), w('and'), w('sing', 'sing'), w('on'), w('the'), w('stage!', 'stage')],
    [w('Sun', 'sun'), w('and'), w('rainbow,', 'rainbow'), w('what'), w('a'), w('star!', 'star')],
  ] },
};
