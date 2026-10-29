import React, { useEffect, useRef, useState } from "react";
import {
  LuX,
  LuCheck,
  LuCircleAlert,
  LuLoaderCircle,
  LuFolderOpen,
  LuChevronDown,
} from "react-icons/lu";
import { api, errorMessage } from "../api";
import useUIStore from "../stores/useUIStore";
export function Button({
  children,
  variant = "secondary",
  icon: Icon,
  busy,
  className = "",
  type = "button",
  ...props
}) {
  return (
    <button
      type={type}
      className={`button ${variant} ${className}`}
      aria-busy={busy || undefined}
      {...props}
      disabled={props.disabled || busy}
    >
      {busy ? (
        <LuLoaderCircle className="spin" aria-hidden />
      ) : Icon ? (
        <Icon aria-hidden />
      ) : null}
      {children}
    </button>
  );
}
export function IconButton({ label, children, busy, ...props }) {
  return (
    <button
      type="button"
      className="icon-button"
      aria-label={label}
      title={label}
      {...props}
      disabled={props.disabled || busy}
    >
      {busy ? <LuLoaderCircle className="spin" /> : children}
    </button>
  );
}
export function PageHeader({ eyebrow, title, description, children }) {
  return (
    <div className="page-header">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      <div className="page-actions">{children}</div>
    </div>
  );
}
export function Field({ label, hint, error, children, id, className = "" }) {
  return (
    <div className={`field ${className}`}>
      <label htmlFor={id}>{label}</label>
      {children}
      {hint && <small>{hint}</small>}
      {error && (
        <small className="error-text" role="alert">
          {error}
        </small>
      )}
    </div>
  );
}
export function FolderField({
  value,
  onChange,
  label = "Save to",
  id = "save-folder",
  desktop = api.desktop,
}) {
  const [busy, setBusy] = useState(false);
  const choose = async () => {
    setBusy(true);
    try {
      const result = await api.invoke("dialog:select-folder");
      if (result) onChange(result);
    } catch (error) {
      useUIStore.getState().notify(errorMessage(error), "error");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Field label={label} id={id}>
      <div className="input-group">
        <LuFolderOpen aria-hidden />
        <input
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          required
          placeholder={
            desktop ? "Choose a folder" : "Absolute sandbox folder path"
          }
          spellCheck="false"
        />
        {desktop && (
          <Button onClick={choose} busy={busy} variant="ghost">
            Browse
          </Button>
        )}
      </div>
    </Field>
  );
}
export function Dialog({
  title,
  description,
  children,
  onClose,
  wide = false,
  busy = false,
}) {
  const ref = useRef();
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const previous = document.activeElement;
    const root = ref.current;
    const focusable = () =>
      [
        ...root.querySelectorAll(
          'button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]',
        ),
      ].filter((element) => element.getClientRects().length);
    (
      root.querySelector("input:not(:disabled),[data-autofocus]") ||
      focusable()[0] ||
      root
    ).focus();
    const keydown = (event) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        closeRef.current?.();
      }
      if (event.key === "Tab") {
        const items = focusable(),
          first = items[0],
          last = items.at(-1);
        if (!first) {
          event.preventDefault();
          return;
        }
        if (
          event.shiftKey &&
          (document.activeElement === first ||
            !root.contains(document.activeElement))
        ) {
          last.focus();
          event.preventDefault();
        } else if (!event.shiftKey && document.activeElement === last) {
          first.focus();
          event.preventDefault();
        }
      }
    };
    document.addEventListener("keydown", keydown);
    return () => {
      document.removeEventListener("keydown", keydown);
      previous?.focus?.();
    };
  }, []);
  return (
    <div
      className="dialog-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose?.();
      }}
    >
      <section
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        className={`dialog ${wide ? "wide" : ""}`}
      >
        <header className="dialog-header">
          <div>
            <h2 id="dialog-title">{title}</h2>
            {description && <p>{description}</p>}
          </div>
          <IconButton label="Close dialog" disabled={busy} onClick={onClose}>
            <LuX />
          </IconButton>
        </header>
        {children}
      </section>
    </div>
  );
}
export function ConfirmDialog({
  title,
  description,
  onConfirm,
  onClose,
  destructive = false,
  label = "Confirm",
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <Dialog
      title={title}
      description={description}
      onClose={() => !busy && onClose()}
      busy={busy}
    >
      <div className="dialog-body">
        {error && <ErrorBanner>{error}</ErrorBanner>}
        <p className="muted">
          {destructive
            ? "This action cannot be undone."
            : "Your partial files and download history will be preserved."}
        </p>
      </div>
      <footer className="dialog-footer">
        <Button disabled={busy} onClick={onClose}>
          Keep it
        </Button>
        <Button
          variant={destructive ? "danger" : "primary"}
          busy={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await onConfirm();
              onClose();
            } catch (error) {
              setError(errorMessage(error));
            } finally {
              setBusy(false);
            }
          }}
        >
          {label}
        </Button>
      </footer>
    </Dialog>
  );
}
export function ErrorBanner({ children }) {
  return (
    <div className="error-banner" role="alert">
      <LuCircleAlert aria-hidden />
      <span>{children}</span>
    </div>
  );
}
export function Switch({ checked, onChange, label, disabled }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      className={`switch ${checked ? "on" : ""}`}
      onClick={() => onChange(!checked)}
    >
      <span />
    </button>
  );
}
export function Select({ children, ...props }) {
  return (
    <div className="select-wrap">
      <select {...props}>{children}</select>
      <LuChevronDown aria-hidden />
    </div>
  );
}
export function Toasts() {
  const toasts = useUIStore((state) => state.toasts),
    dismiss = useUIStore((state) => state.dismissToast);
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast ${toast.type}`}>
          {toast.type === "error" ? <LuCircleAlert /> : <LuCheck />}
          <span>{toast.message}</span>
          <IconButton
            label="Dismiss notification"
            onClick={() => dismiss(toast.id)}
          >
            <LuX />
          </IconButton>
        </div>
      ))}
    </div>
  );
}
