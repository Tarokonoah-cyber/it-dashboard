import { baseballSyncHandler } from "../../../../../lib/sportsCron";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const handler = baseballSyncHandler(["MLB", "NPB", "CPBL"]);

export { handler as GET, handler as POST };
