# המשחקים של רני

אפליקציית משחקים (PWA) בלי פרסומות. לפני כל משחק רני פותרת כמה תרגילי חשבון קצרים. האיפיון המלא ב-`SPEC.md`.

## פיתוח

```bash
npm install
npm run dev      # http://localhost:5173/Rani/
npm test         # בדיקות יחידה (Vitest)
npm run build    # בנייה ל-dist/
npm run preview  # בדיקה של הבנייה, כולל Service Worker
```

הכתובת הבסיסית היא `/Rani/` (ב-`vite.config.ts`), כי זו הכתובת ב-GitHub Pages. אם שם הריפו ישתנה, צריך לשנות שם את `base`.

## פריסה ל-GitHub Pages

1. **Settings ← Pages ← Source: GitHub Actions.**
2. מיזוג ל-`main` (ראו למטה). כל push ל-`main` בונה ומפרסם דרך `.github/workflows/deploy.yml`.
3. הכתובת: https://talortalgilad.github.io/Rani/

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
