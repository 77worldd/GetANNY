import React, { useEffect, useRef, useState } from "react";
import {
  LuAudioLines,
  LuFilm,
  LuSearch,
  LuArrowDownToLine,
  LuCheck,
  LuLink,
  LuInfo,
  LuExternalLink,
  LuSparkles,
} from "react-icons/lu";
import { api, errorMessage } from "../api";
import {
  Button,
  ErrorBanner,
  Field,
  FolderField,
  PageHeader,
} from "../components/ui";
import useSettingsStore from "../stores/useSettingsStore";
import useUIStore from "../stores/useUIStore";
import { bytes, duration } from "../utils/format";
export default function MediaPage({ tools }) {
  const url = useUIStore((state) => state.mediaUrl),
    setUrl = useUIStore((state) => state.setMediaUrl),
    mediaRequest = useUIStore((state) => state.mediaRequest);
  const settings = useSettingsStore((state) => state.settings);
  const [result, setResult] = useState(null),
    [selected, setSelected] = useState(null),
    [group, setGroup] = useState("video"),
    [folder, setFolder] = useState(settings.defaultDownloadPath || ""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [adding, setAdding] = useState(false);
  const generation = useRef(0),
    lastAuto = useRef(0);
  const analyze = async (event) => {
    event?.preventDefault();
    const current = ++generation.current;
    setBusy(true);
    setError("");
    setResult(null);
    setSelected(null);
    try {
      if (!/^https?:\/\//i.test(url.trim()))
        throw new Error("Paste an HTTP or HTTPS video or audio page URL.");
      const info = await api.invoke("media:get-formats", url.trim());
      if (current !== generation.current) return;
      setResult(info);
      const video = info.formats.filter((format) => format.group === "video");
      const preferred =
        video.find((format) => format.hasAudio) || video[0] || info.formats[0];
      setGroup(preferred?.group || "video");
      setSelected(preferred?.formatId || null);
      if (!info.formats.length)
        setError(
          "No unprotected playable formats were returned. The page may require authentication, be DRM-protected, or be unsupported.",
        );
    } catch (error) {
      if (current === generation.current) setError(errorMessage(error));
    } finally {
      if (current === generation.current) setBusy(false);
    }
  };
  useEffect(() => {
    if (mediaRequest && lastAuto.current !== mediaRequest && url) {
      lastAuto.current = mediaRequest;
      analyze();
    }
  }, [mediaRequest]);
  useEffect(
    () => () => {
      generation.current++;
      lastAuto.current = 0;
    },
    [],
  );
  const format = result?.formats.find((item) => item.formatId === selected);
  const add = async () => {
    setAdding(true);
    setError("");
    try {
      await api.invoke("media:download", {
        analysisId: result.analysisId,
        formatId: format.formatId,
        ...(folder !== settings.defaultDownloadPath
          ? { savePath: folder }
          : {}),
      });
      useUIStore.getState().notify("Media added to Downloads.");
      useUIStore.getState().setActiveTab("all");
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setAdding(false);
    }
  };
  return (
    <div className="page media-page">
      <PageHeader
        eyebrow="EXTRACT & DOWNLOAD"
        title="Media studio"
        description="The right quality. The right format. Video and audio, without the clutter."
      >
        <span className={`engine-label ${tools.ytdlp ? "ready" : ""}`}>
          <span className="status-dot" />
          {tools.ytdlp ? "yt-dlp engine available" : "yt-dlp missing"}
        </span>
      </PageHeader>
      {!tools.ytdlp && (
        <ErrorBanner>
          The media engine is missing from this installation. Run{" "}
          <code>npm run prepare:tools</code> or reinstall the complete Windows
          package.
        </ErrorBanner>
      )}
      <form className="media-search-panel" onSubmit={analyze}>
        <Field label="VIDEO OR AUDIO PAGE" id="media-url">
          <div className="media-search">
            <LuLink />
            <input
              id="media-url"
              type="url"
              required
              placeholder="Paste a supported video or audio link…"
              value={url}
              onChange={(event) => {
                setUrl(event.target.value);
                if (result) {
                  setResult(null);
                  setSelected(null);
                }
              }}
              spellCheck="false"
              autoComplete="off"
            />
            <Button
              type="submit"
              icon={LuSearch}
              variant="primary"
              busy={busy}
              disabled={!url.trim() || !tools.ytdlp}
            >
              Analyze link
            </Button>
          </div>
        </Field>
        <div className="media-search-note">
          <span>Powered by yt-dlp · Single video or audio pages</span>
          <span>Only download content you’re allowed to save.</span>
        </div>
      </form>
      {error && <ErrorBanner>{error}</ErrorBanner>}
      {busy && (
        <div className="analysis-loading">
          <div className="loader-ring" />
          <h2>Finding your formats</h2>
          <p>
            Reading the source page and checking available video and audio
            streams.
          </p>
          <span>Some websites may take a little longer to respond.</span>
        </div>
      )}
      {!busy && result && (
        <section className="media-result">
          <div className="media-result-header">
            {result.thumbnail ? (
              <img
                className="media-thumbnail"
                src={result.thumbnail}
                alt="Media preview"
                onError={(event) => {
                  event.currentTarget.hidden = true;
                }}
              />
            ) : (
              <div className="media-thumbnail fallback">
                <LuFilm />
              </div>
            )}
            <div>
              <span className="eyebrow">
                {result.extractor || "MEDIA SOURCE"}{" "}
                {result.duration ? `· ${duration(result.duration)}` : ""}
              </span>
              <h2>{result.title}</h2>
              <p>
                {result.formats.length} playable{" "}
                {result.formats.length === 1 ? "format" : "formats"} ·
                Storyboards and duplicates filtered out
              </p>
            </div>
          </div>
          <div className="media-result-body">
            <div className="format-panel">
              <div
                className="format-tabs"
                role="tablist"
                aria-label="Media format type"
              >
                {[
                  ["video", LuFilm, "Video"],
                  ["audio", LuAudioLines, "Audio only"],
                ].map(([key, Icon, label]) => (
                  <button
                    role="tab"
                    aria-selected={group === key}
                    key={key}
                    onClick={() => {
                      setGroup(key);
                      const first = result.formats.find(
                        (item) => item.group === key,
                      );
                      setSelected(first?.formatId || null);
                    }}
                  >
                    <Icon />
                    {label}
                    <span>
                      {
                        result.formats.filter((item) => item.group === key)
                          .length
                      }
                    </span>
                  </button>
                ))}
              </div>
              <div className="format-heading">
                <span>QUALITY / FORMAT</span>
                <span>SIZE</span>
              </div>
              <div
                className="format-list"
                role="radiogroup"
                aria-label={`${group} formats`}
              >
                {result.formats
                  .filter((item) => item.group === group)
                  .map((item) => (
                    <label
                      key={item.formatId}
                      className={`format-option ${selected === item.formatId ? "selected" : ""} ${item.mergeAudio && !result.tools.ffmpeg ? "unavailable" : ""}`}
                    >
                      <input
                        type="radio"
                        name="media-format"
                        value={item.formatId}
                        checked={selected === item.formatId}
                        disabled={item.mergeAudio && !result.tools.ffmpeg}
                        onChange={() => setSelected(item.formatId)}
                      />
                      <span className="format-radio">
                        <LuCheck />
                      </span>
                      <div className="format-description">
                        <strong>
                          {item.quality} <span>{item.ext.toUpperCase()}</span>
                          {item.fps > 30 && <span>{item.fps} FPS</span>}
                        </strong>
                        <small>
                          {[
                            item.resolution,
                            item.vcodec?.split(".")[0],
                            item.acodec?.split(".")[0],
                            item.language,
                            item.mergeAudio
                              ? "Audio merged automatically"
                              : item.hasVideo
                                ? item.audioUnknown
                                  ? "Audio not reported"
                                  : item.hasAudio
                                    ? "Video + audio included"
                                    : "Video only · no audio track"
                                : item.audioChannels
                                  ? `${item.audioChannels} channels`
                                  : "Audio stream",
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </small>
                      </div>
                      <span className="format-size">
                        {item.filesize
                          ? `${item.approximateSize ? "≈ " : ""}${bytes(item.filesize)}`
                          : "Unknown"}
                        {item.mergeAudio && item.filesize ? (
                          <small>+ audio</small>
                        ) : null}
                      </span>
                    </label>
                  ))}
                {!result.formats.some((item) => item.group === group) && (
                  <div className="format-empty">
                    This page has no separate{" "}
                    {group === "audio" ? "audio-only" : "video"} formats.
                  </div>
                )}
              </div>
              <p className="format-footnote">
                <LuInfo />
                Unknown sizes are not estimates. Video-only sizes exclude the
                audio stream.
              </p>
            </div>
            <aside className="media-output">
              <div className="eyebrow">YOUR DOWNLOAD</div>
              <div className="selected-quality">
                {format?.quality || "Choose a format"}
                <span>{format?.ext.toUpperCase()}</span>
              </div>
              <dl>
                <div>
                  <dt>Content</dt>
                  <dd>
                    {format?.group === "audio"
                      ? "Audio only"
                      : format?.audioUnknown
                        ? "Video · tracks unreported"
                        : format?.hasAudio || format?.mergeAudio
                          ? "Video with audio"
                          : "Video only"}
                  </dd>
                </div>
                <div>
                  <dt>Audio</dt>
                  <dd>
                    {format?.mergeAudio
                      ? "Merged with FFmpeg"
                      : format?.hasAudio
                        ? "Included"
                        : format?.audioUnknown
                          ? "Not reported"
                          : "—"}
                  </dd>
                </div>
                <div>
                  <dt>File size</dt>
                  <dd>
                    {format?.filesize
                      ? `${format.approximateSize ? "≈ " : ""}${bytes(format.filesize)}${format.mergeAudio ? " + audio" : ""}`
                      : "Not provided"}
                  </dd>
                </div>
              </dl>
              <FolderField
                value={folder}
                onChange={setFolder}
                id="media-folder"
              />
              <Button
                variant="primary"
                icon={LuArrowDownToLine}
                busy={adding}
                disabled={
                  !format ||
                  !folder ||
                  (format.mergeAudio && !result.tools.ffmpeg)
                }
                onClick={add}
              >
                Download {group === "audio" ? "audio" : "video"}
              </Button>
              <p>
                Progress, pause, cancel, and history are available in Downloads.
              </p>
              {!result.tools.ffmpeg && (
                <div className="small-warning">
                  FFmpeg is missing. Video-only formats that need audio merging
                  are disabled.
                </div>
              )}
            </aside>
          </div>
        </section>
      )}
      {!busy && !result && !error && (
        <div className="media-intro">
          <div className="media-intro-icon">
            <LuFilm />
            <LuAudioLines />
          </div>
          <h2>One link. Every useful format.</h2>
          <p>
            Choose a resolution for video, or keep just the audio.
            <br />
            We’ll take care of streams and merging, then keep everything in your
            download library.
          </p>
          <div className="media-capabilities">
            <span>
              <LuCheck />
              Video + audio
            </span>
            <span>
              <LuCheck />
              Audio-only formats
            </span>
            <span>
              <LuCheck />
              Real transfer progress
            </span>
          </div>
          <p className="media-limit-note">
            Availability depends on the website. DRM-protected content is not
            supported.
            <br />
            Private pages may require authentication not provided by this
            application.
          </p>
        </div>
      )}
    </div>
  );
}
