import { useEffect, useMemo, useState } from "react";
import type { Hymn } from "./App";

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
};

type SavedSet = {
  version: number;
  title: string;
  owner: GitHubUser;
  updatedAt: string;
  hymns: Partial<Hymn>[];
};

const SESSION_KEY = "psaltikon-publisher-session";

function displaySlug(value: string) {
  const words = value.replace(/-/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
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
  const [token, setToken] = useState("");
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [collectionName, setCollectionName] = useState("");
  const [savedSlug, setSavedSlug] = useState("");
  const [savedOwner, setSavedOwner] = useState("");
  const [newPublisher, setNewPublisher] = useState("");
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const grouped = useMemo(() => {
    const groups = new Map<string, LibraryItem[]>();
    items.forEach((item) => groups.set(item.owner, [...(groups.get(item.owner) || []), item]));
    return [...groups.entries()];
  }, [items]);

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
      localStorage.removeItem(SESSION_KEY);
      setToken("");
      setSession(null);
    } finally {
      setSessionChecked(true);
    }
  }

  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const returnedToken = hash.get("psaltikon_token");
    const initialToken = returnedToken || localStorage.getItem(SESSION_KEY) || "";
    if (returnedToken) {
      localStorage.setItem(SESSION_KEY, returnedToken);
      history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
    }
    setToken(initialToken);
    void refreshSession(initialToken);
    void run("library", refreshLibrary);
  }, []);

  function signIn() {
    window.location.href = `${apiBase}/auth/login`;
  }

  function signOut() {
    localStorage.removeItem(SESSION_KEY);
    setToken("");
    setSession(null);
    setMessage("Sessão encerrada neste dispositivo.");
  }

  function requestAccess() {
    void run("request", async () => {
      await api(apiBase, "/api/access/request", { method: "POST" }, token);
      await refreshSession();
      setMessage("Solicitação enviada. Você já pode continuar usando a biblioteca para leitura.");
    });
  }

  function saveSet() {
    const name = collectionName.trim();
    if (!name) {
      setError("Informe um nome para o conjunto.");
      return;
    }
    const updatesOwnSet = Boolean(savedSlug && savedOwner === session?.user.login);
    const slug = updatesOwnSet ? savedSlug : slugify(name);
    void run("save", async () => {
      await api(
        apiBase,
        "/api/sets",
        { method: "POST", body: JSON.stringify({ title: name, slug, hymns }) },
        token,
      );
      setSavedSlug(slug);
      setSavedOwner(session?.user.login || "");
      await refreshLibrary();
      setMessage("Conjunto salvo no GitHub. O histórico anterior foi preservado.");
    });
  }

  function loadSet(item: LibraryItem) {
    void run(`load:${item.path}`, async () => {
      const saved = await api<SavedSet>(apiBase, `/api/library/item?path=${encodeURIComponent(item.path)}`);
      if (!Array.isArray(saved.hymns) || !saved.hymns.length) throw new Error("Esse conjunto não contém hinos.");
      if (!window.confirm(`Substituir o espaço atual pelo conjunto “${saved.title}”?`)) return;
      onLoad(saved.hymns, saved.title);
      setCollectionName(saved.title);
      setSavedSlug(item.slug);
      setSavedOwner(item.owner);
      setMessage(`“${saved.title}” foi carregado e também ficou salvo neste dispositivo.`);
    });
  }

  function deleteSet(item: LibraryItem) {
    if (!window.confirm(`Excluir “${displaySlug(item.slug)}” da biblioteca do GitHub?`)) return;
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

  return (
    <section className="cloud-library" aria-label="Biblioteca online de conjuntos">
      <div className="cloud-library-heading">
        <div>
          <p className="eyebrow">Biblioteca no GitHub</p>
          <h2>Conjuntos de hinos salvos</h2>
          <p>
            Cada autor publica na própria pasta. Qualquer pessoa pode carregar um conjunto; somente contas aprovadas podem salvar.
          </p>
        </div>
        <button className="cloud-close" onClick={onClose} aria-label="Fechar biblioteca">×</button>
      </div>

      {(message || error) && (
        <div className={`cloud-notice ${error ? "error" : "success"}`} role="status">
          {error || message}
        </div>
      )}

      <div className="cloud-library-grid">
        <div className="cloud-card">
          <div className="cloud-card-title">
            <div>
              <span>Buscar hinos salvos</span>
              <p>Escolha um autor e carregue uma cópia no seu dispositivo.</p>
            </div>
            <button className="cloud-secondary" onClick={() => void run("library", refreshLibrary)} disabled={Boolean(busy)}>
              Atualizar lista
            </button>
          </div>
          {busy === "library" ? (
            <p className="cloud-empty">Buscando conjuntos…</p>
          ) : grouped.length ? (
            <div className="cloud-groups">
              {grouped.map(([owner, ownerItems]) => (
                <div className="cloud-group" key={owner}>
                  <h3>@{owner}</h3>
                  {ownerItems.map((item) => (
                    <div className="cloud-set-row" key={item.path}>
                      <span>{displaySlug(item.slug)}</span>
                      <div>
                        <button onClick={() => loadSet(item)} disabled={Boolean(busy)}>Abrir</button>
                        {canDelete(item) && (
                          <button className="danger" onClick={() => deleteSet(item)} disabled={Boolean(busy)}>Excluir</button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ) : (
            <p className="cloud-empty">Ainda não há conjuntos publicados.</p>
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
                      onChange={(event) => {
                        setCollectionName(event.target.value);
                        if (!savedSlug) setSavedSlug("");
                      }}
                      placeholder="Ex.: Dormição da Theotokos"
                    />
                  </label>
                  <p>Serão publicados os {hymns.length} hinos que estão abertos agora.</p>
                  <button className="cloud-primary" onClick={saveSet} disabled={Boolean(busy)}>
                    {busy === "save"
                      ? "Salvando…"
                      : updatesOwnSet
                        ? "Atualizar conjunto no GitHub"
                        : savedSlug
                          ? "Salvar uma cópia na minha pasta"
                          : "Salvar conjunto no GitHub"}
                  </button>
                  {updatesOwnSet && (
                    <button className="cloud-secondary" onClick={() => { setSavedSlug(""); setSavedOwner(""); setCollectionName(""); }}>
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
                <input value={newPublisher} onChange={(event) => setNewPublisher(event.target.value)} placeholder="login do GitHub" />
                <button onClick={() => adminAction("add", { login: newPublisher })} disabled={!newPublisher.trim()}>Adicionar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
