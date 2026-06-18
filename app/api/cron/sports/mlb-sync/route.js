import { baseballSyncHandler } from "../../../../../lib/sportsCron";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const GET = baseballSyncHandler(["MLB"]);
