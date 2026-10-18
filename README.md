# המשחקים של רני

אפליקציית משחקים (PWA) בלי פרסומות. לפני כל משחק רני פותרת כמה תרגילי חשבון קצרים. האיפיון המלא ב-`SPEC.md`.

## פיתוח

```bash
npm install
npm run dev      # http://localhost:5173/
npm test         # בדיקות יחידה (Vitest)
npm run build    # בנייה ל-dist/
npm run preview  # בדיקה של הבנייה, כולל Service Worker
```

האפליקציה יושבת בשורש הדומיין (`base: '/'` ב-`vite.config.ts`).

## פריסה ל-Vercel

1. ב-Vercel: **Add New ← Project**, ובוחרים את הריפו `Rani`.
2. Framework Preset: **Vite**. Build Command: `npm run build`. Output Directory: `dist`. (זה ברירת המחדל, אין צורך לשנות.)
3. **Production Branch**: `main` (ב-Settings ← Git). כל push אליו מפרסם גרסה חדשה. ענפים אחרים מקבלים כתובת תצוגה מקדימה.
4. `vercel.json` מגדיר `Cache-Control: no-cache` ל-`sw.js` ול-`manifest.webmanifest`, כדי שהאפליקציה המותקנת תבדוק עדכונים בכל פתיחה. ה-Service Worker מוגדר `autoUpdate`, ולכן גרסה חדשה נטענת בעצמה, והיא פעילה בפתיחה הבאה של האפליקציה.

## התקנה על הטלפון

פותחים את הכתובת פעם אחת עם אינטרנט, ומשם האפליקציה עובדת גם בלי.

- **אנדרואיד (Chrome):** ⋮ ← "התקנת אפליקציה" (או "הוספה למסך הבית").
- **אייפון (Safari בלבד):** כפתור השיתוף ← "הוספה למסך הבית" ← "הוסף".

## אזור הורים

לחיצה ארוכה (3 שניות) על הכותרת "המשחקים של רני", ואז תרגיל כפל.

## הוספת משחק

תיקייה חדשה ב-`src/games/`, שמממשת את `GameModule` (`src/games/types.ts`), ושורה אחת ב-`src/games/registry.ts`.

## אייקונים

`python3 scripts/make-icons.py` (דורש Pillow).
