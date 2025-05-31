// const CONFIG = {
//   BASE_URL: 'API_BASE_URL',
// };

// export default CONFIG;

export async function loadConfig() {
  const res = await fetch('/STUDENT.txt');
  const text = await res.text();
  const m = text.match(/^MAPTILER_API_KEY=(.*)$/m);
  return { maptilerKey: m ? m[1].trim() : '' };
}
