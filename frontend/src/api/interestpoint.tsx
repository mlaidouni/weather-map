export async function fetchInterestPoint(lat_list: number[], lng_list: number[]) {
  if (!lat_list || !lng_list) return [];
  const res = await fetch(`/api/interest-point/get?lat=${lat_list.join(",")}&lng=${lng_list.join(",")}`);
  if (!res.ok) throw new Error(`Erreur API: ${res.status}`);
  return res.json();
}
