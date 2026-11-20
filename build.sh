#!/bin/bash
# Builds each plugin's page file from src/ (the shared Setup-tab helper + the plugin's own code).
set -e
cd "$(dirname "$0")"
cat src/setup-tab.js src/stationlog.js > StationLog/stationlog.js
[ -f src/insights.js ] && cat src/setup-tab.js src/insights.js > ListenerInsights/insights.js
[ -f src/fairshare.js ] && cat src/setup-tab.js src/fairshare.js > FairShare/fairshare.js
[ -f src/chatfilter.js ] && cat src/setup-tab.js src/chatfilter.js > ChatFilter/chatfilter.js
[ -f src/antennaadvisor.js ] && cat src/setup-tab.js src/antennaadvisor.js > AntennaAdvisor/antennaadvisor.js
[ -f src/dxwatch.js ] && cat src/setup-tab.js src/dxwatch.js > DXWatch/dxwatch.js
for f in StationLog/stationlog.js ListenerInsights/insights.js FairShare/fairshare.js ChatFilter/chatfilter.js ChatFilter/words.js ChatFilter/chatfilter_server.js AntennaAdvisor/antennaadvisor.js AntennaAdvisor/antennaadvisor_server.js DXWatch/dxwatch.js DXWatch/dxwatch_server.js; do [ -f "$f" ] && node --check "$f"; done
echo built
