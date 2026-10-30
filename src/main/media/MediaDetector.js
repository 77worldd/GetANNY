const { randomUUID } = require("node:crypto");
const { YtDlpWrapper } = require("./YtDlpWrapper");
const { StreamSniffer } = require("./StreamSniffer");
const { validateUrl } = require("../engine/utils");

class MediaDetector {
  constructor({ binPath, onMedia, wrapper } = {}) {
    this.ytdlp = wrapper || new YtDlpWrapper({ binPath });
    this.sniffer = new StreamSniffer({ onMedia });
    this.analyses = new Map();
  }
  async detect(url) {
    return this.getFormats(url);
  }
  async getFormats(url) {
    url = validateUrl(url);
    const result = await this.ytdlp.getFormats(url);
    const analysisId = randomUUID();
    for (const [key, value] of this.analyses)
      if (Date.now() - value.createdAt > 30 * 60 * 1000)
        this.analyses.delete(key);
    this.analyses.set(analysisId, {
      ...result,
      originalUrl: url,
      createdAt: Date.now(),
    });
    while (this.analyses.size > 20)
      this.analyses.delete(this.analyses.keys().next().value);
    return { ...result, analysisId, tools: await this.ytdlp.availability() };
  }
  analysis(analysisId) {
    const analysis = this.analyses.get(analysisId);
    if (!analysis || Date.now() - analysis.createdAt > 30 * 60 * 1000)
      throw new Error("This format list has expired. Analyze the URL again.");
    return analysis;
  }
  selection({ analysisId, formatId }) {
    const analysis = this.analysis(analysisId);
    const format = analysis.formats.find(
      (value) => value.formatId === formatId,
    );
    if (!format) throw new Error("Choose an available video or audio format.");
    return {
      url: analysis.originalUrl,
      media: {
        type: "video",
        title: analysis.title,
        formatId: format.formatId,
        mergeAudio: format.mergeAudio,
        audioOnly: format.group === "audio",
        ext: format.ext,
        quality: format.quality,
        audioUnknown: format.audioUnknown,
      },
    };
  }
  subtitleSelection({ analysisId, languageId, format }) {
    const analysis = this.analysis(analysisId);
    const subtitle = analysis.subtitles.find((item) => item.id === languageId);
    if (!subtitle) throw new Error("Choose an available subtitle language.");
    if (!["srt", "vtt"].includes(format))
      throw new Error("Choose SRT or VTT subtitles.");
    return {
      url: analysis.originalUrl,
      media: {
        type: "subtitle",
        title: analysis.title,
        quality: `${subtitle.language} · ${format.toUpperCase()}`,
        subtitle: {
          language: subtitle.language,
          automatic: subtitle.automatic,
          format,
          sourceFormats: subtitle.formats,
        },
      },
    };
  }
  thumbnailSelection({ analysisId, thumbnailId }) {
    const analysis = this.analysis(analysisId);
    const thumbnail = analysis.thumbnails.find(
      (item) => item.id === thumbnailId,
    );
    if (!thumbnail) throw new Error("Choose an available thumbnail image.");
    return {
      url: thumbnail.url,
      filename: `${analysis.title} [${thumbnail.label}].${thumbnail.ext}`,
      headers: thumbnail.httpHeaders,
    };
  }
  inspect(details) {
    return this.sniffer.inspect(details);
  }
}
module.exports = { MediaDetector };
