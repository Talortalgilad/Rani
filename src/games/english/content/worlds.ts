export interface World { n: number; name: string; he: string; emoji: string; color: string; /** built (stage 2: all twelve) */ ready: boolean }

export const WORLDS: World[] = [
  { n: 1, name: 'My room', he: 'החדר שלי', emoji: '🛏️', color: '#ff9fc0', ready: true },
  { n: 2, name: 'The kitchen', he: 'המטבח', emoji: '🍕', color: '#ffb52e', ready: true },
  { n: 3, name: 'The garden', he: 'הגינה', emoji: '🌳', color: '#7ed957', ready: true },
  { n: 4, name: 'Drawing studio', he: 'סטודיו הציור', emoji: '🎨', color: '#b58cff', ready: true },
  { n: 5, name: 'Candy shop', he: 'חנות הממתקים', emoji: '🍭', color: '#ff7ad0', ready: true },
  { n: 6, name: 'My family', he: 'המשפחה שלי', emoji: '👨‍👩‍👧', color: '#6fd3ff', ready: true },
  { n: 7, name: 'The wardrobe', he: 'ארון הבגדים', emoji: '👗', color: '#ff8a8a', ready: true },
  { n: 8, name: 'Dance party', he: 'מסיבת ריקודים', emoji: '🪩', color: '#c89bff', ready: true },
  { n: 9, name: 'Weather', he: 'מזג אוויר', emoji: '🌈', color: '#8fd3ff', ready: true },
  { n: 10, name: 'The zoo', he: 'גן החיות', emoji: '🦁', color: '#ffd23f', ready: true },
  { n: 11, name: 'Ninja park', he: 'פארק הנינג׳ה', emoji: '🥷', color: '#6e7bf2', ready: true },
  { n: 12, name: 'The big show', he: 'ההופעה הגדולה', emoji: '🎤', color: '#ffc83a', ready: true },
];
export const worldInfo = (n: number): World => WORLDS.find((w) => w.n === n) ?? WORLDS[0];
