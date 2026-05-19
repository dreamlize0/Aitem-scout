// Connector interface. Each external source implements `fetch()` and is
// registered in `connectors/index.ts`. Failures surface via thrown errors —
// the orchestrator catches them so partial success is possible.

import type { RawItem, SearchFilters } from "../types.ts";

export interface ConnectorContext {
  query: string;
  filters: SearchFilters;
}

export interface SourceConnector {
  name: string;
  /** True if the required env vars are present. */
  enabled: () => boolean;
  fetch(ctx: ConnectorContext): Promise<RawItem[]>;
}

export class ConnectorDisabledError extends Error {
  constructor(name: string) {
    super(`Connector ${name} is disabled (missing env)`);
    this.name = "ConnectorDisabledError";
  }
}
