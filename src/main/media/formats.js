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
module.exports = { normalizeFormats };
