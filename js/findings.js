// ─────────────────────────────────────────────────────────────
//  ממצאי המשימה — את הקובץ הזה ממלאים אחרי הצלילות.
//  Mission findings — fill this file in after the dives.
//
//  כל אלמוג מסומן במצוף אחד (float). שדה שעדיין לא נמדד נשאר null או ''.
//  האתר מחשב לבד: צפיפות, אחוז צדפות פעילות ביום ובלילה, והגרפים בשקופיות "מסקנות ותוצאות".
//
//  מיקום: עדיף נ.צ. מה־GPS (lat/lon במעלות עשרוניות, למשל 29.50195, 34.91712,
//  או במעלות ודקות כמו בטבלה: [29, 30.117]). אם אין עדיין GPS, אפשר לתת
//  אזימוט ומרחק מנקודה ידועה: fromPoint: { point: 'camera', bearing: 20, dist: 14 }.
//
//  יחידות: עומק במטרים, מידות האלמוג בס"מ, שטח פנים בסמ"ר (מהמודל הפוטוגרמטרי),
//  אור בלוקס (lux) אם נמדד, ושעות בפורמט '10:40'.
// ─────────────────────────────────────────────────────────────

const empty = (id, float, pair) => ({
  id, float, pair,
  found: false,          // true אחרי שהאלמוג נמצא וסומן
  lat: null, lon: null,  // נ.צ. מהשנירקול עם ה־GPS
  fromPoint: null,       // { point: 'camera', bearing: 0, dist: 0 } כשאין GPS
  depth: null,           // מטר
  species: '', en_species: '',      // סוג האלמוג (למשל Astreopora, Porites)
  form: '', en_form: '',            // צורת גדילה: מסיבי / מסתעף / מתפשט
  color: '', en_color: '',          // צבע האלמוג
  sizeCm: [null, null, null],       // רוחב, אורך, גובה בס"מ
  surfaceCm2: null,                 // שטח פנים מהמודל התלת־ממדי (סמ"ר)
  holes: null,                      // מספר החורים (צדפות) שנספרו באלמוג
  day: { time: '', tested: null, active: null },   // כמה נבדקו בפלואורסצאין, כמה מהן פעילות
  night: { time: '', tested: null, active: null },
  lightLux: null, light: '', en_light: '',          // כמות האור: מדידה בלוקס ו/או תיאור (חשוף / מוצל)
  substrate: '', en_substrate: '',                  // סוג הקרקע סביב האלמוג
  current: '', en_current: '',                      // חשיפה לזרם: נמוכה / בינונית / גבוהה
  burrows: '', en_burrows: '',                      // איפה החורים על המושבה (צמרת, צדדים, בסיס)
  notes: '', en_notes: '',
  photos: [],            // [{ src: 'assets/photos/c1-1.jpg', caption: '' }]
  model3d: '',           // המודל הפוטוגרמטרי: קובץ ‎.glb בתיקיית assets/models, או קישור Sketchfab
});

export const CORALS = [
  // צמד צפון: רועי וגאיה
  empty('c1', 'shark', 'north'),
  empty('c2', 'dolphin', 'north'),
  empty('c3', 'clownfish', 'north'),
  // צמד דרום: מוריה ונעמה
  empty('c4', 'octopus', 'south'),
  empty('c5', 'whale', 'south'),
  empty('c6', 'turtle', 'south'),
];

// מסקנות, אחרי ניתוח הנתונים. Conclusions, after the analysis.
export const CONCLUSIONS = {
  he: [],
  en: [],
};

// מה למדנו על סימון קצר־טווח מתחת למים ועל עבודה עם יצורים חיים
// What we learned about short-term underwater marking and working with live organisms
export const LESSONS = {
  he: [],
  en: [],
};

// מועדי הצלילות. Dive times.
export const SCHEDULE = {
  date: '',          // למשל '2026-10-28'
  dayDive: '',       // למשל '10:00'
  snorkel: '',       // למשל '12:30'
  nightDive: '',     // למשל '19:30'
  sunset: '',        // למשל '17:05'
};
