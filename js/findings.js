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
  volumeCm3: null,                  // נפח המושבה (סמ"ק)
  holes: null,                      // מספר החורים (צדפות) שנספרו באלמוג
  day: { time: '12:45–13:33', tested: null, active: null },   // כמה נבדקו בפלואורסצאין, כמה מהן פעילות
  night: { time: '', tested: null, active: null },
  lightLux: null, light: '', en_light: '',          // כמות האור: מדידה בלוקס ו/או תיאור (חשוף / מוצל)
  substrate: '', en_substrate: '',                  // סוג הקרקע סביב האלמוג
  current: '', en_current: '',                      // חשיפה לזרם: נמוכה / בינונית / גבוהה
  burrows: '', en_burrows: '',                      // איפה החורים על המושבה (צמרת, צדדים, בסיס)
  notes: '', en_notes: '',
  lightLevel: null,      // 1 מואר, 2 מואר חלקית, 3 מוצל
  colorHex: '',          // צבע המושבה כפי שנראה בתמונות
  photos: [],            // [{ src: 'assets/photos/c1-1.jpg', caption: '' }]
  model3d: '',           // המודל הפוטוגרמטרי: קובץ ‎.glb בתיקיית assets/models, או קישור Sketchfab
});

// תמונות: assets/photos/<מצוף>-<מספר>.jpg (וגרסה קטנה עם ‎-s). Photos for each coral.
// captions: { מספר: ['כיתוב', 'caption'] }
const shots = (key, n, captions = {}) =>
  Array.from({ length: n }, (_, i) => ({ src: `assets/photos/${key}-${i + 1}.jpg`, caption: (captions[i + 1] || [])[0] || '', en_caption: (captions[i + 1] || [])[1] || '' }));
const range = (a, b, text) => Object.fromEntries(Array.from({ length: b - a + 1 }, (_, i) => [a + i, text]));

// שטח הפנים מוערך מגודל הייחוס (ס״מ, מול אצבע), בקירוב של כיפה: π·d²/2.
// Surface area estimated from the reference size (cm, against a finger), as a dome: π·d²/2.
const dome = (d) => Math.round((Math.PI * d * d) / 2);
// נפח מוערך באותו קירוב (חצי כדור בקוטר d): π·d³/12. Volume, same dome: π·d³/12.
const domeVol = (d) => Math.round((Math.PI * d * d * d) / 12);

// תאורה כפי שנרשמה בלוח: 1 = מואר, 2 = מואר חלקית, 3 = מוצל
const LIGHT = {
  1: ['מואר', 'Lit'],
  2: ['מואר חלקית', 'Partly lit'],
  3: ['מוצל', 'Shaded'],
};
const light = (k) => ({ lightLevel: k, light: LIGHT[k][0], en_light: LIGHT[k][1] });

export const CORALS = [
  // צמד צפון: רועי וגאיה — דולפין, תמנון, צב
  {
    ...empty('c1', 'dolphin', 'north'), found: true,
    lat: [29, 30.085], lon: [34, 55.047], depth: 5.9,
    form: 'מסיבי, דמוי מוח (מאנדרואידי), מושבה קטנה', en_form: 'Massive, brain-like (meandroid), a small colony',
    color: 'קרם בהיר', en_color: 'Pale cream', colorHex: '#8F8D83',
    sizeCm: [8, null, null], surfaceCm2: dome(8), volumeCm3: domeVol(8),
    holes: 16, day: { time: '12:45–13:33', tested: 12, active: 7 }, night: { time: '17:30–18:06', tested: 12, active: 8 },
    ...light(2),
    substrate: 'מדרון שונית סלעי, עם דרדרת ואצות שטיח', en_substrate: 'Rocky reef slope with rubble and turf algae',
    notes: 'גודל ייחוס כ־8 ס״מ (מול אצבע). בלוח נרשם אזימוט 120°.',
    en_notes: 'Reference size about 8 cm (against a finger). The slate records a bearing of 120°.',
    cover: 7,          // התמונה בכרטיס
    photos: shots('dolphin', 29),
    model3d: 'assets/models/dolphin.glb',
  },
  {
    ...empty('c2', 'octopus', 'north'), found: true,
    lat: [29, 30.086], lon: [34, 55.046], depth: 5.2,
    form: 'מסיבי, דמוי מוח, מוארך ומפותל', en_form: 'Massive, brain-like, elongated and winding',
    color: 'קרם־בז׳', en_color: 'Cream-beige', colorHex: '#938E7F',
    sizeCm: [15, null, null], surfaceCm2: dome(15), volumeCm3: domeVol(15),
    holes: 20, day: { time: '12:45–13:33', tested: 20, active: 14 }, night: { time: '17:30–18:06', tested: 16, active: 9 },
    ...light(1),
    substrate: 'סלע שונית עם ספוגים כתומים מצפים', en_substrate: 'Reef rock with orange encrusting sponges',
    notes: 'גודל ייחוס כ־15 ס״מ. בלוח נרשם אזימוט 120°.',
    en_notes: 'Reference size about 15 cm. The slate records a bearing of 120°.',
    cover: 9,          // התמונה בכרטיס
    photos: shots('octopus', 27),
    model3d: 'assets/models/octopus.glb',
  },
  {
    ...empty('c3', 'turtle', 'north'), found: true,
    lat: [29, 30.093], lon: [34, 55.051], depth: 4.7,
    form: 'מסיבי, אונות מפותלות, מושבה גדולה', en_form: 'Massive with winding lobes, a large colony',
    color: 'חום־צהבהב (אוקר)', en_color: 'Tan-ochre', colorHex: '#887E6D',
    sizeCm: [20, null, null], surfaceCm2: dome(20), volumeCm3: domeVol(20),
    holes: 46, day: { time: '12:45–13:33', tested: 31, active: 19 }, night: { time: '17:30–18:06', tested: 30, active: 18 },
    ...light(1),
    substrate: 'משטח חול ודרדרת בין סלעים', en_substrate: 'Sand and rubble flat between rocks',
    notes: 'גודל ייחוס כ־20 ס״מ. בלוח נרשם אזימוט 130°.',
    en_notes: 'Reference size about 20 cm. The slate records a bearing of 130°.',
    cover: 10,          // התמונה בכרטיס
    photos: shots('turtle', 69, { ...range(34, 53, ['בדיקת פלואורסצאין', 'Fluorescein test']), ...range(54, 55, ['המצוף מעל האלמוג', 'The float above the coral']) }),
    model3d: '',
  },
  // צמד דרום: מוריה ונעמה — לוויתן, דג ליצן
  {
    ...empty('c4', 'whale', 'south'), found: true,
    lat: [29, 30.084], lon: [34, 55.044], depth: 8,
    form: 'מסיבי, דמוי מוח, אונות עגולות', en_form: 'Massive, brain-like, rounded lobes',
    color: 'צהוב־קרם', en_color: 'Yellow-cream', colorHex: '#8A958A',
    sizeCm: [15, null, null], surfaceCm2: dome(15), volumeCm3: domeVol(15),
    holes: 33, day: { time: '12:45–13:33', tested: 11, active: 7 }, night: { time: '17:30–18:06', tested: 11, active: 6 },
    ...light(1),
    substrate: 'משטח דרדרת וחול', en_substrate: 'Rubble and sand flat',
    notes: 'גודל ייחוס כ־15 ס״מ.',
    en_notes: 'Reference size about 15 cm.',
    cover: 13,          // התמונה בכרטיס
    photos: shots('whale', 14),
    model3d: '',
  },
  {
    ...empty('c5', 'clownfish', 'south'), found: true,
    lat: [29, 30.084], lon: [34, 55.045], depth: 5.8,
    form: 'מסיבי, דמוי מוח, שתי אונות', en_form: 'Massive, brain-like, two lobes',
    color: 'צהוב־קרם', en_color: 'Yellow-cream', colorHex: '#A3A08D',
    sizeCm: [23, null, null], surfaceCm2: dome(23), volumeCm3: domeVol(23),
    holes: 36, day: { time: '12:45–13:33', tested: 11, active: 8 }, night: { time: '17:30–18:06', tested: 8, active: 3 },
    ...light(1),
    substrate: 'סלע שונית עם ספוגים כתומים, ליד אלמוגים מסתעפים', en_substrate: 'Reef rock with orange sponges, next to branching corals',
    notes: 'גודל ייחוס כ־23 ס״מ.',
    en_notes: 'Reference size about 23 cm.',
    cover: 6,          // התמונה בכרטיס
    photos: shots('clownfish', 10),
    model3d: '',
  },
];

// המצוף שלא היה בשימוש. The float that was not used.
export const UNUSED_FLOATS = ['shark'];

// תמונות הצוות. Team photos (assets/photos/teamN-*, teamS-*).
export const TEAM_PHOTOS = {
  north: shots('teamN', 24),
  south: shots('teamS', 25),
};

// מסקנות, אחרי ניתוח הנתונים. Conclusions, after the analysis.
// מסקנות ראשונות מצלילת היום. יעודכנו אחרי צלילת הלילה.
// First conclusions from the day dive. To be updated after the night dive.
export const CONCLUSIONS = {
  he: [
    'מצאנו וסימנו חמישה אלמוגים עם צדפות קודחות, כולם מושבות מסיביות דמויות מוח, בעומק 4.7–8 מ׳.',
    'ספרנו 151 חורים. ביום 55 מתוך 85 הצדפות שנבדקו היו פעילות (65%), ובלילה 44 מתוך 77 (57%).',
    'בשלושה אלמוגים הפעילות בלילה הייתה נמוכה מביום: דג הליצן (73% ← 38%), התמנון (70% ← 56%) והלוויתן (64% ← 55%). בצב כמעט ללא שינוי (61% ← 60%), ורק בדולפין הפעילות עלתה בלילה (58% ← 67%).',
    'הדולפין, האלמוג היחיד במקום מואר חלקית, היה בעל הפעילות הנמוכה ביותר ביום והיחיד שהפעילות בו עלתה בלילה. ייתכן שאור משפיע על הצדפות, אבל עם חמישה אלמוגים זה כיוון לבדיקה ולא מסקנה.',
    'הצפיפות הגבוהה ביותר הייתה במושבה הקטנה ביותר, הדולפין: כ־16 חורים ל־100 סמ״ר, לעומת 4–9 במושבות הגדולות.',
  ],
  en: [
    'We found and marked five corals with boring bivalves, all massive brain-like colonies, 4.7–8 m deep.',
    'We counted 151 holes. By day 55 of the 85 bivalves tested were active (65%), and at night 44 of 77 (57%).',
    'On three corals activity was lower at night than by day: the clownfish (73% → 38%), the octopus (70% → 56%) and the whale (64% → 55%). The turtle barely changed (61% → 60%), and only the dolphin was more active at night (58% → 67%).',
    'The dolphin, the only coral in a partly lit spot, had the lowest day activity and was the only one more active at night. Light may affect the bivalves, but with five corals this is a lead to check, not a conclusion.',
    'The densest colony was the smallest one, the dolphin: about 16 holes per 100 cm², against 4–9 on the larger colonies.',
  ],
};

// מה למדנו על סימון קצר־טווח מתחת למים ועל עבודה עם יצורים חיים
// What we learned about short-term underwater marking and working with live organisms
export const LESSONS = {
  he: [
    'המצופים עם הסטיקלייט והמחזירים החזיקו כחמש שעות במים, מצלילת היום ועד סוף צלילת הלילה, ומצאנו בלילה את כל חמשת האלמוגים.',
    'החיה על כל מצוף אפשרה לזהות בלילה בלי ספק לאיזה אלמוג הגענו, גם כשארבעה מהם היו במרחק של מטרים ספורים זה מזה.',
    'מצוף קשור לאבן ליד המושבה, ולא אליה, השאיר את האלמוג בלי מגע ובלי הצללה.',
    'בדיקת הפלואורסצאין דורשת סבלנות: בלילה בדקנו בדג הליצן רק 8 צדפות, פחות מהמספר שתכננו (12). כדאי לתכנן זמן לכל אלמוג ולבדוק קודם את המושבות הגדולות.',
    'הנ.צ. מהשנירקול מדויקים לכמה מטרים בלבד. כדאי לרשום מתחת למים גם אזימוט ומרחק מנקודת היציאה, כגיבוי.',
    'לפוטוגרמטריה של אלמוגי מוח: 30–40 תמונות במעגל סביב המושבה בחפיפה גדולה, ועוד כמה מלמעלה, ממרחק קבוע ועם עצם בולט ליד המושבה. לא נוגעים באלמוג ולא מעלים חול.',
  ],
  en: [
    'The floats with light sticks and reflectors lasted about five hours in the water, from the day dive to the end of the night dive, and we found all five corals at night.',
    'The animal on each float let us tell at night, without doubt, which coral we had reached, even though four of them were only a few metres apart.',
    'Tying the float to a stone next to the colony, not to the colony itself, left the coral untouched and unshaded.',
    'The fluorescein test takes patience: at night we tested only 8 bivalves on the clownfish coral, fewer than planned (12). Plan time for each coral and test the large colonies first.',
    'Snorkel GPS positions are accurate to a few metres only. Also write down a bearing and distance from the start point under water, as a backup.',
    'For photogrammetry of brain corals: 30–40 photos in a circle around the colony with plenty of overlap, plus a few from above, at a steady distance and with a clear object next to the colony. Never touch the coral or stir up sand.',
  ],
};

// מועדי הצלילות. Dive times.
export const SCHEDULE = {
  date: '',            // למשל '2026-10-28'
  dayDive: '12:45',    dayMinutes: 48,
  snorkel: '',         // אחרי צלילת היום
  nightDive: '17:30',  nightMinutes: 36,
  sunset: '',
};
