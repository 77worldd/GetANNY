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
import { useI18n } from "../i18n/useI18n";

export default function MediaMetadata({ section, result, savePath, onError }) {
  const { t } = useI18n();
  const [busy, setBusy] = useState("");
  const [query, setQuery] = useState("");
  const copy = async (text, label) => {
    try {
      await navigator.clipboard.writeText(text);
      useUIStore.getState().notify(t("metadata.copied", { label }));
    } catch {
      useUIStore.getState().notify(t("common.copyDenied"), "error");
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
      <section
        className="metadata-panel"
        aria-label={t("metadata.thumbnailsLabel")}
      >
        <div className="metadata-heading">
          <div>
            <LuImage />
            <span>
              <h2>{t("metadata.thumbnailsTitle")}</h2>
              <p>{t("metadata.thumbnailsText")}</p>
            </span>
          </div>
          <span>
            {t("metadata.available", { count: result.thumbnails.length })}
          </span>
        </div>
        {result.thumbnails.length ? (
          <div className="thumbnail-grid">
            {result.thumbnails.map((thumbnail) => (
              <article className="thumbnail-card" key={thumbnail.id}>
                <div className="thumbnail-preview">
                  <img
                    src={thumbnail.url}
                    alt={t("metadata.thumbnailAlt", {
                      label: thumbnail.label,
                    })}
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
                        t("metadata.thumbnailAdded"),
                      )
                    }
                  >
                    {t("metadata.download")}
                  </Button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="metadata-empty">{t("metadata.noThumbnails")}</div>
        )}
      </section>
    );
  if (section === "description")
    return (
      <section
        className="metadata-panel"
        aria-label={t("metadata.descriptionLabel")}
      >
        <div className="metadata-heading">
          <div>
            <LuFileText />
            <span>
              <h2>{t("metadata.descriptionTitle")}</h2>
              <p>{t("metadata.descriptionText")}</p>
            </span>
          </div>
          <Button
            icon={LuCopy}
            disabled={!result.description}
            onClick={() =>
              copy(result.description, t("metadata.copyDescriptionLabel"))
            }
          >
            {t("metadata.copyDescription")}
          </Button>
        </div>
        {result.description ? (
          <div className="video-description">{result.description}</div>
        ) : (
          <div className="metadata-empty">{t("metadata.noDescription")}</div>
        )}
      </section>
    );
  if (section === "tags")
    return (
      <section className="metadata-panel" aria-label={t("metadata.tagsLabel")}>
        <div className="metadata-heading">
          <div>
            <LuTags />
            <span>
              <h2>{t("metadata.tagsTitle")}</h2>
              <p>{t("metadata.tagsText")}</p>
            </span>
          </div>
          <Button
            icon={LuCopy}
            disabled={!result.tags.length}
            onClick={() => copy(result.tags.join(", "), t("metadata.allTags"))}
          >
            {t("metadata.copyAllTags")}
          </Button>
        </div>
        {result.tags.length ? (
          <div className="tag-list">
            {result.tags.map((tag, index) => (
              <button
                key={`${tag}-${index}`}
                onClick={() => copy(tag, t("metadata.tag"))}
                title={t("metadata.copyTag", { tag })}
              >
                <span>{tag}</span>
                <LuCopy />
              </button>
            ))}
          </div>
        ) : (
          <div className="metadata-empty">{t("metadata.noTags")}</div>
        )}
      </section>
    );
  const subtitles = result.subtitles.filter((item) =>
    `${item.name} ${item.language}`.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <section
      className="metadata-panel"
      aria-label={t("metadata.subtitlesLabel")}
    >
      <div className="metadata-heading">
        <div>
          <LuCaptions />
          <span>
            <h2>{t("metadata.subtitlesTitle")}</h2>
            <p>{t("metadata.subtitlesText")}</p>
          </span>
        </div>
        <span>
          {t("metadata.languages", { count: result.subtitles.length })}
        </span>
      </div>
      {result.subtitles.length > 8 && (
        <div className="search-input subtitle-search">
          <LuSearch />
          <input
            aria-label={t("metadata.searchLabel")}
            placeholder={t("metadata.searchPlaceholder")}
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
                    ? ` · ${t("metadata.automaticCaptions")}`
                    : ` · ${t("metadata.creatorSubtitles")}`}
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
                          ? t("metadata.downloadTrack", {
                              format: format.toUpperCase(),
                            })
                          : t("metadata.convertTrack", {
                              format: format.toUpperCase(),
                            })
                      }
                      onClick={() =>
                        run(
                          key,
                          "media:download-subtitle",
                          { languageId: subtitle.id, format },
                          t("metadata.subtitleAdded", {
                            name: subtitle.name,
                            format: format.toUpperCase(),
                          }),
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
            ? t("metadata.noMatch")
            : t("metadata.none")}
        </div>
      )}
      {!!result.subtitles.length && (
        <p className="metadata-note">{t("metadata.note")}</p>
      )}
    </section>
  );
}
