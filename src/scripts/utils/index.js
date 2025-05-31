// export function showFormattedDate(date, locale = 'en-US', options = {}) {
//   return new Date(date).toLocaleDateString(locale, {
//     year: 'numeric',
//     month: 'long',
//     day: 'numeric',
//     ...options,
//   });
// }

// export function sleep(time = 1000) {
//   return new Promise((resolve) => setTimeout(resolve, time));
// }

export async function loadConfig() {
  const res = await fetch('/STUDENT.txt');
  const text = await res.text();
  const m = text.match(/^MAPTILER_API_KEY=(.*)$/m);
  return { maptilerKey: m ? m[1].trim() : '' };
}