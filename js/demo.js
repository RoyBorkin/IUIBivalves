// ─────────────────────────────────────────────────────────────
//  נתוני דוגמה בלבד — מוצגים רק עם ‎?demo=1 בכתובת, כדי לראות איך האתר
//  ייראה כשיהיו נתונים. אלה לא נתונים אמיתיים.
//  Sample data only, shown with ?demo=1 to preview the site. Not real data.
// ─────────────────────────────────────────────────────────────
const S = [
  ['c1', 32, 9, 5.2, 'Astreopora', 'מסיבי', 'massive', 'ורוד־בז׳', 'pinkish beige', [38, 30, 18], 1650, 21, 7, 5, 8, 7, 'חשוף', 'exposed', 'בינונית', 'medium', 'דרדרת', 'rubble'],
  ['c2', 48, 18, 4.6, 'Stylophora', 'מסתעף', 'branching', 'קרם', 'cream', [26, 24, 20], 980, 12, 7, 4, 7, 6, 'חשוף', 'exposed', 'גבוהה', 'high', 'שונית', 'reef'],
  ['c3', 40, 27, 6.1, 'Astreopora', 'מסיבי', 'massive', 'סגלגל', 'violet-grey', [52, 41, 24], 2460, 31, 11, 6, 11, 9, 'מוצל חלקית', 'partly shaded', 'נמוכה', 'low', 'חול ודרדרת', 'sand and rubble'],
  ['c4', 212, 11, 4.9, 'Porites', 'מסיבי', 'massive', 'חום־צהבהב', 'yellow-brown', [44, 36, 22], 1890, 16, 7, 3, 7, 6, 'מוצל', 'shaded', 'נמוכה', 'low', 'שונית', 'reef'],
  ['c5', 228, 20, 5.6, 'Astreopora', 'מסיבי', 'massive', 'ורוד', 'pink', [30, 28, 15], 1120, 9, 7, 5, 7, 7, 'חשוף', 'exposed', 'בינונית', 'medium', 'דרדרת', 'rubble'],
];

export function applyDemo(corals) {
  S.forEach(([id, bearing, dist, depth, species, form, enForm, color, enColor, size, area, holes, dT, dA, nT, nA, light, enLight, cur, enCur, sub, enSub]) => {
    const c = corals.find((x) => x.id === id);
    Object.assign(c, {
      found: true, fromPoint: { point: 'camera', bearing, dist }, depth,
      species, en_species: species, form, en_form: enForm, color, en_color: enColor,
      sizeCm: size, surfaceCm2: area, holes,
      day: { time: '10:40', tested: dT, active: dA }, night: { time: '19:50', tested: nT, active: nA },
      light, en_light: enLight, current: cur, en_current: enCur, substrate: sub, en_substrate: enSub,
      burrows: 'בעיקר בצמרת המושבה', en_burrows: 'Mostly on top of the colony',
    });
  });
}
