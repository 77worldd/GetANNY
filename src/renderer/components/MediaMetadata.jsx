import React, { useState } from "react";
import {
  LuArrowDownToLine,
  LuCaptions,
  LuCheck,
  LuCopy,
  LuFileText,
  LuImage,
  LuSearch,
  LuTags,
} from "react-icons/lu";
import { api, errorMessage } from "../api";
import { Button } from "./ui";
import useUIStore from "../stores/useUIStore";

export default function MediaMetadata({ section, result, savePath, onError }) {
  const [busy, setBusy] = useState("");
  const [query, setQuery] = useState("");
  const copy = async (text, label) => {
    try {
      await navigator.clipboard.writeText(text);
      useUIStore.getState().notify(`${label} copied.`);
    } catch {
      useUIStore.getState().notify("Clipboard access was denied.", "error");
    }
  };
  const run = async (key, channel, options, message) => {
    setBusy(key);
    onError("");
    try {
      await api.invoke(channel, {
        analysisId: result.analysisId,
        savePath,
        ...options,
      });
      useUIStore.getState().notify(message);
    } catch (error) {
      onError(errorMessage(error));
    } finally {
      setBusy("");
    }
  };
  if (section === "thumbnails")
    return (
      <section className="metadata-panel" aria-label="Video thumbnails">
        <div className="metadata-heading">
          <div>
            <LuImage />
            <span>
              <h2>Thumbnail images</h2>
              <p>
                Preview and save the image resolutions exposed by the source.
              </p>
            </span>
          </div>
          <span>{result.thumbnails.length} available</span>
        </div>
        {result.thumbnails.length ? (
          <div className="thumbnail-grid">
            {result.thumbnails.map((thumbnail) => (
              <article className="thumbnail-card" key={thumbnail.id}>
                <div className="thumbnail-preview">
                  <img
                    src={thumbnail.url}
                    alt={`Video thumbnail ${thumbnail.label}`}
                    loading="lazy"
                  />
                </div>
                <div className="thumbnail-info">
                  <span>
                    <strong>{thumbnail.label}</strong>
                    <small>{thumbnail.ext.toUpperCase()}</small>
                  </span>
                  <Button
                    icon={LuArrowDownToLine}
                    busy={busy === thumbnail.id}
                    disabled={!!busy}
                    onClick={() =>
                      run(
                        thumbnail.id,
                        "media:download-thumbnail",
                        { thumbnailId: thumbnail.id },
                        "Thumbnail added to Downloads.",
                      )
                    }
                  >
                    Download
                  </Button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="metadata-empty">
            No downloadable thumbnails were reported for this page.
          </div>
        )}
      </section>
    );
  if (section === "description")
    return (
      <section className="metadata-panel" aria-label="Video description">
        <div className="metadata-heading">
          <div>
            <LuFileText />
            <span>
              <h2>Full description</h2>
              <p>Original line breaks and spacing are preserved.</p>
            </span>
          </div>
          <Button
            icon={LuCopy}
            disabled={!result.description}
            onClick={() => copy(result.description, "Description")}
          >
            Copy description
          </Button>
        </div>
        {result.description ? (
          <div className="video-description">{result.description}</div>
        ) : (
          <div className="metadata-empty">
            This page has no public description.
          </div>
        )}
      </section>
    );
  if (section === "tags")
    return (
      <section className="metadata-panel" aria-label="Video tags">
        <div className="metadata-heading">
          <div>
            <LuTags />
            <span>
              <h2>Video tags</h2>
              <p>Copy one tag, or copy the complete comma-separated list.</p>
            </span>
          </div>
          <Button
            icon={LuCopy}
            disabled={!result.tags.length}
            onClick={() => copy(result.tags.join(", "), "All tags")}
          >
            Copy all tags
          </Button>
        </div>
        {result.tags.length ? (
          <div className="tag-list">
            {result.tags.map((tag, index) => (
              <button
                key={`${tag}-${index}`}
                onClick={() => copy(tag, "Tag")}
                title={`Copy ${tag}`}
              >
                <span>{tag}</span>
                <LuCopy />
              </button>
            ))}
          </div>
        ) : (
          <div className="metadata-empty">
            No public tags were reported for this page.
          </div>
        )}
      </section>
    );
  const subtitles = result.subtitles.filter((item) =>
    `${item.name} ${item.language}`.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <section className="metadata-panel" aria-label="Video subtitles">
      <div className="metadata-heading">
        <div>
          <LuCaptions />
          <span>
            <h2>Subtitles & captions</h2>
            <p>
              Download independently as VTT, or as SRT with conversion when
              needed.
            </p>
          </span>
        </div>
        <span>{result.subtitles.length} languages</span>
      </div>
      {result.subtitles.length > 8 && (
        <div className="search-input subtitle-search">
          <LuSearch />
          <input
            aria-label="Search subtitle languages"
            placeholder="Find a language…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
      )}
      {subtitles.length ? (
        <div className="subtitle-list">
          {subtitles.map((subtitle) => (
            <div className="subtitle-row" key={subtitle.id}>
              <div>
                <strong>{subtitle.name}</strong>
                <span>
                  {subtitle.language}
                  {subtitle.automatic
                    ? " · Automatic captions"
                    : " · Creator subtitles"}
                </span>
              </div>
              <small>
                {subtitle.formats
                  .map((format) => format.toUpperCase())
                  .join(" · ")}
              </small>
              <div className="subtitle-actions">
                {["vtt", "srt"].map((format) => {
                  const key = `${subtitle.id}:${format}`;
                  const direct = subtitle.formats.includes(format);
                  return (
                    <Button
                      key={format}
                      icon={direct ? LuArrowDownToLine : LuCheck}
                      busy={busy === key}
                      disabled={!!busy}
                      title={
                        direct
                          ? `Download available ${format.toUpperCase()} track`
                          : `Convert an available caption to ${format.toUpperCase()} with FFmpeg`
                      }
                      onClick={() =>
                        run(
                          key,
                          "media:download-subtitle",
                          { languageId: subtitle.id, format },
                          `${subtitle.name} ${format.toUpperCase()} subtitles added to Downloads.`,
                        )
                      }
                    >
                      {format.toUpperCase()}
                    </Button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="metadata-empty">
          {result.subtitles.length
            ? "No languages match your search."
            : "No accessible subtitles or automatic captions were reported."}
        </div>
      )}
      {!!result.subtitles.length && (
        <p className="metadata-note">
          Availability is controlled by the source. If SRT or VTT is not
          directly provided, GetANNY uses yt-dlp and FFmpeg to convert an
          available track.
        </p>
      )}
    </section>
  );
}
