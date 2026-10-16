import { Carrier, CarrierMeta } from "./types";
import { amazon } from "./amazon";
import { bluedart } from "./bluedart";
import { shiprocket } from "./shiprocket";
import { delhivery } from "./delhivery";
import { ekart } from "./ekart";
import { stcourier } from "./stcourier";
import { tpc } from "./tpc";
import { xpressbees } from "./xpressbees";

export const carriers: Record<string, Carrier> = {
  [bluedart.id]: bluedart,
  [delhivery.id]: delhivery,
  [ekart.id]: ekart,
  [amazon.id]: amazon,
  [stcourier.id]: stcourier,
  [tpc.id]: tpc,
  [shiprocket.id]: shiprocket,
  [xpressbees.id]: xpressbees,
};

export function getCarrier(id: string): Carrier | undefined {
  return carriers[id.toLowerCase()];
}

export function listCarriers(): CarrierMeta[] {
  return Object.values(carriers).map((c) => ({
    id: c.id,
    name: c.name,
    website: c.website,
    privateOnly: c.privateOnly,
    sampleTracking: c.sampleTracking,
    description: c.description,
  }));
}
