export const STILLS = {
  title: "/art/title-lab.jpg",
  compute: "/art/compute-hall.jpg",
  helios: "/art/rival-helios.jpg",
  aegis: "/art/rival-aegis.jpg",
  commons: "/art/rival-commons.jpg",
  meridian: "/art/rival-meridian.jpg",
  china: "/art/abroad-hall.jpg",
  ending: "/art/ending-room.jpg",
  south: "/art/campus-south.jpg",
  onsite: "/art/campus-onsite.jpg",
} as const;

export function rivalStill(id: string) {
  if (id === "helios" || id === "aegis" || id === "commons" || id === "meridian") return STILLS[id];
  return STILLS.compute;
}

export function campusStill(id: string) {
  if (id === "south") return STILLS.south;
  if (id === "onsite") return STILLS.onsite;
  if (id === "abroad") return STILLS.china;
  return STILLS.compute;
}
