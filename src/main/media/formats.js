function videoCodec(format) {
  if (format.vcodec === "none") return false;
  return (
    !!format.vcodec ||
    (!format.acodec && /^(mp4|webm|mkv|mov|m4v)$/.test(format.ext))
  );
}
function audioCodec(format) {
  if (format.acodec === "none") return false;
  return (
    !!format.acodec ||
    format.vcodec === "none" ||
    /^(m4a|mp3|ogg|opus|aac|wav|flac)$/.test(format.ext)
  );
}
function normalizeFormats(info) {
  const seen = new Set();
  const separateAudio = (info.formats || []).some(
    (format) =>
      format.url &&
      !videoCodec(format) &&
      audioCodec(format) &&
      !format.has_drm,
  );
  return (info.formats || [])
    .filter((format) => {
      const video = videoCodec(format);
      const audio = audioCodec(format);
      return (
        format.format_id &&
        format.url &&
        (video || audio) &&
        !format.has_drm &&
        !["mhtml", "html", "json", "jpg", "png"].includes(format.ext) &&
        !/storyboard|thumbnail|images/i.test(format.format_note || "")
      );
    })
    .map((format) => {
      const hasVideo = videoCodec(format);
      const hasAudio = audioCodec(format);
      return {
        formatId: String(format.format_id),
        ext: format.ext || "unknown",
        group: hasVideo ? "video" : "audio",
        hasVideo,
        hasAudio,
        mergeAudio: hasVideo && format.acodec === "none" && separateAudio,
        audioUnknown: hasVideo && !format.acodec,
        quality: hasVideo
          ? format.height
            ? `${format.height}p`
            : format.resolution || format.format_note || "Original"
          : format.abr
            ? `${Math.round(format.abr)} kbps`
            : format.format_note || "Audio",
        width: format.width || null,
        height: format.height || null,
        fps: format.fps || null,
        resolution:
          format.width && format.height
            ? `${format.width} × ${format.height}`
            : null,
        filesize: format.filesize || format.filesize_approx || null,
        approximateSize: !format.filesize && !!format.filesize_approx,
        vcodec: hasVideo ? format.vcodec : null,
        acodec: hasAudio ? format.acodec : null,
        bitrate: format.abr || format.tbr || null,
        audioChannels: format.audio_channels || null,
        language: format.language || null,
        note: format.format_note || null,
        protocol: format.protocol || null,
      };
    })
    .sort(
      (a, b) =>
        (b.height || 0) - (a.height || 0) ||
        (b.fps || 0) - (a.fps || 0) ||
        (b.bitrate || 0) - (a.bitrate || 0),
    )
    .filter((format) => {
      // Preserve codec, language, frame-rate and HDR distinctions; remove only true equivalent entries.
      const key = JSON.stringify([
        format.group,
        format.ext,
        format.height,
        format.width,
        format.fps,
        format.vcodec,
        format.acodec,
        format.bitrate,
        format.language,
        format.audioChannels,
        format.note,
      ]);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}
function mediaUrl(value) {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}
function normalizeThumbnails(info) {
  const seen = new Set();
  return [
    ...(info.thumbnails || []),
    ...(info.thumbnail ? [{ url: info.thumbnail }] : []),
  ]
    .map((thumbnail) => {
      const url = mediaUrl(thumbnail.url);
      if (!url || seen.has(url)) return null;
      seen.add(url);
      const width = Number(thumbnail.width) || null;
      const height = Number(thumbnail.height) || null;
      const fromUrl = new URL(url).pathname.match(
        /\.(jpe?g|png|webp|avif|gif)$/i,
      )?.[1];
      const ext = String(thumbnail.ext || fromUrl || "jpg")
        .toLowerCase()
        .replace("jpeg", "jpg");
      return {
        id: "",
        url,
        width,
        height,
        ext: /^(jpg|png|webp|avif|gif)$/.test(ext) ? ext : "jpg",
        httpHeaders: thumbnail.http_headers || undefined,
      };
    })
    .filter(Boolean)
    .sort((a, b) => (b.width * b.height || 0) - (a.width * a.height || 0))
    .slice(0, 30)
    .map((thumbnail, index) => ({
      ...thumbnail,
      id: `thumbnail-${index}`,
      label: thumbnail.width
        ? `${thumbnail.width} × ${thumbnail.height || "?"}`
        : `Image ${index + 1}`,
    }));
}
function normalizeSubtitles(info) {
  const result = [];
  for (const [automatic, groups] of [
    [false, info.subtitles],
    [true, info.automatic_captions],
  ]) {
    for (const [language, tracks] of Object.entries(groups || {})) {
      // Keep the direct track URL per format. Fetching the caption straight
      // from the extractor is far more reliable than asking yt-dlp to resolve
      // the same page again, which is where most subtitle failures came from.
      const sources = {};
      let name = null;
      for (const track of tracks || []) {
        const ext = String(track.ext || "").toLowerCase();
        const url = mediaUrl(track.url);
        if (!url || !/^[a-z0-9]{1,12}$/.test(ext)) continue;
        if (track.name && !name) name = String(track.name).slice(0, 120);
        if (!sources[ext]) sources[ext] = url;
      }
      const formats = Object.keys(sources);
      if (!formats.length) continue;
      result.push({
        id: `${automatic ? "automatic" : "manual"}:${language}`,
        language,
        name: name || language,
        automatic,
        formats,
        sources,
      });
    }
  }
  return result.sort(
    (a, b) =>
      a.automatic - b.automatic ||
      a.name.localeCompare(b.name) ||
      a.language.localeCompare(b.language),
  );
}
module.exports = { normalizeFormats, normalizeThumbnails, normalizeSubtitles };
