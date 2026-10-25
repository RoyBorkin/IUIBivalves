// ─────────────────────────────────────────────────────────────
//  המשימה: צוות, מצופים, אזורי חיפוש ושקופיות.
//  The mission: team, floats, search areas and slides.
// ─────────────────────────────────────────────────────────────

export const SITE_URL = 'https://royborkin.github.io/IUIBivalves/';

// שני הצמדים. Each pair swims from the cylinder frame, one north and one south.
export const PAIRS = {
  north: { color: '#17837F', he: { name: 'צמד צפון', people: ['רועי', 'גאיה'] }, en: { name: 'North pair', people: ['Roy', 'Gaia'] } },
  south: { color: '#B86A12', he: { name: 'צמד דרום', people: ['מוריה', 'נעמה'] }, en: { name: 'South pair', people: ['Moriya', 'Naama'] } },
};

// המצופים: חיות ים מגומי עם סטיקלייט ומחזירי אור. The marker floats.
export const FLOATS = {
  shark: { he: 'כריש', en: 'Shark' },
  dolphin: { he: 'דולפין', en: 'Dolphin' },
  clownfish: { he: 'דג ליצן', en: 'Clownfish' },
  octopus: { he: 'תמנון', en: 'Octopus' },
  whale: { he: 'לווייתן', en: 'Whale' },
  turtle: { he: 'צב ים', en: 'Sea turtle' },
};

// אזורי החיפוש סביב המסגרת עם הגליל, במטרים: along = לאורך החוף (חיובי = צפונה),
// across = ניצב לחוף ביחס למסגרת (חיובי = לכיוון המים העמוקים).
export const ZONES = {
  north: { along: [0, 40], across: [-10, 12] },
  south: { along: [-40, 0], across: [-10, 12] },
};

// תמונה מהתיקייה assets/photos, עם כיתוב בעברית ובאנגלית
const ph = (key, n, he = '', en = '') => ({ src: `assets/photos/${key}-${n}.jpg`, caption: he, en_caption: en });
const phs = (key, ns) => ns.map((n) => ph(key, n));
const P = {
  shore: [...phs('teamN', [1, 3, 4]), ...phs('teamS', [2])],
  north: [...phs('teamN', [5, 6, 7]), ph('teamN', 8, 'מצוף הדולפין', 'The dolphin float'), ...phs('teamN', [11, 12, 21, 22, 23])],
  south: phs('teamS', [3, 5, 6, 8, 10, 12, 13, 14, 15, 16, 17]),
  fluor: [...phs('teamS', [19, 20, 21, 22]), ...phs('turtle', [36, 40, 44, 49])],
  mark: [ph('turtle', 54, 'מצוף הצב מעל המושבה', 'The turtle float above the colony'), ph('turtle', 55, 'מצוף הצב', 'The turtle float'), ph('teamN', 8, 'מצוף הדולפין', 'The dolphin float'), ph('teamN', 7)],
  slate: [ph('teamN', 24, 'הלוח של צמד צפון', 'The north pair’s slate')],
};

// כמה צדפות לבדוק בפלואורסצאין: שליש מהחורים, ולפחות 7.
export const TEST_RULE = { fraction: 1 / 3, min: 7 };

/* ═════════════ slides ═════════════
   type: text | groups | cards | steps | diagram | zones | floats | rule | sheet |
         equipment | variables | phase (computed) | summary | coralTable |
         activityChart | densityChart | relations | conclusions | lessons
*/
export const DECKS = {
  he: {
    goal: {
      title: 'מטרת המשימה',
      slides: [
        {
          type: 'diagram', diagram: 'bivalve', title: 'צדפות שקודחות באלמוג חי',
          lead: 'צדפות מהסוג Leiosolenus חיות בתוך השלד של אלמוגים חיים. מבחוץ רואים רק את פתח המחילה, חור קטן בצורת 8, ובו שני סיפונים.',
          bullets: [
            'צדפות הן מסננות: הן שואבות מים דרך סיפון היניקה, מסננות מהם מזון ופולטות אותם דרך סיפון הפליטה.',
            'כל חור במושבה הוא צדפה אחת, ולכן ספירת החורים היא ספירת הצדפות.',
          ],
        },
        {
          type: 'diagram', diagram: 'fluor', title: 'איך יודעים שצדפה פעילה?',
          lead: 'משחררים מעט פלואורסצאין, צבע ניאון לא רעיל, ליד סיפון היניקה. צדפה שמסננת שואבת אותו ופולטת סילון ירוק זוהר מסיפון הפליטה.',
          bullets: [
            'סילון צבע = צדפה חיה ופעילה.',
            'בלילה מאירים בפנס UV, והצבע זוהר ונראה היטב.',
          ],
        },
        {
          type: 'text', title: 'שאלות המחקר',
          lead: 'כמה צדפות קודחות יש בכל מושבה, כמה מהן פעילות ביום וכמה בלילה, ומה משפיע על כך?',
          bullets: [
            'כמות: מספר החורים בכל אלמוג.',
            'צפיפות: מספר החורים ביחס לשטח הפנים של האלמוג.',
            'פעילות: אחוז הצדפות הפעילות ביום ובלילה, באותן מושבות.',
            'גורמים אפשריים: סוג האלמוג וצבעו, עומק, כמות האור, סוג הקרקע וחשיפה לזרם.',
          ],
        },
        {
          type: 'cards', title: 'מה נדרש מאיתנו',
          cards: [
            { title: 'לאתר ולסמן', text: 'לפחות 3 מושבות אלמוגים עם צדפות קודחות, ובכל אחת לפחות 7 צדפות.' },
            { title: 'לכמת צפיפות', text: 'כמה צדפות יש בכל מושבה ביחס לגודל שלה.' },
            { title: 'ביום ובלילה', text: 'כמה מהצדפות פעילות, והאם יש הבדל בין היום ללילה.' },
            { title: 'מגמות נוספות', text: 'איפה המחילות על המושבה, האם אלמוגים נגועים מתקבצים, ולאן מתפזר הסילון.' },
          ],
        },
        {
          type: 'variables', title: 'מה נמדוד בכל אלמוג',
          rows: [
            ['מספר חורים', 'ספירה ישירה על המושבה, ובדיקה בתמונות', 'חורים'],
            ['שטח פנים', 'מודל תלת־ממדי בפוטוגרמטריה, עם מידת ייחוס', 'סמ"ר'],
            ['צפיפות', 'מספר החורים חלקי שטח הפנים', 'חורים ל־100 סמ"ר'],
            ['פעילות', 'בדיקת פלואורסצאין לשליש מהחורים, לפחות 7', '% פעילות'],
            ['סוג וצבע האלמוג', 'זיהוי ותמונה עם כרטיס צבע', ''],
            ['עומק', 'מחשב צלילה', 'מטר'],
            ['אור', 'חשוף או מוצל, שעה ועננות, ואם יש, מד אור', 'לוקס'],
            ['קרקע וזרם', 'תיאור הקרקע, וכיוון וחוזק הזרם לפי סחיפת הצבע', ''],
          ],
        },
      ],
    },
    team: {
      title: 'צוות',
      slides: [
        {
          type: 'groups', title: 'שני צמדים',
          lead: 'אנחנו ארבעה, ומתחלקים לשני צמדים. שני הצמדים יורדים במסגרת עם הגליל, בעומק 9 מ׳: צמד אחד שוחה צפונה, והשני דרומה.',
          groups: [
            { pair: 'north', title: 'צמד צפון', sub: 'שוחים צפונה מהמסגרת', members: ['רועי', 'גאיה'] },
            { pair: 'south', title: 'צמד דרום', sub: 'שוחים דרומה מהמסגרת', members: ['מוריה', 'נעמה'] },
          ],
        },
        { type: 'photos', title: 'הכנות על החוף', photos: P.shore },
        { type: 'photos', title: 'צמד צפון במים', lead: 'רועי וגאיה סימנו את הדולפין, התמנון והצב.', photos: P.north },
        { type: 'photos', title: 'צמד דרום במים', lead: 'מוריה ונעמה סימנו את הלוויתן ואת דג הליצן.', photos: P.south },
        {
          type: 'cards', title: 'תפקידים',
          lead: 'רועי ומוריה מנווטים ומודדים אזימוטים במצפן. את שאר המשימות מחלקים בתוך כל צמד.',
          cards: [
            { title: 'ניווט ואזימוטים', text: 'רועי בצמד צפון, מוריה בצמד דרום: אזימוט ומרחק מהמסגרת לכל אלמוג ומאלמוג לאלמוג.' },
            { title: 'ספירה ובדיקה', text: 'ספירת החורים, ובדיקת פלואורסצאין לשליש מהם, לפחות 7.' },
            { title: 'צילום ומדידה', text: 'צילומים לכל אורך המושבה למודל התלת־ממדי, ומידות ייחוס.' },
            { title: 'סימון', text: 'מצוף בצורת חיית ים עם סטיקלייט ומחזירי אור, לפני שעוברים לאלמוג הבא.' },
          ],
        },
        {
          type: 'cards', title: 'בטיחות ועבודה עם יצורים חיים',
          cards: [
            { title: 'ציפה', text: 'ציפה ניטרלית מעל המושבה. לא נוגעים באלמוג ולא נשענים עליו.' },
            { title: 'מיקום', text: 'מתמקמים כך שלא מפריעים לצדפות ולא מעלים חול על המושבה.' },
            { title: 'ציוד', text: 'כל הציוד קשור ובציפה שלילית, כולל המזרק, כדי שלא יברח למעלה.' },
            { title: 'צוללן בטיחות', text: 'בן הזוג שומר בזמן שהשני עובד, ומתחלפים ביניהם.' },
          ],
        },
      ],
    },
    plan: {
      title: 'תכנון המשימה',
      slides: [
        {
          type: 'steps', title: 'סדר המשימה', schedule: true,
          steps: [
            { key: 'dayDive', title: 'צלילת יום', text: 'יורדים במסגרת עם הגליל. כל צמד מוצא 2–3 אלמוגים, מודד, בודק ומסמן.' },
            { key: 'snorkel', title: 'שנירקול', text: 'שוחים מעל כל מצוף ושומרים נ.צ. ב־GPS.' },
            { key: null, title: 'רישום', text: 'מעבירים את הנתונים מהדפים התת־ימיים לטבלה, ומוודאים שכל הסטיקלייטים דולקים.' },
            { key: 'nightDive', title: 'צלילת לילה', text: 'חוזרים לאותם אלמוגים ובודקים שוב את פעילות הצדפות.' },
            { key: null, title: 'איסוף', text: 'אוספים את כל המצופים, האבנים והסטיקלייטים.' },
          ],
        },
        { type: 'zones', title: 'אזורי החיפוש', lead: 'נקודת היציאה היא גליל בקוטר 50 ס״מ במרכז מסגרת של 3 × 3 מ׳, בעומק 9 מ׳, שני שליש מהדרך מהמזח להביטט ועוד 10 מ׳ הלאה מהחוף. צמד צפון מחפש מצפון לה, וצמד דרום מדרום לה, לאורך השונית.' },
        { type: 'floats', title: 'המצופים', lead: 'כל אלמוג מקבל חיה משלו, כדי שבלילה נדע בדיוק לאיזה אלמוג הגענו.' },
        { type: 'rule', title: 'כמה צדפות בודקים', lead: 'בודקים בפלואורסצאין שליש מהחורים. אם שליש יוצא פחות מ־7, בודקים 7.' },
        { type: 'sheet', title: 'דף הרישום התת־ימי', lead: 'דף אחד לכל אלמוג, מוכן מראש עם שם המצוף.' },
        {
          type: 'equipment', title: 'ציוד',
          have: ['מצופי חיות ים עם סטיקלייט ומחזירי אור', 'פלואורסצאין במזרק עם פילטר', 'מצלמה', 'פנס', 'פנס UV', 'דפים תת־ימיים', 'מצפן', 'GPS'],
          add: [
            ['סרגל או מוט קנה מידה', 'מידת ייחוס בתמונות, כדי שלמודל התלת־ממדי יהיה גודל אמיתי'],
            ['כרטיס צבעים', 'כדי לתעד את צבע האלמוג באותה צורה בכל מושבה'],
            ['סרט מדידה', 'למידות האלמוג ולמרחקים בין האלמוגים'],
            ['אבנים או משקולות וחבל', 'לעגן את המצופים ליד האלמוג, לא עליו'],
            ['סטיקלייטים ומזרקים רזרביים', 'סטיקלייט של 12 שעות, ומזרק עם משקולת'],
            ['פנס גיבוי ונצנץ לכל צוללן', 'לצלילת הלילה'],
            ['כיס אטום ל־GPS', 'לשנירקול'],
            ['מצוף סימון (SMB) ושקית רשת', 'לבטיחות על פני המים ולאיסוף המצופים בסוף'],
          ],
        },
        {
          type: 'text', title: 'המלצות',
          bullets: [
            'לבחור רק מושבות עם 7 חורים לפחות. אם יש פחות, ממשיכים לחפש.',
            'לבדוק בלילה את אותם חורים כמו ביום: לרשום את מיקומם לפי כיוון השעון ביחס לאבן העוגן, ולצלם.',
            'לשחרר מעט צבע ליד סיפון היניקה בלי לגעת, ולחכות כמה שניות לסילון. בין בדיקה לבדיקה מחכים שהצבע יתפזר.',
            'לשמור אזימוט ומרחק מהמסגרת לכל אלמוג, כגיבוי ל־GPS שעל פני המים.',
            'למודל התלת־ממדי: הרבה תמונות חופפות סביב המושבה ומעליה, עם סרגל בתמונה.',
            'לתעד אור וזרם באותו אופן בכל אלמוג: חשוף או מוצל, וכיוון סחיפת הצבע.',
          ],
        },
      ],
    },
    day: {
      title: 'צלילת יום ושנירקול',
      slides: [
        {
          type: 'steps', title: 'צלילת היום',
          steps: [
            { title: 'ירידה במסגרת', text: 'שני הצמדים יורדים יחד במסגרת עם הגליל ומתפצלים: צמד צפון צפונה, צמד דרום דרומה.' },
            { title: 'חיפוש', text: 'מחפשים לאורך השונית מושבה עם לפחות 7 חורים בצורת 8.' },
            { title: 'ניווט', text: 'רועי ומוריה מודדים אזימוט ומרחק מהמסגרת, או מהאלמוג הקודם.' },
            { title: 'בדיקה ומדידה', text: 'סופרים חורים, מצלמים, מודדים ובודקים בפלואורסצאין (ראו בשקופית הבאה).' },
            { title: 'סימון', text: 'קושרים את המצוף לאבן ליד המושבה ומפעילים את הסטיקלייט. ממשיכים לאלמוג הבא.' },
          ],
        },
        {
          type: 'steps', title: 'בכל אלמוג',
          steps: [
            { title: 'ספירה', text: 'סופרים את כל החורים במושבה.' },
            { title: 'צילום', text: 'מצלמים סביב המושבה ומעליה, עם סרגל בתמונה, למודל התלת־ממדי. רושמים מידות ייחוס.' },
            { title: 'סביבה', text: 'עומק, סוג וצבע האלמוג, אור, סוג הקרקע וחשיפה לזרם.' },
            { title: 'פלואורסצאין', text: 'בודקים שליש מהחורים, לפחות 7, ורושמים כמה פעילות.' },
            { title: 'סימון', text: 'מצוף בצורת חיית ים, סטיקלייט ומחזירי אור.' },
          ],
        },
        {
          type: 'text', title: 'שנירקול: שמירת נ.צ.',
          lead: 'אחרי הצלילה שוחים מעל המצופים ושומרים את המיקום של כל אלמוג ב־GPS.',
          bullets: [
            'מחזיקים את ה־GPS מעל המים, ישר מעל המצוף, ומחכים שהמיקום יתייצב.',
            'שומרים שתיים־שלוש קריאות לכל מצוף, ורושמים את שם החיה.',
            'מצלמים את המצוף מלמעלה, כדי שיהיה קל לזהות אותו בלילה.',
          ],
        },
        { type: 'photos', title: 'בדיקת פלואורסצאין', lead: 'מזריקים מעט צבע ליד פתח החור ומחכים: צדפה פעילה פולטת סילון ירוק.', photos: P.fluor },
        { type: 'photos', title: 'סימון במצופים', lead: 'כל מצוף קשור לאבן ליד המושבה, עם סטיקלייט ומחזירי אור.', photos: P.mark },
        { type: 'photos', title: 'הלוח התת־ימי', lead: 'כל הנתונים נרשמו מתחת למים על לוח, ומשם עברו לאתר.', photos: P.slate },
        { type: 'foundMap', title: 'איפה מצאנו', lead: 'כל חמשת האלמוגים נמצאו מצפון־מערב למסגרת, לכיוון החוף: ארבעה במרחק 14–16 מ׳ ממנה, והצב כ־27 מ׳ צפונה. המיקומים לפי ה־GPS מהשנירקול.' },
        { type: 'coralCards', title: 'האלמוגים שסימנו', lead: 'לחיצה על כרטיס פותחת את האלמוג במפה, עם המודל, התמונות וכל הנתונים.' },
        { type: 'phase', phase: 'day', title: 'תוצאות היום' },
      ],
    },
    night: {
      title: 'צלילת לילה',
      slides: [
        {
          type: 'text', title: 'למה חוזרים בלילה',
          lead: 'בצלילת הלילה בודקים את אותם אלמוגים ואת אותם חורים, כדי לראות אם הצדפות פעילות יותר, פחות או באותה מידה כמו ביום.',
        },
        {
          type: 'steps', title: 'צלילת הלילה',
          steps: [
            { title: 'ניווט', text: 'יורדים במסגרת ומנווטים לפי האזימוטים והמרחקים שנרשמו ביום.' },
            { title: 'איתור', text: 'מוצאים את המצופים לפי הסטיקלייט, ובאור הפנס לפי מחזירי האור.' },
            { title: 'זיהוי', text: 'מוודאים לפי החיה שזה האלמוג הנכון.' },
            { title: 'בדיקה', text: 'בודקים בפלואורסצאין את אותו מספר חורים, ומאירים בפנס UV כדי לראות את הסילון.' },
            { title: 'איסוף', text: 'בסיום אוספים את המצוף, האבן והסטיקלייט.' },
          ],
        },
        {
          type: 'cards', title: 'בטיחות בלילה',
          cards: [
            { title: 'אורות', text: 'פנס ראשי, פנס גיבוי ונצנץ לכל צוללן.' },
            { title: 'קשר', text: 'מסכמים מראש סימני פנס, ושומרים על בן הזוג בטווח ראייה.' },
            { title: 'ניווט', text: 'מצפן ואזימוטים מהיום. לא מתרחקים מאזור החיפוש.' },
            { title: 'ליד האלמוג', text: 'מאירים לצד ולא ישר על המושבה, כדי להפריע כמה שפחות.' },
          ],
        },
        { type: 'phase', phase: 'night', title: 'תוצאות הלילה' },
      ],
    },
    results: {
      title: 'מסקנות ותוצאות',
      slides: [
        { type: 'summary', title: 'התוצאות במבט אחד' },
        { type: 'coralCards', title: 'כל אלמוג במבט אחד' },
        { type: 'holesChart', title: 'חורים ובדיקות', lead: 'כל פס הוא אלמוג: כמה חורים ספרנו, כמה בדקנו בפלואורסצאין ביום, וכמה מהן היו פעילות.' },
        { type: 'size', title: 'שטח ונפח המושבות', lead: 'כמה גדולה כל מושבה: שטח הפנים שבו הצדפות קודחות, והנפח של המושבה.' },
        { type: 'densities', title: 'חורים וצדפות פעילות ביחס לגודל', lead: 'אותם נתונים, מנורמלים לגודל המושבה: ביחס לשטח הפנים וביחס לנפח.' },
        { type: 'sizeRelations', title: 'גודל המושבה מול מספר הצדפות' },
        { type: 'coralTable', title: 'כל האלמוגים' },
        { type: 'activityChart', title: 'פעילות ביום ובלילה' },
        { type: 'densityChart', title: 'צפיפות הצדפות' },
        { type: 'relations', title: 'מה קשור לצפיפות?' },
        { type: 'conclusions', title: 'מסקנות' },
        { type: 'lessons', title: 'סימון ועבודה עם יצורים חיים' },
      ],
    },
  },
  en: {
    goal: {
      title: 'Mission goal',
      slides: [
        {
          type: 'diagram', diagram: 'bivalve', title: 'Bivalves that bore into live coral',
          lead: 'Bivalves of the genus Leiosolenus live inside the skeleton of live corals. From outside you only see the burrow opening, a small figure-8 hole with two siphons.',
          bullets: [
            'Bivalves are filter feeders: they pull water in through the inhalant siphon, filter food out of it and push it out through the exhalant siphon.',
            'Each hole in the colony is one bivalve, so counting holes means counting bivalves.',
          ],
        },
        {
          type: 'diagram', diagram: 'fluor', title: 'How do we know a bivalve is active?',
          lead: 'We release a little fluorescein, a non-toxic neon dye, next to the inhalant siphon. A bivalve that is filtering draws it in and shoots a glowing green jet out of the exhalant siphon.',
          bullets: [
            'A jet of dye means a live, active bivalve.',
            'At night we light it with a UV torch, and the dye glows clearly.',
          ],
        },
        {
          type: 'text', title: 'Research questions',
          lead: 'How many boring bivalves live in each colony, how many are active by day and by night, and what affects this?',
          bullets: [
            'Count: the number of holes in each coral.',
            'Density: the number of holes relative to the coral’s surface area.',
            'Activity: the share of active bivalves by day and by night, in the same colonies.',
            'Possible factors: coral type and colour, depth, light, seabed type and exposure to current.',
          ],
        },
        {
          type: 'cards', title: 'What we need to do',
          cards: [
            { title: 'Find and mark', text: 'At least 3 coral colonies with boring bivalves, each with at least 7 bivalves.' },
            { title: 'Measure density', text: 'How many bivalves each colony holds relative to its size.' },
            { title: 'Day and night', text: 'How many bivalves are active, and whether day and night differ.' },
            { title: 'Other trends', text: 'Where the burrows sit on the colony, whether infested corals cluster, and where the jet spreads.' },
          ],
        },
        {
          type: 'variables', title: 'What we measure on each coral',
          rows: [
            ['Number of holes', 'Counted on the colony, checked in the photos', 'holes'],
            ['Surface area', '3D photogrammetry model with a reference scale', 'cm²'],
            ['Density', 'Holes divided by surface area', 'holes per 100 cm²'],
            ['Activity', 'Fluorescein test on a third of the holes, at least 7', '% active'],
            ['Coral type and colour', 'Identification and a photo with a colour card', ''],
            ['Depth', 'Dive computer', 'm'],
            ['Light', 'Exposed or shaded, time and cloud cover, and a light meter if we have one', 'lux'],
            ['Seabed and current', 'Seabed description, and current direction and strength from the dye drift', ''],
          ],
        },
      ],
    },
    team: {
      title: 'Team',
      slides: [
        {
          type: 'groups', title: 'Two pairs',
          lead: 'There are four of us, split into two pairs. Both pairs descend at the cylinder frame, 9 m deep: one pair swims north and the other south.',
          groups: [
            { pair: 'north', title: 'North pair', sub: 'Swims north from the frame', members: ['Roy', 'Gaia'] },
            { pair: 'south', title: 'South pair', sub: 'Swims south from the frame', members: ['Moriya', 'Naama'] },
          ],
        },
        { type: 'photos', title: 'Getting ready on the shore', photos: P.shore },
        { type: 'photos', title: 'The north pair in the water', lead: 'Roy and Gaia marked the dolphin, the octopus and the turtle.', photos: P.north },
        { type: 'photos', title: 'The south pair in the water', lead: 'Moriya and Naama marked the whale and the clownfish.', photos: P.south },
        {
          type: 'cards', title: 'Roles',
          lead: 'Roy and Moriya navigate and take compass bearings. Each pair shares the other tasks between its two divers.',
          cards: [
            { title: 'Navigation and bearings', text: 'Roy in the north pair, Moriya in the south pair: bearing and distance from the frame to each coral, and from coral to coral.' },
            { title: 'Counting and testing', text: 'Counting the holes, and the fluorescein test on a third of them, at least 7.' },
            { title: 'Photos and measuring', text: 'Photos all around the colony for the 3D model, and reference measurements.' },
            { title: 'Marking', text: 'A sea-animal float with a light stick and reflectors, before moving to the next coral.' },
          ],
        },
        {
          type: 'cards', title: 'Safety and working with live organisms',
          cards: [
            { title: 'Buoyancy', text: 'Neutral buoyancy above the colony. Never touch or lean on the coral.' },
            { title: 'Position', text: 'Stay where you won’t disturb the bivalves or kick sand onto the colony.' },
            { title: 'Equipment', text: 'Everything is clipped on and negatively buoyant, including the syringe, so nothing floats away.' },
            { title: 'Safety diver', text: 'One buddy watches while the other works, and they swap.' },
          ],
        },
      ],
    },
    plan: {
      title: 'Mission plan',
      slides: [
        {
          type: 'steps', title: 'Order of the mission', schedule: true,
          steps: [
            { key: 'dayDive', title: 'Day dive', text: 'Descend at the cylinder frame. Each pair finds 2–3 corals, measures, tests and marks them.' },
            { key: 'snorkel', title: 'Snorkel', text: 'Swim over each float and save its position on the GPS.' },
            { key: null, title: 'Records', text: 'Copy the data from the slates into the table, and check that every light stick is still glowing.' },
            { key: 'nightDive', title: 'Night dive', text: 'Return to the same corals and test the bivalves’ activity again.' },
            { key: null, title: 'Clean-up', text: 'Collect every float, stone and light stick.' },
          ],
        },
        { type: 'zones', title: 'Search areas', lead: 'The start point is a cylinder 50 cm across in the middle of a 3 × 3 m frame, 9 m deep, two thirds of the way from the pier to the Habitat and 10 m further out. The north pair searches north of it and the south pair south of it, along the reef.' },
        { type: 'floats', title: 'The floats', lead: 'Each coral gets its own animal, so at night we know exactly which coral we reached.' },
        { type: 'rule', title: 'How many bivalves to test', lead: 'We test a third of the holes with fluorescein. If a third comes to fewer than 7, we test 7.' },
        { type: 'sheet', title: 'The underwater data sheet', lead: 'One sheet per coral, prepared in advance with the float’s name.' },
        {
          type: 'equipment', title: 'Equipment',
          have: ['Sea-animal floats with light sticks and reflectors', 'Fluorescein in a syringe with a filter', 'Camera', 'Torch', 'UV torch', 'Underwater slates', 'Compass', 'GPS'],
          add: [
            ['Ruler or scale bar', 'A reference size in the photos, so the 3D model has a true scale'],
            ['Colour card', 'To record each coral’s colour the same way'],
            ['Measuring tape', 'For the coral’s size and the distances between corals'],
            ['Stones or weights and cord', 'To anchor the floats next to the coral, never on it'],
            ['Spare light sticks and syringes', '12-hour light sticks, and a weighted syringe'],
            ['Backup torch and strobe for each diver', 'For the night dive'],
            ['Waterproof GPS pouch', 'For the snorkel'],
            ['Surface marker buoy and mesh bag', 'For safety at the surface and to collect the floats at the end'],
          ],
        },
        {
          type: 'text', title: 'Recommendations',
          bullets: [
            'Only choose colonies with at least 7 holes. With fewer, keep searching.',
            'Test the same holes at night as by day: note their position by clock direction from the anchor stone, and take a photo.',
            'Release a little dye next to the inhalant siphon without touching, and wait a few seconds for the jet. Let the dye clear between tests.',
            'Record a bearing and distance from the frame to each coral, as a backup to the surface GPS.',
            'For the 3D model: many overlapping photos around and above the colony, with a ruler in frame.',
            'Record light and current the same way on every coral: exposed or shaded, and which way the dye drifts.',
          ],
        },
      ],
    },
    day: {
      title: 'Day dive and snorkel',
      slides: [
        {
          type: 'steps', title: 'The day dive',
          steps: [
            { title: 'Descend at the frame', text: 'Both pairs descend together at the cylinder frame and split: the north pair north, the south pair south.' },
            { title: 'Search', text: 'Search along the reef for a colony with at least 7 figure-8 holes.' },
            { title: 'Navigate', text: 'Roy and Moriya take a bearing and distance from the frame, or from the previous coral.' },
            { title: 'Test and measure', text: 'Count holes, take photos, measure and test with fluorescein (see the next slide).' },
            { title: 'Mark', text: 'Tie the float to a stone next to the colony and crack the light stick. Move on to the next coral.' },
          ],
        },
        {
          type: 'steps', title: 'At each coral',
          steps: [
            { title: 'Count', text: 'Count all the holes in the colony.' },
            { title: 'Photograph', text: 'Photos around and above the colony, with a ruler in frame, for the 3D model. Note reference measurements.' },
            { title: 'Surroundings', text: 'Depth, coral type and colour, light, seabed type and exposure to current.' },
            { title: 'Fluorescein', text: 'Test a third of the holes, at least 7, and note how many are active.' },
            { title: 'Mark', text: 'A sea-animal float, a light stick and reflectors.' },
          ],
        },
        {
          type: 'text', title: 'Snorkel: saving positions',
          lead: 'After the dive we swim over the floats and save each coral’s position on the GPS.',
          bullets: [
            'Hold the GPS above the water, right over the float, and wait for the position to settle.',
            'Save two or three readings per float, and note the animal’s name.',
            'Photograph the float from above, so it is easy to recognise at night.',
          ],
        },
        { type: 'photos', title: 'The fluorescein test', lead: 'A little dye goes next to the hole opening, then we wait: an active bivalve sends out a green jet.', photos: P.fluor },
        { type: 'photos', title: 'Marking with floats', lead: 'Each float is tied to a stone next to the colony, with a light stick and reflectors.', photos: P.mark },
        { type: 'photos', title: 'The underwater slate', lead: 'All the data was written on a slate under water, and copied from there into the site.', photos: P.slate },
        { type: 'foundMap', title: 'Where we found them', lead: 'All five corals were north-west of the frame, towards the shore: four 14–16 m from it, and the turtle about 27 m to the north. Positions from the snorkel GPS.' },
        { type: 'coralCards', title: 'The corals we marked', lead: 'Click a card to open the coral on the map, with its model, photos and all its data.' },
        { type: 'phase', phase: 'day', title: 'Day results' },
      ],
    },
    night: {
      title: 'Night dive',
      slides: [
        {
          type: 'text', title: 'Why we go back at night',
          lead: 'On the night dive we test the same corals and the same holes, to see whether the bivalves are more active, less active or the same as by day.',
        },
        {
          type: 'steps', title: 'The night dive',
          steps: [
            { title: 'Navigate', text: 'Descend at the frame and navigate by the bearings and distances recorded by day.' },
            { title: 'Find', text: 'Find the floats by their light sticks, and by the reflectors in the torch beam.' },
            { title: 'Identify', text: 'Check the animal to confirm it is the right coral.' },
            { title: 'Test', text: 'Test the same number of holes with fluorescein, using the UV torch to see the jet.' },
            { title: 'Collect', text: 'When done, collect the float, the stone and the light stick.' },
          ],
        },
        {
          type: 'cards', title: 'Night safety',
          cards: [
            { title: 'Lights', text: 'A main torch, a backup torch and a strobe for each diver.' },
            { title: 'Signals', text: 'Agree on torch signals in advance, and keep your buddy in sight.' },
            { title: 'Navigation', text: 'Compass and the bearings from the day. Stay within the search area.' },
            { title: 'At the coral', text: 'Point the light to the side rather than straight at the colony, to disturb it as little as possible.' },
          ],
        },
        { type: 'phase', phase: 'night', title: 'Night results' },
      ],
    },
    results: {
      title: 'Results and conclusions',
      slides: [
        { type: 'summary', title: 'The results at a glance' },
        { type: 'coralCards', title: 'Each coral at a glance' },
        { type: 'holesChart', title: 'Holes and tests', lead: 'Each bar is one coral: how many holes we counted, how many we tested with fluorescein by day, and how many of those were active.' },
        { type: 'size', title: 'Colony area and volume', lead: 'How big each colony is: the surface the bivalves bore into, and the colony’s volume.' },
        { type: 'densities', title: 'Holes and active bivalves relative to size', lead: 'The same data, scaled to colony size: per surface area and per volume.' },
        { type: 'sizeRelations', title: 'Colony size against bivalve count' },
        { type: 'coralTable', title: 'All the corals' },
        { type: 'activityChart', title: 'Activity by day and by night' },
        { type: 'densityChart', title: 'Bivalve density' },
        { type: 'relations', title: 'What goes with density?' },
        { type: 'conclusions', title: 'Conclusions' },
        { type: 'lessons', title: 'Marking and working with live organisms' },
      ],
    },
  },
};
