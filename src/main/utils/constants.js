module.exports = {
  APP_NAME: "GetANNY",
  WEBSOCKET_PORT: 29615,
  USER_AGENT: "GetANNY/1.0",
  MAX_REDIRECTS: 10,
  DEFAULT_CONCURRENT_DOWNLOADS: 3,
  DEFAULT_CONNECTIONS_PER_DOWNLOAD: 8,
  DOWNLOAD_STATUSES: Object.freeze([
    "queued",
    "downloading",
    "paused",
    "completed",
    "failed",
    "cancelled",
  ]),
};
