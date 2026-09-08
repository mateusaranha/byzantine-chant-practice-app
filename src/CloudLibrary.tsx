import { useEffect, useMemo, useState } from "react";
import rawCatalog from "../catalog/curated.json";
import type { Hymn } from "./hymnState";
import { libraryItemLabel, nextLibrarySort, sortLibraryItems } from "./librarySort";
import type { LibrarySort } from "./librarySort";
import { readPublishedSet } from "./sharedHymns";
import ShareDialog from "./ShareDialog";
import CuratedLibrary from "./CuratedLibrary";
import { readCuratedCatalog } from "./curatedCatalog";
import type { CuratedCatalog } from "./curatedCatalog";

type GitHubUser = {
  login: string;
  id: number;
  name: string;
  avatarUrl: string;
};

type AccessRequest = {
  number: number;
  login: string;
  requestedAt: string;
  url: string;
};

type SessionInfo = {
  user: GitHubUser;
  isAdmin: boolean;
  isApproved: boolean;
  isPending: boolean;
  publishers?: string[];
  requests?: AccessRequest[];
};

type LibraryItem = {
  owner: string;
  slug: string;
  path: string;
  title?: string;
  updatedAt?: string | null;
};

type LibraryView = "home" | "curated" | "sets";
type SaveDestination = "sets" | "curated" | "both";
type CuratedWrite = { changed: boolean; subcategory: CuratedCatalog["subcategories"][number]; replaced?: boolean; catalog: CuratedCatalog };
type CuratedCategoryWrite = { category: CuratedCatalog["categories"][number]; catalog: CuratedCatalog };
type CuratedSubcategoryWrite = { subcategory: CuratedCatalog["subcategories"][number]; catalog: CuratedCatalog };
type CuratedRemovalWrite = { changed?: boolean; relisted?: boolean; catalog: CuratedCatalog };

const SESSION_KEY = "psaltikon-publisher-session";
const { catalog: initialCuratedCatalog } = readCuratedCatalog(rawCatalog);

function readStoredSession() {
  try {
    return localStorage.getItem(SESSION_KEY) || "";
  } catch {
    return "";
  }
}

function storeSession(value: string) {
  try {
    localStorage.setItem(SESSION_KEY, value);
  } catch {
    // The returned session remains usable in memory for this page.
  }
}

function clearStoredSession() {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    // The in-memory session is still cleared below.
  }
}

function slugify(value: string) {
  return (
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || `conjunto-${new Date().toISOString().slice(0, 10)}`
  );
}

async function api<T>(apiBase: string, path: string, init: RequestInit = {}, token = "") {
  const response = await fetch(`${apiBase}${path}`, {
    ...init,
    headers: {
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Não foi possível concluir a operação.");
  return data as T;
}

export default function CloudLibrary({
  apiBase,
  hymns,
  onLoad,
  onClose,
}: {
  apiBase: string;
  hymns: Hymn[];
  onLoad: (hymns: Partial<Hymn>[], title: string) => void;
  onClose: () => void;
}) {
  const [view, setView] = useState<LibraryView>("home");
  const [token, setToken] = useState("");
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [libraryLoaded, setLibraryLoaded] = useState(false);
  const [collectionName, setCollectionName] = useState("");
  const [savedSlug, setSavedSlug] = useState("");
  const [savedOwner, setSavedOwner] = useState("");
  const [savedPath, setSavedPath] = useState("");
  const [saveDestination, setSaveDestination] = useState<SaveDestination>("sets");
  const [curatedCatalog, setCuratedCatalog] = useState<CuratedCatalog>(initialCuratedCatalog);
  const [curatedCategoryId, setCuratedCategoryId] = useState(() => initialCuratedCatalog.categories[0]?.id || "");
  const [curatedSubcategoryId, setCuratedSubcategoryId] = useState("");
  const [newCategoryOpen, setNewCategoryOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newSubcategoryOpen, setNewSubcategoryOpen] = useState(false);
  const [newSubcategoryName, setNewSubcategoryName] = useState("");
  const [newPublisher, setNewPublisher] = useState("");
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [sharing, setSharing] = useState<{ path: string; trigger: HTMLButtonElement } | null>(null);
  const [librarySort, setLibrarySort] = useState<LibrarySort>({ by: "name", direction: "asc" });

  const grouped = useMemo(() => {
    const groups = new Map<string, LibraryItem[]>();
    items.forEach((item) => groups.set(item.owner, [...(groups.get(item.owner) || []), item]));
    return [...groups.entries()]
      .sort(([ownerA], [ownerB]) => {
        const own = session?.user.login;
        if (ownerA === own) return -1;
        if (ownerB === own) return 1;
        return ownerA.localeCompare(ownerB);
      })
      .map(([owner, ownerItems]) => [owner, sortLibraryItems(ownerItems, librarySort)] as const);
  }, [items, librarySort, session?.user.login]);

  const curatedCategories = curatedCatalog.categories;
  const curatedSubcategories = curatedCatalog.subcategories.filter((subcategory) => subcategory.categoryId === curatedCategoryId);
  const selectedCuratedCategory = curatedCategories.find((category) => category.id === curatedCategoryId);
  const selectedCuratedSubcategory = curatedSubcategories.find((subcategory) => subcategory.id === curatedSubcategoryId);
  const setsEntryLabel = session?.isApproved ? "Meus conjuntos" : "Conjuntos publicados";
  const wantsCurated = session?.isAdmin && saveDestination !== "sets";

  useEffect(() => {
    if (!curatedCategories.some((category) => category.id === curatedCategoryId)) {
      setCuratedCategoryId(curatedCategories[0]?.id || "");
      setCuratedSubcategoryId("");
      setNewSubcategoryOpen(false);
      setNewSubcategoryName("");
      return;
    }
    if (curatedSubcategoryId && !curatedSubcategories.some((subcategory) => subcategory.id === curatedSubcategoryId)) {
      setCuratedSubcategoryId("");
    }
  }, [curatedCatalog, curatedCategoryId, curatedSubcategoryId]);

  function selectCuratedCategory(categoryId: string) {
    setCuratedCategoryId(categoryId);
    setCuratedSubcategoryId("");
    setNewSubcategoryOpen(false);
    setNewSubcategoryName("");
  }

  function toggleLibrarySort(by: LibrarySort["by"]) {
    setLibrarySort((current) => nextLibrarySort(current, by));
  }

  function formattedDate(value?: string | null) {
    if (!value || !Number.isFinite(Date.parse(value))) return "";
    return new Intl.DateTimeFormat("pt-BR").format(new Date(value));
  }

  async function run(label: string, operation: () => Promise<void>) {
    setBusy(label);
    setError("");
    setMessage("");
    try {
      await operation();
    } catch (operationError) {
      setError(operationError instanceof Error ? operationError.message : "Ocorreu um erro.");
    } finally {
      setBusy("");
    }
  }

  async function refreshLibrary() {
    const library = await api<LibraryItem[]>(apiBase, "/api/library");
    setItems(library);
    setLibraryLoaded(true);
  }

  async function refreshSession(sessionToken = token) {
    if (!sessionToken) {
      setSession(null);
      setSessionChecked(true);
      return;
    }
    try {
      const next = await api<SessionInfo>(apiBase, "/api/session", {}, sessionToken);
      setSession(next);
    } catch {
      clearStoredSession();
      setToken("");
      setSession(null);
    } finally {
      setSessionChecked(true);
    }
  }

  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const returnedToken = hash.get("psaltikon_token");
    const initialToken = returnedToken || readStoredSession();
    if (returnedToken) {
      storeSession(returnedToken);
      history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
    }
    setToken(initialToken);
    void refreshSession(initialToken);
  }, []);

  function openSets() {
    setView("sets");
    if (!libraryLoaded) void run("library", refreshLibrary);
  }

  function signIn() {
    window.location.href = `${apiBase}/auth/login`;
  }

  function signOut() {
    clearStoredSession();
    setToken("");
    setSession(null);
    setSaveDestination("sets");
    setMessage("Sessão encerrada neste dispositivo.");
  }

  function requestAccess() {
    void run("request", async () => {
      await api(apiBase, "/api/access/request", { method: "POST" }, token);
      await refreshSession();
      setMessage("Solicitação enviada. Você já pode continuar usando a biblioteca para leitura.");
    });
  }

  async function promoteCurated(path: string, subcategoryId = curatedSubcategoryId, catalog = curatedCatalog) {
    if (!session?.isAdmin) throw new Error("Somente o curador pode adicionar itens à Biblioteca curada.");
    if (!subcategoryId) throw new Error("Escolha a subcategoria da curadoria.");
    const target = catalog.subcategories.find((subcategory) => subcategory.id === subcategoryId);
    if (!target) throw new Error("Subcategoria da Biblioteca curada não encontrada.");

    let replace = false;
    if (target.source?.path && target.source.path !== path) {
      replace = window.confirm(`“${target.label}” já possui outro conjunto associado. Substituir pelo conjunto atual?`);
      if (!replace) return null;
    }

    const result = await api<CuratedWrite>(
      apiBase,
      "/api/curated",
      {
        method: "POST",
        body: JSON.stringify({ path, subcategoryId, replace }),
      },
      token,
    );
    setCuratedCatalog(result.catalog);
    return result;
  }

  function removeCuratedAssociation() {
    const target = selectedCuratedSubcategory;
    if (!target?.source?.path) return;
    if (!window.confirm(`Remover “${target.label}” da Biblioteca curada? O conjunto-base não será apagado.`)) return;
    void run("curated-remove", async () => {
      const result = await api<CuratedRemovalWrite>(
        apiBase,
        `/api/curated?subcategoryId=${encodeURIComponent(target.id)}`,
        { method: "DELETE" },
        token,
      );
      setCuratedCatalog(result.catalog);
      await refreshLibrary();
      setMessage(
        result.relisted
          ? `“${target.label}” foi removida da Biblioteca curada. O conjunto-base foi preservado e voltou a aparecer em Meus conjuntos.`
          : `“${target.label}” foi removida da Biblioteca curada. O conjunto-base foi preservado.`,
      );
    });
  }

  function deleteCuratedSubcategory() {
    const target = selectedCuratedSubcategory;
    if (!target || target.source?.path) return;
    if (!window.confirm(`Excluir a subcategoria vazia “${target.label}”?`)) return;
    void run("curated-subcategory-delete", async () => {
      const result = await api<CuratedRemovalWrite>(
        apiBase,
        `/api/curated/subcategories?id=${encodeURIComponent(target.id)}`,
        { method: "DELETE" },
        token,
      );
      setCuratedCatalog(result.catalog);
      setCuratedSubcategoryId("");
      setMessage(`Subcategoria “${target.label}” excluída.`);
    });
  }

  function deleteCuratedCategory() {
    const target = selectedCuratedCategory;
    if (!target || curatedSubcategories.length) return;
    if (!window.confirm(`Excluir a categoria vazia “${target.label}”?`)) return;
    void run("curated-category-delete", async () => {
      const result = await api<CuratedRemovalWrite>(
        apiBase,
        `/api/curated/categories?id=${encodeURIComponent(target.id)}`,
        { method: "DELETE" },
        token,
      );
      setCuratedCatalog(result.catalog);
      setCuratedCategoryId(result.catalog.categories[0]?.id || "");
      setCuratedSubcategoryId("");
      setMessage(`Categoria “${target.label}” excluída.`);
    });
  }

  function createCategory() {
    const label = newCategoryName.trim();
    if (!label) return;
    void run("curated-category", async () => {
      const result = await api<CuratedCategoryWrite>(
        apiBase,
        "/api/curated/categories",
        { method: "POST", body: JSON.stringify({ label }) },
        token,
      );
      setCuratedCatalog(result.catalog);
      setCuratedCategoryId(result.category.id);
      setCuratedSubcategoryId("");
      setNewCategoryName("");
      setNewCategoryOpen(false);
      setNewSubcategoryOpen(true);
      setMessage(`Categoria “${result.category.label}” criada. Agora adicione uma subcategoria.`);
    });
  }

  async function createCuratedSubcategory(label: string) {
    if (!label || !curatedCategoryId) throw new Error("Escolha uma categoria e informe o nome da nova subcategoria.");
    const result = await api<CuratedSubcategoryWrite>(
      apiBase,
      "/api/curated/subcategories",
      { method: "POST", body: JSON.stringify({ label, categoryId: curatedCategoryId }) },
      token,
    );
    setCuratedCatalog(result.catalog);
    setCuratedSubcategoryId(result.subcategory.id);
    setNewSubcategoryName("");
    setNewSubcategoryOpen(false);
    return result;
  }

  async function publishBase(name: string, slug: string, listed: boolean) {
    return api<{ path: string }>(
      apiBase,
      "/api/sets",
      { method: "POST", body: JSON.stringify({ title: name, slug, hymns, listed }) },
      token,
    );
  }

  function saveSet() {
    const name = collectionName.trim();
    if (!name) {
      setError("Informe um nome para o conjunto.");
      return;
    }
    if (wantsCurated && !curatedCategoryId) {
      setError("Escolha ou crie uma categoria para a Biblioteca curada.");
      return;
    }
    if (wantsCurated && !curatedSubcategoryId && !(newSubcategoryOpen && newSubcategoryName.trim())) {
      setError("Escolha uma subcategoria desta categoria ou informe o nome de uma nova subcategoria.");
      return;
    }
    const updatesOwnSet = Boolean(savedSlug && savedOwner === session?.user.login);
    const slug = updatesOwnSet ? savedSlug : slugify(name);
    void run("save", async () => {
      // Curated-only starts listed as a safe fallback. It is hidden only after promotion succeeds.
      const saved = await publishBase(name, slug, true);
      setSavedSlug(slug);
      setSavedOwner(session?.user.login || "");
      setSavedPath(saved.path);

      if (wantsCurated) {
        try {
          let targetSubcategoryId = curatedSubcategoryId;
          let promotionCatalog = curatedCatalog;
          if (newSubcategoryOpen) {
            const created = await createCuratedSubcategory(newSubcategoryName.trim());
            targetSubcategoryId = created.subcategory.id;
            promotionCatalog = created.catalog;
          }
          const promotion = await promoteCurated(saved.path, targetSubcategoryId, promotionCatalog);
          if (!promotion) {
            setMessage("Conjunto salvo em Meus conjuntos; a associação da Biblioteca curada não foi alterada.");
            await refreshLibrary();
            return;
          }
          if (saveDestination === "curated") {
            try {
              await publishBase(name, slug, false);
            } catch (hideError) {
              const detail = hideError instanceof Error ? hideError.message : "Não foi possível ocultar o conjunto da lista.";
              setError(`O conjunto foi associado à Biblioteca curada, mas também continua em Meus conjuntos. ${detail}`);
              await refreshLibrary();
              return;
            }
          }
          setMessage(
            saveDestination === "curated"
              ? "Salvo somente na Biblioteca curada. O conjunto inteiro foi associado sem duplicar o conteúdo-base nem ser listado em Meus conjuntos."
              : promotion.changed
                ? "Conjunto salvo e associado à Biblioteca curada."
                : "Conjunto salvo. Ele já estava associado a essa subcategoria da Biblioteca curada.",
          );
        } catch (promotionError) {
          const detail = promotionError instanceof Error ? promotionError.message : "Não foi possível atualizar a curadoria.";
          setError(`O conteúdo foi preservado em Meus conjuntos, mas a curadoria não foi alterada. ${detail}`);
        }
      } else {
        setMessage("Conjunto salvo em Meus conjuntos. O histórico anterior foi preservado.");
      }
      await refreshLibrary();
    });
  }

  function loadSet(item: LibraryItem) {
    void run(`load:${item.path}`, async () => {
      const saved = await api<unknown>(apiBase, `/api/library/item?path=${encodeURIComponent(item.path)}`);
      const published = readPublishedSet(saved);
      if (!window.confirm(`Substituir o espaço atual pelo conjunto “${published.title}”?`)) return;
      onLoad(published.hymns, published.title);
      setCollectionName(published.title);
      setSavedSlug(item.slug);
      setSavedOwner(item.owner);
      setSavedPath(item.path);
      setMessage(`“${published.title}” foi carregado no espaço de trabalho atual.`);
    });
  }

  function deleteSet(item: LibraryItem) {
    if (!window.confirm(`Excluir “${libraryItemLabel(item)}” da biblioteca do GitHub?`)) return;
    void run(`delete:${item.path}`, async () => {
      await api(apiBase, `/api/sets?path=${encodeURIComponent(item.path)}`, { method: "DELETE" }, token);
      await refreshLibrary();
      setMessage("Conjunto excluído da biblioteca. O histórico ainda pode ser recuperado pelo GitHub.");
    });
  }

  function adminAction(action: "approve" | "reject" | "add" | "revoke", payload: object) {
    void run(`admin:${action}`, async () => {
      await api(
        apiBase,
        `/api/admin/${action}`,
        { method: "POST", body: JSON.stringify(payload) },
        token,
      );
      await refreshSession();
      if (action === "add") setNewPublisher("");
      setMessage("Lista de publicação atualizada.");
    });
  }

  const canDelete = (item: LibraryItem) =>
    Boolean(session?.isApproved && (session.isAdmin || item.owner === session.user.login));
  const updatesOwnSet = Boolean(savedSlug && savedOwner === session?.user.login);
  const curatedTargetReady = !wantsCurated || Boolean(
    curatedCategoryId && (curatedSubcategoryId || (newSubcategoryOpen && newSubcategoryName.trim())),
  );
  const curatedSaveLabel = newSubcategoryOpen && newSubcategoryName.trim()
    ? `Criar “${newSubcategoryName.trim()}” e adicionar conjunto`
    : selectedCuratedSubcategory?.source?.path
      ? `Atualizar conjunto de “${selectedCuratedSubcategory.label}”`
      : selectedCuratedSubcategory
        ? `Adicionar conjunto a “${selectedCuratedSubcategory.label}”`
        : "Escolha uma subcategoria";

  return (
    <section className="cloud-library" aria-label="Biblioteca pública">
      <div className="cloud-library-heading">
        <div>
          <p className="eyebrow">Biblioteca pública</p>
          <h2>Biblioteca pública</h2>
          <p>
            {view === "home"
              ? "Escolha uma área para explorar. Os detalhes aparecem somente depois da sua escolha."
              : view === "curated"
                ? "Explore a seleção por categorias e abra cada material completo pela subcategoria."
                : "Abra conjuntos publicados ou gerencie suas publicações."}
          </p>
        </div>
        <button className="cloud-close" onClick={onClose} aria-label="Fechar biblioteca">×</button>
      </div>

      {(message || error) && (
        <div className={`cloud-notice ${error ? "error" : "success"}`} role="status">
          {error || message}
        </div>
      )}

      {sharing && <ShareDialog apiBase={apiBase} path={sharing.path} trigger={sharing.trigger} onClose={() => setSharing(null)} />}

      {view === "home" ? (
        <div className="library-entry-grid" aria-label="Áreas da Biblioteca pública">
          <button className="library-entry-card" onClick={() => setView("curated")}>
            <span className="library-entry-kicker">Seleção por tema</span>
            <strong>Biblioteca curada</strong>
            <small>Materiais completos organizados por categorias e subcategorias.</small>
            <span className="library-entry-arrow" aria-hidden="true">→</span>
          </button>
          <button className="library-entry-card" onClick={openSets}>
            <span className="library-entry-kicker">Publicações</span>
            <strong>{setsEntryLabel}</strong>
            <small>
              {session?.isApproved
                ? "Acesse seus conjuntos e os materiais publicados por outros autores."
                : "Explore os conjuntos publicados pelos autores."}
            </small>
            <span className="library-entry-arrow" aria-hidden="true">→</span>
          </button>
        </div>
      ) : (
        <button className="cloud-secondary library-back" onClick={() => setView("home")}>
          ← Biblioteca pública
        </button>
      )}

      {view === "curated" && <CuratedLibrary apiBase={apiBase} catalogOverride={curatedCatalog} />}

      {view === "sets" && (
        <>
          <div className="cloud-library-grid">
            <div className="cloud-card">
              <div className="cloud-card-title">
                <div>
                  <span>{session?.isApproved ? "Meus conjuntos e publicados" : "Conjuntos publicados"}</span>
                  <p>
                    {session?.isApproved
                      ? "Seus conjuntos aparecem primeiro; os demais autores continuam disponíveis abaixo."
                      : "Escolha um autor e carregue uma cópia no seu dispositivo."}
                  </p>
                </div>
                <button className="cloud-secondary" onClick={() => void run("library", refreshLibrary)} disabled={Boolean(busy)}>
                  Atualizar lista
                </button>
              </div>
              <div className="library-sort-controls" role="group" aria-label="Ordenar conjuntos">
                <span>Ordenar por</span>
                <button
                  className={`cloud-secondary ${librarySort.by === "name" ? "active" : ""}`}
                  aria-pressed={librarySort.by === "name"}
                  onClick={() => toggleLibrarySort("name")}
                >
                  Nome: {librarySort.by === "name" && librarySort.direction === "desc" ? "Z–A" : "A–Z"}
                </button>
                <button
                  className={`cloud-secondary ${librarySort.by === "updatedAt" ? "active" : ""}`}
                  aria-pressed={librarySort.by === "updatedAt"}
                  onClick={() => toggleLibrarySort("updatedAt")}
                >
                  Atualização: {librarySort.by === "updatedAt" && librarySort.direction === "asc" ? "antigas" : "recentes"}
                </button>
              </div>
              {busy === "library" ? (
                <p className="cloud-empty">Buscando conjuntos…</p>
              ) : grouped.length ? (
                <div className="cloud-groups" role="region" aria-label="Lista de conjuntos publicados" tabIndex={0}>
                  {grouped.map(([owner, ownerItems]) => (
                    <div className="cloud-group" key={owner}>
                      <h3>{owner === session?.user.login ? `Meus conjuntos · @${owner}` : `@${owner}`}</h3>
                      {ownerItems.map((item) => (
                        <div className="cloud-set-row" key={item.path}>
                          <span className="cloud-set-copy">
                            <strong>{libraryItemLabel(item)}</strong>
                            {formattedDate(item.updatedAt) && (
                              <time dateTime={item.updatedAt || undefined}>Atualizado em {formattedDate(item.updatedAt)}</time>
                            )}
                          </span>
                          <div>
                            <button onClick={() => loadSet(item)} disabled={Boolean(busy)}>Abrir</button>
                            <button onClick={(event) => setSharing({ path: item.path, trigger: event.currentTarget })} disabled={Boolean(busy)} aria-haspopup="dialog">
                              Compartilhar
                            </button>
                            {canDelete(item) && (
                              <button className="danger" onClick={() => deleteSet(item)} disabled={Boolean(busy)}>Excluir</button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              ) : libraryLoaded ? (
                <p className="cloud-empty">Ainda não há conjuntos publicados.</p>
              ) : (
                <p className="cloud-empty">Buscando conjuntos…</p>
              )}
            </div>

            <div className="cloud-card account-card">
              <span>Publicar no GitHub</span>
              {!sessionChecked ? (
                <p className="cloud-empty">Verificando sessão…</p>
              ) : !session ? (
                <>
                  <p>Entre com o GitHub para solicitar permissão ou publicar na sua pasta.</p>
                  <button className="cloud-primary" onClick={signIn}>Entrar com GitHub</button>
                </>
              ) : (
                <>
                  <div className="github-identity">
                    {session.user.avatarUrl && <img src={session.user.avatarUrl} alt="" />}
                    <div><strong>{session.user.name}</strong><span>@{session.user.login}</span></div>
                    <button onClick={signOut}>Sair</button>
                  </div>
                  {session.isApproved ? (
                    <div className="publish-form">
                      <label>
                        Nome do conjunto
                        <input
                          value={collectionName}
                          onChange={(event) => setCollectionName(event.target.value)}
                          placeholder="Ex.: Dormição da Theotokos"
                        />
                      </label>
                      <p>O conjunto-base contém os {hymns.length} hinos que estão abertos agora.</p>

                      {session.isAdmin && (
                        <fieldset className="save-destination">
                          <legend>Salvar em</legend>
                          {([
                            ["sets", "Meus conjuntos"],
                            ["curated", "Biblioteca curada"],
                            ["both", "Ambos"],
                          ] as [SaveDestination, string][]).map(([value, label]) => (
                            <label key={value}>
                              <input
                                type="radio"
                                name="save-destination"
                                value={value}
                                checked={saveDestination === value}
                                onChange={() => setSaveDestination(value)}
                              />
                              <span>{label}</span>
                            </label>
                          ))}
                        </fieldset>
                      )}

                      {wantsCurated && (
                        <div className="curation-publish">
                          <div className="curation-field-row">
                            <label>
                              Categoria
                              <select value={curatedCategoryId} onChange={(event) => selectCuratedCategory(event.target.value)}>
                                <option value="">Selecione</option>
                                {curatedCategories.map((category) => (
                                  <option key={category.id} value={category.id}>{category.label}</option>
                                ))}
                              </select>
                            </label>
                            <button className="cloud-secondary" type="button" onClick={() => setNewCategoryOpen((open) => !open)}>+ Nova categoria</button>
                          </div>
                          {newCategoryOpen && (
                            <div className="curation-create-row">
                              <input value={newCategoryName} onChange={(event) => setNewCategoryName(event.target.value)} placeholder="Ex.: Grandes Festas" />
                              <button className="cloud-secondary" type="button" onClick={createCategory} disabled={!newCategoryName.trim() || Boolean(busy)}>Criar</button>
                            </div>
                          )}
                          {selectedCuratedCategory && curatedSubcategories.length === 0 && !newCategoryOpen && !newSubcategoryOpen && (
                            <div className="curation-management-actions">
                              <button className="cloud-secondary danger" type="button" onClick={deleteCuratedCategory} disabled={Boolean(busy)}>
                                Excluir categoria vazia
                              </button>
                            </div>
                          )}

                          <div className="curation-field-row">
                            <label>
                              {selectedCuratedCategory ? `Subcategoria em “${selectedCuratedCategory.label}”` : "Subcategoria"}
                              <select
                                value={curatedSubcategoryId}
                                onChange={(event) => {
                                  setCuratedSubcategoryId(event.target.value);
                                  setNewSubcategoryOpen(false);
                                  setNewSubcategoryName("");
                                }}
                                disabled={!curatedCategoryId || newSubcategoryOpen}
                              >
                                <option value="">Selecione</option>
                                {curatedSubcategories.map((subcategory) => (
                                  <option key={subcategory.id} value={subcategory.id}>{subcategory.label}</option>
                                ))}
                              </select>
                            </label>
                            <button
                              className="cloud-secondary"
                              type="button"
                              onClick={() => {
                                const opening = !newSubcategoryOpen;
                                setNewSubcategoryOpen(opening);
                                setNewSubcategoryName("");
                                if (opening) setCuratedSubcategoryId("");
                              }}
                              disabled={!curatedCategoryId}
                            >
                              + Nova subcategoria
                            </button>
                          </div>
                          {newSubcategoryOpen && selectedCuratedCategory && (
                            <div className="curation-create-context">
                              <span>Nova subcategoria em <strong>“{selectedCuratedCategory.label}”</strong></span>
                              <div className="curation-create-row">
                                <input
                                  value={newSubcategoryName}
                                  onChange={(event) => setNewSubcategoryName(event.target.value)}
                                  placeholder="Ex.: Dormição da Theotokos"
                                  aria-label={`Nova subcategoria em ${selectedCuratedCategory.label}`}
                                />
                                <button
                                  className="cloud-secondary"
                                  type="button"
                                  onClick={() => {
                                    setNewSubcategoryOpen(false);
                                    setNewSubcategoryName("");
                                  }}
                                >
                                  Cancelar
                                </button>
                              </div>
                            </div>
                          )}
                          <p className="curation-set-note">
                            {newSubcategoryOpen && selectedCuratedCategory
                              ? newSubcategoryName.trim()
                                ? `Ao salvar, “${newSubcategoryName.trim()}” será criada dentro de “${selectedCuratedCategory.label}” e receberá o conjunto inteiro.`
                                : `Informe o nome da nova subcategoria de “${selectedCuratedCategory.label}”.`
                              : selectedCuratedSubcategory?.source?.path
                                ? `“${selectedCuratedSubcategory.label}” já possui um conjunto associado. Salvar atualizará essa subcategoria com o conjunto atualmente aberto.`
                                : selectedCuratedSubcategory
                                  ? `“${selectedCuratedSubcategory.label}” ainda não possui conjunto. O conjunto inteiro, com os ${hymns.length} hinos abertos, será associado a ela.`
                                  : selectedCuratedCategory
                                    ? `Escolha uma subcategoria de “${selectedCuratedCategory.label}” ou crie uma nova.`
                                    : "Escolha primeiro uma categoria."
                            }
                          </p>
                          {selectedCuratedSubcategory && !newSubcategoryOpen && (
                            <div className="curation-management-actions">
                              {selectedCuratedSubcategory.source?.path ? (
                                <button className="cloud-secondary danger" type="button" onClick={removeCuratedAssociation} disabled={Boolean(busy)}>
                                  Remover da Biblioteca curada
                                </button>
                              ) : (
                                <button className="cloud-secondary danger" type="button" onClick={deleteCuratedSubcategory} disabled={Boolean(busy)}>
                                  Excluir subcategoria vazia
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      <button className="cloud-primary" onClick={saveSet} disabled={Boolean(busy) || !curatedTargetReady}>
                        {busy === "save"
                          ? "Salvando…"
                          : wantsCurated
                            ? curatedSaveLabel
                            : updatesOwnSet
                              ? "Atualizar publicação"
                              : savedSlug
                                ? "Salvar uma cópia"
                                : "Salvar"}
                      </button>
                      {updatesOwnSet && (
                        <button
                          className="cloud-secondary"
                          onClick={() => {
                            setSavedSlug("");
                            setSavedOwner("");
                            setSavedPath("");
                            setCollectionName("");
                            setSaveDestination("sets");
                          }}
                        >
                          Salvar como novo conjunto
                        </button>
                      )}
                    </div>
                  ) : session.isPending ? (
                    <p className="pending-status">Sua solicitação está aguardando aprovação de @{session.isAdmin ? session.user.login : "mateusaranha"}.</p>
                  ) : (
                    <button className="cloud-primary" onClick={requestAccess} disabled={Boolean(busy)}>
                      Solicitar permissão para publicar
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          {session?.isAdmin && (
            <div className="cloud-card admin-card">
              <div className="cloud-card-title">
                <div><span>Administrar usuários</span><p>Somente @{session.user.login} vê esta área.</p></div>
              </div>
              <div className="admin-columns">
                <div>
                  <h3>Solicitações pendentes</h3>
                  {session.requests?.length ? session.requests.map((request) => (
                    <div className="admin-row" key={request.number}>
                      <span>@{request.login}</span>
                      <div>
                        <button onClick={() => adminAction("approve", request)}>Aprovar</button>
                        <button className="danger" onClick={() => adminAction("reject", request)}>Recusar</button>
                      </div>
                    </div>
                  )) : <p className="cloud-empty">Nenhuma solicitação pendente.</p>}
                </div>
                <div>
                  <h3>Usuários aprovados</h3>
                  {session.publishers?.map((login) => (
                    <div className="admin-row" key={login}>
                      <span>@{login}</span>
                      {login !== session.user.login && (
                        <button className="danger" onClick={() => adminAction("revoke", { login })}>Revogar</button>
                      )}
                    </div>
                  ))}
                  <div className="admin-add">
                    <input value={newPublisher} onChange={(event) => setNewPublisher(event.target.value)} placeholder="nome de usuário do GitHub" />
                    <button onClick={() => adminAction("add", { login: newPublisher })} disabled={!newPublisher.trim()}>Adicionar</button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
