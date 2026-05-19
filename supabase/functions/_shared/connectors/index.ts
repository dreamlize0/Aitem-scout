// Registry of all connectors. Add new sources here only — the orchestrator
// auto-picks up everything enabled.

import type { SourceConnector } from "./base.ts";
import { naverConnector } from "./naver.ts";
import { youtubeConnector } from "./youtube.ts";
import { googleTrendsConnector } from "./google-trends.ts";
import { metaConnector } from "./meta.ts";
import { xConnector } from "./x.ts";
import { threadsConnector } from "./threads.ts";
import { kakaoConnector } from "./kakao.ts";
import { tavilyConnector } from "./tavily.ts";

export const ALL_CONNECTORS: SourceConnector[] = [
  naverConnector,
  youtubeConnector,
  googleTrendsConnector,
  metaConnector,
  xConnector,
  threadsConnector,
  kakaoConnector,
  tavilyConnector,
];
