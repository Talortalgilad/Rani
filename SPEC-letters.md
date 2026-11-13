# איפיון: "מסע האותיות" — אותיות וצלילים באנגלית, בתוך "ההרפתקאות של צ'יזי"

> תוספת ל-`SPEC-english.md`. שמור בשורש הפרויקט בשם `SPEC-letters.md`.
> פרומפט ראשון:
> **"קרא את SPEC-english.md ו-SPEC-letters.md. צור ענף `letters-stage0` מ-main, בנה את שלב 0 בלבד ועצור כדי שאבדוק. אל תמזג."**

---

## 1. הרעיון

מסע שני בתוך משחק האנגלית, ליד מסע המילים: רני לומדת את **26 האותיות**, **את הצליל של כל אחת** (phonics), איך **כותבים** אותה עם האצבע, ובסוף **מחברת צלילים למילים קצרות** (c-a-t ← cat).

**למה צלילים ולא רק שמות:** "ה-S עושה סססס" זה מה שמאפשר לקרוא אחר כך. שם האות ("אֶס") לבד לא עוזר לקרוא מילה. לכן כל אות נלמדת עם **שם + צליל + מילה** (S, /s/, sun).

**למה לא לפי סדר הא"ב:** הסדר הוא לפי שיטת phonics מקובלת (s, a, t, p, i, n...). אחרי 4 האותיות הראשונות כבר אפשר לבנות מילים אמיתיות (sat, tap, pat), וזה נותן תחושת הצלחה מוקדמת.

**אותו משחק, אותו צ'יזי:** אותו עיצוב, אותם כוכבים, אותה חזרה מרווחת ואותו אולפן הקלטה. במפה יש בחירה בין **"מילים"** ל**"אותיות"**.

---

## 2. המסע: 6 איים

| אי | אותיות | מילים לבנייה בסוף האי | נושא האי |
|---|---|---|---|
| 1 | s, a, t, p | sat, tap, pat, sap | אי החול 🏝️ |
| 2 | i, n, m, d | pin, tin, man, dad, sit, mat | אי הירח 🌙 |
| 3 | g, o, c, k | dog, cat, cot, pot, dig, kit | אי היער 🌲 |
| 4 | e, u, r, h, b | bed, bus, sun, hen, red, hut, cub | אי הקשת 🌈 |
| 5 | f, l, j, v, w | fun, leg, jam, van, web, fig | אי הפרחים 🌸 |
| 6 | x, y, z, q | fox, box, yes, zip, quiz | אי הכוכבים ⭐ |

- כל אי: תחנה אחת לכל אות, ואחריה **"תחנת מילים"** של בניית מילים מהאותיות של האי ומהאיים הקודמים.
- **בסוף כל אי** מצילים **סקווישי-אות**: אות רכה וחמודה עם פרצוף (הצבע של האי). כל ששת הסקווישים מצטרפים למדף בקטגוריה משלהם.
- **בסוף המסע:** "שיר ה-ABC" הגדול, כשכל האותיות שנאספו רוקדות על הבמה.

---

## 3. מה יש בכל תחנת אות (5–6 משימות)

| # | משימה | מה קורה | למה |
|---|---|---|---|
| 1 | **הכירי את האות** | קלף מתהפך: אות גדולה (S s), התמונה של המילה (sun). צ'יזי: "This is S! S says /s/, like **s**un!", ובעברית: "זו האות S. היא עושה סססס". | שם + צליל + מילה |
| 2 | **כתבי עם האצבע** | האות גדולה במסך עם נקודות וחיצים לפי סדר הקווים. רני עוקבת עם האצבע, והקו נצבע. 3 פעמים: עם חיצים, עם נקודות בלבד, ואז אות מטושטשת. | כתיבה, וכיוון שמאל ← ימין |
| 3 | **מה הצליל?** | שומעים /s/, ומקישים על האות הנכונה מבין 3 אותיות. | צליל ← אות |
| 4 | **במה זה מתחיל?** | "What starts with /s/?" מקישים על התמונה הנכונה מבין 3 (sun / cat / bed). | שמיעת הצליל הראשון |
| 5 | **גדולה וקטנה** | גוררים כל אות גדולה לקטנה שלה (S ← s, A ← a). | זיהוי שתי הצורות |
| 6 | **ציד אותיות** | "Find all the S!" מקישים על כל ה-S בסצנה מלאה באותיות מעורבבות (רק מהאותיות שנלמדו). | זיהוי מהיר |

### 3.1 כתיבה עם האצבע (החלק הכי חשוב טכנית)
- לכל אות, גדולה וקטנה, יש הגדרה של **קווים לפי הסדר**: מסלולים כנקודות, עם כיוון. נשמר ב-`content/strokes.ts`.
- **הצלחה בקו:** האצבע עוברת קרוב מספיק (עד 12% מגובה האות) לפחות ב-80% מנקודות המסלול, **בכיוון הנכון**, ובסדר הנכון.
- **סלחני:** רעידות וסטייה קטנה בסדר. אם קו נכשל, מראים שוב את החץ שלו באנימציה, בלי עונש.
- **מתחילים מאותיות קטנות** (כמו בבית הספר), והגדולה מופיעה אחרי זה.
- הקו של רני נראה כמו טוש עבה בצבע של האי, ובסוף האות מנצנצת וקופצת.
- בדיקות יחידה: עקיבה מושלמת, עקיבה רועדת, כיוון הפוך (נכשל), דילוג על קו (נכשל).

### 3.2 בניית מילים ("תחנת מילים" בסוף כל אי)
- **שמיעה ובנייה:** "Let's build **cat**!" מופיעים 3 מקומות ריקים ואותיות לגרירה. כל אות שנגררת משמיעה את הצליל שלה.
- **חיבור צלילים:** אחרי שהמילה שלמה, צ'יזי "מחליק" עליה: /c/ - /a/ - /t/ ← **cat!**, והתמונה של החתול קופצת.
- **קריאה ראשונה:** מילה כתובה ו-3 תמונות. רני מקישה על אות כדי לשמוע את הצליל שלה, ואז בוחרת תמונה.
- **מתחילים מאות חסרה אחת** (_at ← cat), ורק אחר כך מילה שלמה.

### 3.3 קשיים של דוברי עברית (טיפול מכוון)
- **כיוון:** כל המשימות עם חץ קטן שמאל ← ימין, ובבנייה המקום הראשון תמיד משמאל.
- **b ו-d:** אחרי שתיהן נלמדו, תחנת חזרה מיוחדת עם רמז ויזואלי (b עם "בטן" קדימה, d עם "גב"). חזרה תכופה יותר.
- **אותיות שאין בעברית** (w, th לא נכנס, q/qu): הסבר בעברית מצ'יזי והדגמה.
- **תנועות קצרות** (a, e, i, o, u): כל אחת עם מילה ברורה מאוד, ובחזרות יותר תכופות.

---

## 4. קול

- **שמות אותיות** ("ess", "ay"): ה-TTS האנגלי של הטלפון מבטא אותם טוב.
- **צלילי אותיות (/s/, /m/):** ה-TTS **לא יודע** לבטא צליל בודד, וזה קריטי. לכן:
  - **מסלול חדש באולפן ההקלטה: "צלילי אותיות"** (26 קליפים + qu). לכל צליל האולפן משמיע את מילת הדוגמה ("sun") ומציג הוראה: "תגיד רק את הצליל הראשון: סססס". אפשר להקליט, לשמוע ולהקליט שוב, כמו במסלולים האחרים.
  - **גיבוי עד שמקליטים:** TTS אומר "s... sun" (האות ואחריה המילה), כדי שלפחות יישמע הצליל בתחילת המילה.
- **משפטי צ'יזי בעברית** (הסברים ועידוד) נכנסים ל-`he-lines.csv` ולמסלול "חשוב" באולפן, כמו שאר המשפטים.
- **מילים באנגלית** ב-TTS, כמו במסע המילים.

---

## 5. תמונות

**מילת דוגמה לכל אות** (מהתמונות הקיימות, כשאפשר):

| a apple | b ball | c cat | d dog | e egg | f fish | g gift | h hat | i **igloo** |
|---|---|---|---|---|---|---|---|---|
| **j jam** | k kite | l lion | m monkey | **n nest** | **o octopus** | p pizza | **q queen** | r rabbit |
| s sun | t tree | u umbrella | **v van** | **w web** | **x fox** | **y yo-yo** | **z zebra** | |

**מילים לבנייה שחסרות להן תמונה:** pig, hen, bus, cup, map, net, mug, bat (העטלף).

**סך הכל צריך 2 גיליונות חדשים ב-Gemini** (בסוף המסמך). את המילים הקיימות לוקחים מ-`public/english/words/`.

**האותיות עצמן:** בגופן Fredoka (כבר בפרויקט), גדולות מאוד, עם אפקט "צעצוע" ב-CSS (גרדיאנט, ברק עליון, צל רך ועובי). כך הצורה מדויקת תמיד, ויש גם גדולה וגם קטנה. **לא מייצרים אותיות ב-Gemini**, כי מודלים של תמונות טועים בצורות של אותיות.

**סקווישי-אות** (6, אחד לכל אי): גיליון שלישי ב-Gemini (בסוף), ואם הוא לא יוצא טוב, אפשר אותיות Fredoka עם פרצוף של צ'יזי ב-CSS.

---

## 6. חיבור למשחק

- **במפה:** בורר "מילים | אותיות" למעלה. כל מסע עם התקדמות משלו. מסע האותיות פתוח מההתחלה, ולא דורש לסיים את מסע המילים.
- **חזרה מרווחת:** כל אות היא "פריט" ב-`progress.ts` (צליל, צורה, כתיבה), באותו מנגנון Leitner.
- **ספר המילים:** עמוד חדש "האותיות שלי". 26 אותיות, כשאלה שנלמדו צבעוניות. הקשה משמיעה שם + צליל + מילה.
- **שער של משחקים אחרים:** אפשרות חדשה באזור ההורים, "אותיות", עם שאלה כמו "Which letter says /m/?", רק מאותיות שנלמדו.
- **כוכבים:** כמו בכל תחנה.
- **אזור ההורים:** אותיות שנלמדו, אותיות שמתבלבלים בהן (למשל b/d), והתקדמות בכתיבה.

---

## 7. מבנה טכני

```
src/games/english/letters/
├─ journey.ts       ← 6 איים, סדר האותיות, מילים לבנייה
├─ strokes.ts       ← קווים לפי סדר לכל אות, גדולה וקטנה
├─ trace.ts         ← זיהוי עקיבה (בלי DOM, עם בדיקות)
├─ blend.ts         ← חיבור צלילים למילה
├─ tasks/           ← meet, trace, sound, first-sound, case-match, hunt, build, read
└─ ui/  map-letters.ts  letter-card.ts  letters.css
```

---

## 8. שלבי בנייה

### שלב 0: פרוסה
- **אי 1 מלא** (s, a, t, p), כולל כל 6 המשימות לכל אות, תחנת המילים (sat, tap, pat), וסקווישי-אות ראשון.
- **כתיבה עם האצבע**, עם בדיקות.
- **מסלול "צלילי אותיות" באולפן ההקלטה**, ו-TTS כגיבוי.
- בורר "מילים | אותיות" במפה.
- **מסירה:** צילום של כל משימה, GIF של כתיבת s (כולל סטייה שמצליחה וכיוון הפוך שנכשל), ו-GIF של בניית "sat". עצור.

### שלב 1: כל האיים
- איים 2–6, תחנת חזרה b/d, והתמונות החדשות (אחרי שטל מעלה את הגיליונות).

### שלב 2: חיבור וליטוש
- "האותיות שלי" בספר המילים, שאלות אותיות בשער, סטטיסטיקה באזור ההורים, ושיר ה-ABC בסוף המסע.

---

## 9. קריטריוני קבלה

- [ ] כל אות נלמדת עם שם, צליל ומילה, והצליל מושמע (מוקלט, או גיבוי TTS).
- [ ] עקיבה רועדת של ילדה מצליחה. כיוון הפוך או דילוג על קו לא מצליחים.
- [ ] אחרי אי 1 אפשר לבנות ולשמוע 3 מילים אמיתיות.
- [ ] האותיות תמיד בצורה מדויקת (גופן, לא תמונה).
- [ ] אין שינוי במסע המילים הקיים, מלבד הבורר במפה ותוספות למדף, לספר ולאזור ההורים.

---

## נספח: פרומפטים ל-Gemini (שיחה חדשה לכל אחד, מצרפים את `sheet-01-room.jpg`)

**גיליון L1 → `sheet-13-letters-a.jpg`**
```
Create an image: Use the exact same art style, lighting, materials, shadows and camera angle as the attached image. A 3x3 grid of 9 separate cute objects for a children's learning game, each object centered in its own cell with generous empty space around it. Style: high-quality 3D render, soft rounded shapes, glossy toy-like materials, slightly chubby and friendly proportions, vibrant saturated colors, soft studio lighting from the top-left, subtle soft shadow directly under each object. Pure flat white background (#FFFFFF) everywhere, no floor, no gradient, no borders, no grid lines, no text, no letters, no numbers, no watermark. Each object is complete and fully visible, not cropped, not touching other objects, all at a similar size, viewed from a slight 3/4 front angle. Square 1:1 image.

Objects, left to right, top to bottom: an igloo, a jar of strawberry jam, a bird nest with eggs, a cute octopus, a queen (cute cartoon character with a crown, full body), a small van, a spider web (with a tiny cute spider), a cute fox, a yo-yo.
```

**גיליון L2 → `sheet-14-letters-b.jpg`**
```
Create an image: Use the exact same art style, lighting, materials, shadows and camera angle as the attached image. A 3x3 grid of 9 separate cute objects for a children's learning game, each object centered in its own cell with generous empty space around it. Style: high-quality 3D render, soft rounded shapes, glossy toy-like materials, slightly chubby and friendly proportions, vibrant saturated colors, soft studio lighting from the top-left, subtle soft shadow directly under each object. Pure flat white background (#FFFFFF) everywhere, no floor, no gradient, no borders, no grid lines, no text, no letters, no numbers, no watermark. Each object is complete and fully visible, not cropped, not touching other objects, all at a similar size, viewed from a slight 3/4 front angle. Square 1:1 image.

Objects, left to right, top to bottom: a cute zebra, a cute pink pig, a cute hen, a yellow school bus, a cup, a folded treasure map, a butterfly net, a mug, a cute bat (the animal).
```

**גיליון L3, סקווישי-אות (רשות) → `sheet-15-letter-squishies.jpg`**
מצרפים את `sheet-01-room.jpg` ואת `cheesy-sheet.jpg`. **בדקו שכל אות יצאה בצורה הנכונה.** אם לא, מוותרים, והאותיות ייעשו ב-CSS.
```
Create an image: Same squishy toy style as the cheese character in the attached image. A 3x2 grid (3 columns, 2 rows) of 6 cute squishy toys, each shaped exactly like a single uppercase English letter, with big shiny eyes and rosy cheeks on the letter. Left to right, top to bottom: the letter S in sandy yellow, the letter M in moon silver-blue, the letter G in forest green, the letter R in rainbow colors, the letter F in flower pink, the letter Z in starry purple. Each letter must be shaped correctly and clearly readable. Pure flat white background (#FFFFFF), soft shadow under each, no other text. Square 1:1 image.
```
