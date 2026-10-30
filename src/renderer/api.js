// Web preview uses the SAME services against an isolated sandbox database.
// Production builds never expose a network IPC server or a mock implementation.
const desktop = window.getanny;
let source;
const listeners = new Map();
export const api = desktop || {
  desktop: false,
  async invoke(channel, ...args) {
    if (!import.meta.env.DEV)
      throw new Error(
        "The desktop bridge is unavailable. Reinstall GetANNY or restart the application.",
      );
    const response = await fetch("/__getanny/invoke", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-GetANNY-Preview": "1" },
      body: JSON.stringify({ channel, args }),
    });
    const result = await response.json();
    if (!response.ok || result.error)
      throw new Error(result.error || "The preview backend is unavailable.");
    return result.value;
  },
  on(channel, callback) {
    if (import.meta.env.DEV && !source) {
      source = new EventSource("/__getanny/events");
      source.onmessage = (event) => {
        const message = JSON.parse(event.data);
        listeners
          .get(message.channel)
          ?.forEach((listener) => listener(message.data));
      };
    }
    if (!listeners.has(channel)) listeners.set(channel, new Set());
    listeners.get(channel).add(callback);
    return () => listeners.get(channel)?.delete(callback);
  },
};
export function errorMessage(error) {
  return String(error?.message || error).replace(
    /^Error invoking remote method '[^']+': (Error: )?/,
    "",
  );
}
