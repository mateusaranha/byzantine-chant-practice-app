import { newHymn, normalizeHymn, restoreHymns } from "./hymnState";
import type { Hymn } from "./hymnState";

export type ShareRequest = { path: string; hymnId: string | null };
export type SharedRoute = ShareRequest | { error: string };
export type PublishedSet = { title: string; hymns: Hymn[]; hymnIds: (string | null)[] };

const WORKSPACE_KEY = "psaltikon-practice";
const PATH_PATTERN = /^hinos\/[a-z0-9][a-z0-9-]{0,38}\/[a-z0-9][a-z0-9-]{0,79}\.json$/;

export function parseShareRequest(search: string): SharedRoute | null {
  const params = new URLSearchParams(search);
  if (!params.has("conjunto") && !params.has("hino")) return null;
  const path = params.get("conjunto") || "";
  const hymnId = params.get("hino");
  if (!PATH_PATTERN.test(path) || params.getAll("conjunto").length !== 1 ||
      params.getAll("hino").length > 1 || (hymnId !== null && (!hymnId.trim() || hymnId.length > 200))) {
    return { error: "Este link de compartilhamento é inválido. Peça um novo link a quem enviou." };
  }
  return { path, hymnId };
}

export function createShareUrl(pageUrl: string, request: ShareRequest): string {
  const url = new URL(pageUrl);
  // Never include OAuth tokens, unrelated parameters or local hymn data.
  url.search = "";
  url.hash = "";
  url.searchParams.set("conjunto", request.path);
  if (request.hymnId !== null) url.searchParams.set("hino", request.hymnId);
  return url.href;
}

export function workspaceUrl(pageUrl: string): string {
  const url = new URL(pageUrl);
  url.searchParams.delete("conjunto");
  url.searchParams.delete("hino");
  return url.href;
}

export function readPublishedSet(value: unknown): PublishedSet {
  const invalid = () => new Error("O conjunto publicado contém dados inválidos. Peça ao autor que confira a publicação.");
  if (!value || typeof value !== "object") throw invalid();
  const data = value as { title?: unknown; hymns?: unknown };
  if (typeof data.title !== "string" || !Array.isArray(data.hymns) || !data.hymns.length || data.hymns.length > 80) throw invalid();
  if (new TextEncoder().encode(JSON.stringify(data.hymns)).byteLength > 1_500_000) throw invalid();
  const rawIds = data.hymns.map((item) => item && typeof item.id === "string" ? item.id : null);
  const hymnIds = rawIds.map((id) => id && id.trim() && id.length <= 200 && rawIds.filter((other) => other === id).length === 1 ? id : null);
  const hymns = data.hymns.map((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item) || typeof item.lyrics !== "string") throw invalid();
    const safe: Partial<Hymn> = { lyrics: item.lyrics };
    for (const field of ["title", "mode", "videoInput", "videoId"] as const) {
      if (item[field] === undefined) continue;
      if (typeof item[field] !== "string") throw invalid();
      safe[field] = item[field];
    }
    for (const field of ["fontSize", "lineHeight", "targetSpeed"] as const) {
      if (item[field] === undefined) continue;
      if (typeof item[field] !== "number" || !Number.isFinite(item[field]) || item[field] <= 0) throw invalid();
      safe[field] = item[field];
    }
    if (item.repeatMode !== undefined) {
      if (!["off", "once", "three", "continuous"].includes(item.repeatMode)) throw invalid();
      safe.repeatMode = item.repeatMode;
    }
    for (const field of ["highlights", "melismas"] as const) {
      if (item[field] === undefined) continue;
      if (!Array.isArray(item[field])) throw invalid();
      for (const mark of item[field]) {
        if (!mark || !Number.isInteger(mark.start) || !Number.isInteger(mark.end) ||
            mark.start < 0 || mark.end <= mark.start || mark.end > item.lyrics.length) throw invalid();
        if (field === "highlights" && !["sage", "sky", "rose", "wheat", "lavender"].includes(mark.color)) throw invalid();
        if (field === "melismas" && !["simple", "complex"].includes(mark.kind)) throw invalid();
      }
    }
    safe.highlights = (item.highlights || []).map(({ start, end, color }: Hymn["highlights"][number]) => ({ start, end, color }));
    safe.melismas = (item.melismas || []).map(({ start, end, kind }: Hymn["melismas"][number]) => ({ start, end, kind }));
    // Rendering IDs are independent from published IDs, including old/duplicate IDs.
    return normalizeHymn({ ...safe, id: `shared-hymn-${index}` }, `shared-hymn-${index}`);
  });
  return { title: data.title, hymns, hymnIds };
}

export function selectSharedHymns(published: PublishedSet, hymnId: string | null): Hymn[] {
  if (hymnId === null) return published.hymns;
  const index = published.hymnIds.indexOf(hymnId);
  if (index === -1) throw new Error("Este hino não está mais disponível nesse link. Peça ao autor um link atualizado.");
  return [published.hymns[index]];
}

export async function loadPublishedSet(apiBase: string, path: string, signal?: AbortSignal): Promise<PublishedSet> {
  if (!apiBase) throw new Error("A biblioteca online não está disponível nesta versão do aplicativo.");
  if (!PATH_PATTERN.test(path)) throw new Error("Caminho de conjunto inválido.");
  let response: Response;
  try {
    response = await fetch(`${apiBase}/api/library/item?path=${encodeURIComponent(path)}`, {
      signal, cache: "no-store", credentials: "omit",
    });
  } catch (reason) {
    if (signal?.aborted) throw reason;
    throw new Error("Não foi possível acessar a biblioteca. Confira sua conexão e tente novamente.");
  }
  if (response.status === 404) throw new Error("O conjunto não foi encontrado. Ele pode ter sido excluído pelo autor.");
  if (!response.ok) throw new Error("Não foi possível carregar o conjunto. Tente novamente em instantes.");
  const data: unknown = await response.json().catch(() => { throw new Error("A biblioteca retornou uma resposta inválida. Tente novamente em instantes."); });
  return readPublishedSet(data);
}

// Called only by the explicit “Adicionar ao meu espaço” action. Reading at click
// time also avoids replacing newer local work from another tab with an old copy.
export function addSharedToWorkspace(storage: Pick<Storage, "getItem" | "setItem">, incoming: Hymn[]): number {
  const saved = storage.getItem(WORKSPACE_KEY);
  let current: Hymn[] = [];
  if (saved !== null) {
    try {
      const restored = restoreHymns(JSON.parse(saved));
      if (!restored) throw new Error();
      current = restored;
    } catch {
      throw new Error("O trabalho salvo neste dispositivo não pôde ser lido. Nada foi substituído. Exporte ou recupere seu trabalho antes de adicionar a cópia.");
    }
  }
  const { id: emptyId, ...empty } = newHymn();
  if (current.length === 1) {
    const { id, ...hymn } = current[0];
    if (Object.keys(hymn).length === Object.keys(empty).length &&
        Object.entries(empty).every(([key, value]) => JSON.stringify(hymn[key as keyof typeof hymn]) === JSON.stringify(value))) current = [];
  }
  if (!incoming.length || current.length + incoming.length > 80) {
    throw new Error("A cópia ultrapassaria o limite de 80 hinos. Libere espaço no seu conjunto antes de adicioná-la.");
  }
  const ids = new Set(current.map((hymn) => hymn.id));
  const copies = incoming.map((hymn) => {
    let id = newHymn().id;
    while (ids.has(id)) id = newHymn().id;
    ids.add(id);
    return { ...structuredClone(hymn), id };
  });
  storage.setItem(WORKSPACE_KEY, JSON.stringify({ version: 3, hymns: [...current, ...copies] }));
  return copies.length;
}
