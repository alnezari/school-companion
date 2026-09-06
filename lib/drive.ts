// Server only. Reads the school's public Google Drive folders without any Google account or API key:
// the folder's embedded view lists the files, and the download link serves the file itself.

export interface DriveFile { id: string; name: string; week: number | null }

export function folderIdFrom(link: string): string | null {
  const m = link.match(/folders\/([\w-]+)/) ?? link.match(/^([\w-]{20,})$/);
  return m ? m[1] : null;
}
/** "Grade 2 - Week 3" → 3. Null when the name carries no week number. */
export function weekNumberFrom(name: string): number | null {
  const m = name.match(/week\s*-?\s*(\d+)/i) ?? name.match(/(?:أسبوع|الأسبوع)\s*(\d+)/);
  return m ? Number(m[1]) : null;
}

export async function listFolder(folderId: string): Promise<DriveFile[]> {
  const res = await fetch(`https://drive.google.com/embeddedfolderview?id=${folderId}`, { headers: { "user-agent": "Mozilla/5.0" }, cache: "no-store" });
  if (!res.ok) throw new Error(`The school folder could not be opened (HTTP ${res.status}).`);
  const html = await res.text();
  const files: DriveFile[] = [];
  const re = /flip-entry"[^>]*id="entry-([\w-]+)"[\s\S]*?flip-entry-title">([^<]*)</g;
  for (let m = re.exec(html); m; m = re.exec(html)) {
    const name = decode(m[2].trim());
    files.push({ id: m[1], name, week: weekNumberFrom(name) });
  }
  if (files.length === 0 && !/flip-entry/.test(html)) throw new Error("The school folder listing could not be read. Is the folder shared with 'anyone with the link'?");
  return files;
}

/** Downloads one file and wraps it as a File so the readers treat it exactly like an upload. */
export async function downloadFile(f: DriveFile): Promise<File> {
  const urls = [
    `https://drive.google.com/uc?export=download&id=${f.id}`,
    `https://drive.usercontent.google.com/download?id=${f.id}&export=download&confirm=t`,
  ];
  for (const url of urls) {
    const res = await fetch(url, { headers: { "user-agent": "Mozilla/5.0" }, cache: "no-store", redirect: "follow" });
    if (!res.ok) continue;
    const bytes = new Uint8Array(await res.arrayBuffer());
    const type = sniff(bytes);
    if (type) return new File([bytes], `${f.name}.${type === "application/pdf" ? "pdf" : type.slice(6)}`, { type });
  }
  throw new Error(`"${f.name}" could not be downloaded from the school folder.`);
}

function sniff(b: Uint8Array): string | null {
  if (b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46) return "application/pdf";
  if (b[0] === 0xff && b[1] === 0xd8) return "image/jpeg";
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return "image/webp";
  return null;
}
const decode = (s: string) => s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
