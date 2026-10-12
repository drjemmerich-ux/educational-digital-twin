// Saves a generated file. Inside a claude.ai Artifact the page cannot start downloads itself,
// so the platform `downloads` capability is used when present; otherwise a normal browser
// download is triggered. Returns a learner-facing status message.
type DownloadsNs = { save(r: { filename: string; data: string }): Promise<{ status: 'saved' | 'delivered' }> };
type ClaudeWindow = { claude?: { use?: (name: string) => Promise<unknown> } };

let downloadsPromise: Promise<DownloadsNs | null> | null = null;
function platformDownloads(): Promise<DownloadsNs | null> {
  if (!downloadsPromise) {
    const use = (window as unknown as ClaudeWindow).claude?.use;
    downloadsPromise = use ? (use('downloads') as Promise<DownloadsNs | null>).catch(() => null) : Promise.resolve(null);
  }
  return downloadsPromise;
}

export async function saveTextFile(filename: string, text: string): Promise<string> {
  const ns = await platformDownloads();
  if (ns) {
    try {
      const r = await ns.save({ filename, data: text });
      return r.status === 'saved' ? `Saved ${filename}.` : 'File handed to your chosen destination.';
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code === 'declined') return 'Download cancelled. You can still use Copy JSON.';
      if (code === 'rate_limited') return 'A save prompt is already open. Finish it, then try again.';
      return 'Downloads are not available in this view. Use Copy JSON instead.';
    }
  }
  try {
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    return `Download of ${filename} started.`;
  } catch {
    return 'Downloads are blocked here. Use Copy JSON instead.';
  }
}
