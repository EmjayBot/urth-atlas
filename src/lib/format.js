export function num(v, digits = 1) {
  return v.toLocaleString(void 0, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function intNum(v) {
  return v.toLocaleString(void 0, { maximumFractionDigits: 0 });
}

export function fmtKmMi(km) {
  const mi = km * 0.621371;
  return `${num(km, 1)} km / ${num(mi, 1)} mi`;
}

export function dms(lat) {
  const dir = lat >= 0 ? "N" : "S";
  const a = Math.abs(lat);
  const deg = Math.floor(a);
  const minF = (a - deg) * 60;
  const min = Math.floor(minF);
  const sec = Math.round((minF - min) * 60);
  return `${deg}°${min}'${sec}"${dir}`;
}