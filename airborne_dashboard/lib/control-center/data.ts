import { createApiClient } from "./api-client";
import type { ClientContext, ControlCenterClient } from "./types";

export async function getControlCenterClient(ctx: ClientContext): Promise<ControlCenterClient> {
  return createApiClient(ctx);
}
