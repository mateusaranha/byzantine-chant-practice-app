const API_VERSION = "2022-11-28";
const CONFIG_PATH = "config/approved-users.json";
const REQUEST_PREFIX = "[Psaltikon access] ";
const SESSION_SECONDS = 8 * 60 * 60;
const MAX_SET_BYTES = 1_500_000;
const MAX_HYMNS = 80;
const HYMN_PATH_PATTERN = /^hinos\/([a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38})\/([a-z0-9][a-z0-9-]{0,79})\.json$/;

let installationTokenCache = null;
let approvedUsersCache = null;

function sessionSigningSecret(env) {
  return `psaltikon-session-v1:${env.GITHUB_CLIENT_SECRET}`;
}

export function normalizeLogin(value) {
  return String(value || "").trim().toLowerCase();
}

export function slugify(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72) || `conjunto-${new Date().toISOString().slice(0, 10)}`;
}

export function isOwnedHymnPath(path, login) {
  const normalizedLogin = normalizeLogin(login);
  const match = String(path || "").match(HYMN_PATH_PATTERN);
  return Boolean(match && match[1] === normalizedLogin);
}

export function isHymnPath(path) {
  return HYMN_PATH_PATTERN.test(String(path || ""));
}

export function validateHymnSet(value) {
  if (!value || typeof value !== "object") throw new HttpError(400, "Conjunto inválido.");
  const title = String(value.title || "").trim().slice(0, 120);
  if (!title) throw new HttpError(400, "Informe um nome para o conjunto.");
  const slug = slugify(value.slug || title);
  if (!Array.isArray(value.hymns) || value.hymns.length < 1 || value.hymns.length > MAX_HYMNS) {
    throw new HttpError(400, `O conjunto deve ter entre 1 e ${MAX_HYMNS} hinos.`);
  }
  const serialized = JSON.stringify(value.hymns);
  if (new TextEncoder().encode(serialized).byteLength > MAX_SET_BYTES) {
    throw new HttpError(413, "O conjunto é grande demais para ser publicado.");
  }
  return { title, slug, hymns: value.hymns };
}

export function normalizeLibraryMetadata(value) {
  if (!value || typeof value !== "object") return { title: "", updatedAt: null };
  const title = String(value.title || "").trim().slice(0, 120);
  const rawUpdatedAt = typeof value.updatedAt === "string" ? value.updatedAt.trim() : "";
  const timestamp = Date.parse(rawUpdatedAt);
  const updatedAt = rawUpdatedAt && Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
  return { title, updatedAt };
}

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function bytesToBase64Url(bytes) {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToBytes(value) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(base64);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function utf8ToBase64(value) {
  return bytesToBase64Url(new TextEncoder().encode(value))
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(Math.ceil(new TextEncoder().encode(value).length / 3) * 4, "=");
}

function base64ToUtf8(value) {
  const binary = atob(value.replace(/\s/g, ""));
  return new TextDecoder().decode(Uint8Array.from(binary, (character) => character.charCodeAt(0)));
}

async function hmac(value, secret) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value)));
}

async function signSession(payload, secret) {
  const encoded = bytesToBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const signature = bytesToBase64Url(await hmac(encoded, secret));
  return `${encoded}.${signature}`;
}

async function verifySession(token, secret, expectedKind = "session") {
  if (!token || !secret) throw new HttpError(401, "Entre com o GitHub para continuar.");
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) throw new HttpError(401, "Sessão inválida.");
  const expected = await hmac(encoded, secret);
  const received = base64UrlToBytes(signature);
  if (expected.length !== received.length) throw new HttpError(401, "Sessão inválida.");
  let difference = 0;
  for (let index = 0; index < expected.length; index += 1) difference |= expected[index] ^ received[index];
  if (difference !== 0) throw new HttpError(401, "Sessão inválida.");
  const payload = JSON.parse(new TextDecoder().decode(base64UrlToBytes(encoded)));
  if (payload.kind !== expectedKind || !payload.exp || payload.exp < Math.floor(Date.now() / 1000)) {
    throw new HttpError(401, "A sessão expirou. Entre novamente.");
  }
  return payload;
}

function derLength(length) {
  if (length < 128) return Uint8Array.of(length);
  const bytes = [];
  let remaining = length;
  while (remaining > 0) {
    bytes.unshift(remaining & 0xff);
    remaining >>= 8;
  }
  return Uint8Array.of(0x80 | bytes.length, ...bytes);
}

function der(tag, content) {
  return Uint8Array.of(tag, ...derLength(content.length), ...content);
}

function concatBytes(...parts) {
  const result = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

function privateKeyBytes(pem) {
  const compact = pem.replace(/-----BEGIN [^-]+-----|-----END [^-]+-----|\s/g, "");
  const raw = Uint8Array.from(atob(compact), (character) => character.charCodeAt(0));
  if (pem.includes("BEGIN PRIVATE KEY")) return raw;
  if (!pem.includes("BEGIN RSA PRIVATE KEY")) throw new Error("Formato de chave privada não reconhecido.");
  const version = Uint8Array.of(0x02, 0x01, 0x00);
  const rsaAlgorithm = Uint8Array.of(
    0x30, 0x0d, 0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01, 0x05, 0x00,
  );
  return der(0x30, concatBytes(version, rsaAlgorithm, der(0x04, raw)));
}

async function githubAppJwt(env) {
  const now = Math.floor(Date.now() / 1000);
  const header = bytesToBase64Url(new TextEncoder().encode(JSON.stringify({ alg: "RS256", typ: "JWT" })));
  const payload = bytesToBase64Url(
    new TextEncoder().encode(JSON.stringify({ iat: now - 60, exp: now + 9 * 60, iss: env.GITHUB_APP_ID })),
  );
  const unsigned = `${header}.${payload}`;
  const key = await crypto.subtle.importKey(
    "pkcs8",
    privateKeyBytes(env.GITHUB_PRIVATE_KEY),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned));
  return `${unsigned}.${bytesToBase64Url(new Uint8Array(signature))}`;
}

async function installationToken(env) {
  const now = Date.now();
  if (installationTokenCache?.expiresAt > now + 60_000) return installationTokenCache.token;
  const response = await fetch(
    `https://api.github.com/app/installations/${encodeURIComponent(env.GITHUB_INSTALLATION_ID)}/access_tokens`,
    {
      method: "POST",
      headers: githubHeaders(await githubAppJwt(env)),
    },
  );
  const data = await response.json();
  if (!response.ok || !data.token) throw new Error(`Não foi possível autenticar o aplicativo no GitHub (${response.status}).`);
  installationTokenCache = { token: data.token, expiresAt: Date.parse(data.expires_at) };
  return data.token;
}

function githubHeaders(token, extra = {}) {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "X-GitHub-Api-Version": API_VERSION,
    "User-Agent": "Psaltikon-Publisher",
    ...extra,
  };
}

async function github(env, path, init = {}) {
  const token = await installationToken(env);
  const response = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: githubHeaders(token, init.headers || {}),
  });
  if (response.status === 204) return null;
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.message || `GitHub respondeu com ${response.status}.`);
    error.githubStatus = response.status;
    throw error;
  }
  return data;
}

function repoPath(env, suffix) {
  return `/repos/${encodeURIComponent(env.GITHUB_OWNER)}/${encodeURIComponent(env.GITHUB_REPO)}${suffix}`;
}

async function readRepoJson(env, path) {
  try {
    const file = await github(env, repoPath(env, `/contents/${path}?ref=main`));
    return { data: JSON.parse(base64ToUtf8(file.content)), sha: file.sha };
  } catch (error) {
    if (error.githubStatus === 404) return null;
    throw error;
  }
}

async function writeRepoJson(env, path, value, message) {
  const existing = await readRepoJson(env, path);
  const body = {
    message,
    branch: "main",
    content: utf8ToBase64(`${JSON.stringify(value, null, 2)}\n`),
    ...(existing?.sha ? { sha: existing.sha } : {}),
  };
  const result = await github(env, repoPath(env, `/contents/${path}`), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return result.content;
}

async function deleteRepoFile(env, path, message) {
  const existing = await readRepoJson(env, path);
  if (!existing) throw new HttpError(404, "Conjunto não encontrado.");
  await github(env, repoPath(env, `/contents/${path}`), {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, branch: "main", sha: existing.sha }),
  });
}

async function approvedConfig(env, force = false) {
  if (!force && approvedUsersCache?.expiresAt > Date.now()) return approvedUsersCache.value;
  const stored = await readRepoJson(env, CONFIG_PATH);
  const admin = normalizeLogin(stored?.data?.admin || env.ADMIN_LOGIN);
  const publishers = [...new Set([admin, ...(stored?.data?.publishers || []).map(normalizeLogin)].filter(Boolean))];
  const value = { admin, publishers };
  approvedUsersCache = { value, expiresAt: Date.now() + 30_000 };
  return value;
}

async function updatePublishers(env, mutate, message) {
  const current = await approvedConfig(env, true);
  const publishers = [...new Set(mutate([...current.publishers]).map(normalizeLogin).filter(Boolean))].sort();
  if (!publishers.includes(current.admin)) publishers.unshift(current.admin);
  const next = { version: 1, admin: current.admin, publishers, updatedAt: new Date().toISOString() };
  await writeRepoJson(env, CONFIG_PATH, next, message);
  approvedUsersCache = { value: { admin: next.admin, publishers: next.publishers }, expiresAt: Date.now() + 30_000 };
  return next;
}

function bearer(request) {
  const header = request.headers.get("Authorization") || "";
  return header.startsWith("Bearer ") ? header.slice(7) : "";
}

async function currentUser(request, env) {
  const payload = await verifySession(bearer(request), sessionSigningSecret(env));
  return {
    login: normalizeLogin(payload.login),
    id: payload.id,
    name: payload.name || payload.login,
    avatarUrl: payload.avatarUrl || "",
  };
}

async function requireApproved(request, env) {
  const user = await currentUser(request, env);
  const config = await approvedConfig(env);
  if (!config.publishers.includes(user.login)) throw new HttpError(403, "Sua conta ainda não foi aprovada para publicar.");
  return { user, config };
}

async function requireAdmin(request, env) {
  const user = await currentUser(request, env);
  const config = await approvedConfig(env);
  if (user.login !== config.admin) throw new HttpError(403, "Somente o administrador pode fazer isso.");
  return { user, config };
}

function cookieValue(request, name) {
  const cookie = request.headers.get("Cookie") || "";
  return cookie
    .split(";")
    .map((part) => part.trim().split("="))
    .find(([key]) => key === name)?.[1] || "";
}

async function beginLogin(request, env) {
  const nonce = crypto.randomUUID();
  const state = await signSession(
    { kind: "oauth", nonce, exp: Math.floor(Date.now() / 1000) + 10 * 60 },
    sessionSigningSecret(env),
  );
  const callback = `${new URL(request.url).origin}/auth/callback`;
  const url = new URL("https://github.com/login/oauth/authorize");
  url.searchParams.set("client_id", env.GITHUB_CLIENT_ID);
  url.searchParams.set("redirect_uri", callback);
  url.searchParams.set("state", state);
  return new Response(null, {
    status: 302,
    headers: {
      Location: url.toString(),
      "Set-Cookie": `psaltikon_oauth=${nonce}; Path=/auth; Max-Age=600; HttpOnly; Secure; SameSite=Lax`,
    },
  });
}

async function finishLogin(request, env) {
  const url = new URL(request.url);
  const state = await verifySession(url.searchParams.get("state"), sessionSigningSecret(env), "oauth");
  if (!state.nonce || state.nonce !== cookieValue(request, "psaltikon_oauth")) {
    throw new HttpError(400, "A tentativa de login expirou. Tente novamente.");
  }
  const response = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code: url.searchParams.get("code"),
      redirect_uri: `${url.origin}/auth/callback`,
    }),
  });
  const tokenData = await response.json();
  if (!response.ok || !tokenData.access_token) throw new HttpError(401, "O GitHub não autorizou o acesso.");
  const profileResponse = await fetch("https://api.github.com/user", {
    headers: githubHeaders(tokenData.access_token),
  });
  const profile = await profileResponse.json();
  if (!profileResponse.ok || !profile.login) throw new HttpError(401, "Não foi possível ler o perfil do GitHub.");
  const session = await signSession(
    {
      kind: "session",
      login: normalizeLogin(profile.login),
      id: profile.id,
      name: profile.name || profile.login,
      avatarUrl: profile.avatar_url || "",
      exp: Math.floor(Date.now() / 1000) + SESSION_SECONDS,
    },
    sessionSigningSecret(env),
  );
  const destination = `${env.FRONTEND_URL.replace(/\/$/, "")}/#psaltikon_token=${encodeURIComponent(session)}`;
  return new Response(null, {
    status: 302,
    headers: {
      Location: destination,
      "Set-Cookie": "psaltikon_oauth=; Path=/auth; Max-Age=0; HttpOnly; Secure; SameSite=Lax",
    },
  });
}

async function openAccessRequests(env) {
  const issues = await github(env, repoPath(env, "/issues?state=open&per_page=100&sort=created&direction=desc"));
  return issues
    .filter((issue) => !issue.pull_request && issue.title.startsWith(REQUEST_PREFIX))
    .map((issue) => ({
      number: issue.number,
      login: normalizeLogin(issue.title.slice(REQUEST_PREFIX.length)),
      requestedAt: issue.created_at,
      url: issue.html_url,
    }));
}

async function requestAccess(request, env) {
  const user = await currentUser(request, env);
  const config = await approvedConfig(env);
  if (config.publishers.includes(user.login)) return { status: "approved" };
  const requests = await openAccessRequests(env);
  if (requests.some((item) => item.login === user.login)) return { status: "pending" };
  await github(env, repoPath(env, "/issues"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: `${REQUEST_PREFIX}${user.login}`,
      body: `@${user.login} solicitou permissão para publicar conjuntos no Psaltikon.\n\nGitHub user id: ${user.id}`,
    }),
  });
  return { status: "pending" };
}

async function closeRequest(env, number, message) {
  await github(env, repoPath(env, `/issues/${number}/comments`), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ body: message }),
  });
  await github(env, repoPath(env, `/issues/${number}`), {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ state: "closed", state_reason: "completed" }),
  });
}

async function parseBody(request) {
  if (Number(request.headers.get("Content-Length") || 0) > MAX_SET_BYTES * 1.2) {
    throw new HttpError(413, "O envio é grande demais.");
  }
  return request.json().catch(() => {
    throw new HttpError(400, "Dados inválidos.");
  });
}

async function sessionInfo(request, env) {
  const user = await currentUser(request, env);
  const config = await approvedConfig(env);
  const requests = await openAccessRequests(env);
  const isAdmin = user.login === config.admin;
  return {
    user,
    isAdmin,
    isApproved: config.publishers.includes(user.login),
    isPending: requests.some((item) => item.login === user.login),
    ...(isAdmin ? { publishers: config.publishers, requests } : {}),
  };
}

async function libraryList(env) {
  const tree = await github(env, repoPath(env, "/git/trees/main?recursive=1"));
  const items = (tree.tree || [])
    .filter((item) => item.type === "blob" && isHymnPath(item.path))
    .map((item) => {
      const [, owner, file] = item.path.match(HYMN_PATH_PATTERN);
      return { owner, slug: file, path: item.path, sha: item.sha };
    });
  const enriched = await Promise.all(items.map(async ({ sha, ...item }) => {
    const blob = await github(env, repoPath(env, `/git/blobs/${sha}`));
    let metadata = { title: "", updatedAt: null };
    try {
      metadata = normalizeLibraryMetadata(JSON.parse(base64ToUtf8(blob.content || "")));
    } catch {}
    return { ...item, ...metadata };
  }));
  return enriched.sort((a, b) => a.owner.localeCompare(b.owner) || a.slug.localeCompare(b.slug));
}

async function libraryItem(env, path) {
  if (!isHymnPath(path)) {
    throw new HttpError(400, "Caminho de conjunto inválido.");
  }
  const stored = await readRepoJson(env, path);
  if (!stored) throw new HttpError(404, "Conjunto não encontrado.");
  return stored.data;
}

async function saveSet(request, env) {
  const { user } = await requireApproved(request, env);
  const value = validateHymnSet(await parseBody(request));
  const path = `hinos/${user.login}/${value.slug}.json`;
  const document = {
    version: 1,
    title: value.title,
    owner: { login: user.login, name: user.name, avatarUrl: user.avatarUrl },
    updatedAt: new Date().toISOString(),
    hymns: value.hymns,
  };
  await writeRepoJson(env, path, document, `Save Psaltikon set: ${value.title}`);
  return { path, title: value.title, updatedAt: document.updatedAt };
}

async function deleteSet(request, env, path) {
  const { user, config } = await requireApproved(request, env);
  if (!isHymnPath(path)) throw new HttpError(400, "Caminho de conjunto inválido.");
  if (!isOwnedHymnPath(path, user.login) && user.login !== config.admin) {
    throw new HttpError(403, "Você só pode excluir conjuntos da sua própria pasta.");
  }
  await deleteRepoFile(env, path, `Delete Psaltikon set: ${path}`);
  return { deleted: true };
}

async function adminAction(request, env, action) {
  const { config } = await requireAdmin(request, env);
  const body = await parseBody(request);
  if (action === "approve" || action === "reject") {
    const number = Number(body.number);
    const login = normalizeLogin(body.login);
    const requests = await openAccessRequests(env);
    const pending = requests.find((item) => item.number === number && item.login === login);
    if (!pending) throw new HttpError(404, "Solicitação não encontrada.");
    if (action === "approve") {
      await updatePublishers(env, (users) => [...users, login], `Approve Psaltikon publisher: ${login}`);
      await closeRequest(env, number, `Acesso aprovado por @${config.admin}.`);
    } else {
      await closeRequest(env, number, `Solicitação recusada por @${config.admin}.`);
    }
    return { ok: true };
  }

  const login = normalizeLogin(body.login);
  if (!/^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i.test(login)) throw new HttpError(400, "Login inválido.");
  if (action === "add") {
    await github(env, `/users/${encodeURIComponent(login)}`);
    await updatePublishers(env, (users) => [...users, login], `Add Psaltikon publisher: ${login}`);
    return { ok: true };
  }
  if (action === "revoke") {
    if (login === config.admin) throw new HttpError(400, "O administrador não pode ser removido.");
    await updatePublishers(
      env,
      (users) => users.filter((item) => item !== login),
      `Revoke Psaltikon publisher: ${login}`,
    );
    return { ok: true };
  }
  throw new HttpError(404, "Ação administrativa desconhecida.");
}

function corsHeaders(env) {
  return {
    "Access-Control-Allow-Origin": new URL(env.FRONTEND_URL).origin,
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    Vary: "Origin",
  };
}

function jsonResponse(value, env, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...corsHeaders(env) },
  });
}

async function route(request, env) {
  const url = new URL(request.url);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(env) });
  if (url.pathname === "/health") return jsonResponse({ ok: true }, env);
  if (url.pathname === "/auth/login" && request.method === "GET") return beginLogin(request, env);
  if (url.pathname === "/auth/callback" && request.method === "GET") return finishLogin(request, env);
  if (url.pathname === "/api/library" && request.method === "GET") return jsonResponse(await libraryList(env), env);
  if (url.pathname === "/api/library/item" && request.method === "GET") {
    return jsonResponse(await libraryItem(env, url.searchParams.get("path")), env);
  }
  if (url.pathname === "/api/session" && request.method === "GET") return jsonResponse(await sessionInfo(request, env), env);
  if (url.pathname === "/api/access/request" && request.method === "POST") {
    return jsonResponse(await requestAccess(request, env), env);
  }
  if (url.pathname === "/api/sets" && request.method === "POST") return jsonResponse(await saveSet(request, env), env, 201);
  if (url.pathname === "/api/sets" && request.method === "DELETE") {
    return jsonResponse(await deleteSet(request, env, url.searchParams.get("path")), env);
  }
  const adminMatch = url.pathname.match(/^\/api\/admin\/(approve|reject|add|revoke)$/);
  if (adminMatch && request.method === "POST") {
    return jsonResponse(await adminAction(request, env, adminMatch[1]), env);
  }
  throw new HttpError(404, "Página não encontrada.");
}

export default {
  async fetch(request, env) {
    try {
      return await route(request, env);
    } catch (error) {
      console.error(error);
      const status = error instanceof HttpError ? error.status : 500;
      const message = error instanceof HttpError ? error.message : "O serviço de publicação encontrou um problema.";
      return jsonResponse({ error: message }, env, status);
    }
  },
};
