import publisher from "./index.js";

const API_VERSION = "2022-11-28";
const CURATED_PATH = "catalog/curated.json";
const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
let installationTokenCache = null;

function corsHeaders(env) {
  return {
    "Access-Control-Allow-Origin": new URL(env.FRONTEND_URL).origin,
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
    Vary: "Origin",
  };
}

function json(value, env, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...corsHeaders(env) },
  });
}

function bytesToBase64Url(bytes) {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function utf8ToBase64(value) {
  return bytesToBase64Url(new TextEncoder().encode(value))
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(Math.ceil(new TextEncoder().encode(value).length / 3) * 4, "=");
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
  const raw = Uint8Array.from(atob(compact), character => character.charCodeAt(0));
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
  const payload = bytesToBase64Url(new TextEncoder().encode(JSON.stringify({
    iat: now - 60,
    exp: now + 9 * 60,
    iss: env.GITHUB_APP_ID,
  })));
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
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${await githubAppJwt(env)}`,
        "X-GitHub-Api-Version": API_VERSION,
        "User-Agent": "Psaltikon-Publisher",
      },
    },
  );
  const data = await response.json();
  if (!response.ok || !data.token) throw new Error(`Não foi possível autenticar o aplicativo no GitHub (${response.status}).`);
  installationTokenCache = { token: data.token, expiresAt: Date.parse(data.expires_at) };
  return data.token;
}

async function github(env, suffix, init = {}) {
  const response = await fetch(
    `https://api.github.com/repos/${encodeURIComponent(env.GITHUB_OWNER)}/${encodeURIComponent(env.GITHUB_REPO)}${suffix}`,
    {
      ...init,
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${await installationToken(env)}`,
        "X-GitHub-Api-Version": API_VERSION,
        "User-Agent": "Psaltikon-Publisher",
        ...(init.headers || {}),
      },
    },
  );
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || `GitHub respondeu com ${response.status}.`);
  return data;
}

async function requireAdmin(request, env) {
  const sessionRequest = new Request(`${new URL(request.url).origin}/api/session`, {
    method: "GET",
    headers: request.headers,
  });
  const response = await publisher.fetch(sessionRequest, env);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw Object.assign(new Error(data.error || "Entre novamente para editar a curadoria."), { status: response.status });
  }
  const session = await response.json();
  if (!session.isAdmin) throw Object.assign(new Error("Somente o administrador pode editar a curadoria."), { status: 403 });
}

function validateRename(body, catalog, kind) {
  const id = String(body?.id || "").trim();
  const label = String(body?.label || "").trim().slice(0, 100);
  if (!ID_PATTERN.test(id) || !label) {
    throw Object.assign(new Error(kind === "category" ? "Informe uma categoria e um nome válidos." : "Informe uma subcategoria e um nome válidos."), { status: 400 });
  }
  const collection = kind === "category" ? catalog.categories : catalog.subcategories;
  const target = collection.find(item => item?.id === id);
  if (!target) throw Object.assign(new Error(kind === "category" ? "Categoria da Biblioteca curada não encontrada." : "Subcategoria da Biblioteca curada não encontrada."), { status: 404 });
  const duplicate = collection.some(item => item?.id !== id && (
    kind === "category" || item?.categoryId === target.categoryId
  ) && String(item?.label || "").localeCompare(label, "pt-BR", { sensitivity: "base" }) === 0);
  if (duplicate) throw Object.assign(new Error(kind === "category" ? "Essa categoria já existe." : "Essa subcategoria já existe nessa categoria."), { status: 409 });
  return { target, label };
}

async function rename(request, env, kind) {
  await requireAdmin(request, env);
  const body = await request.json().catch(() => { throw Object.assign(new Error("Dados inválidos."), { status: 400 }); });
  const publicResponse = await publisher.fetch(new Request(`${new URL(request.url).origin}/api/curated`), env);
  if (!publicResponse.ok) throw Object.assign(new Error("Não foi possível ler o catálogo curado."), { status: publicResponse.status });
  const catalog = structuredClone(await publicResponse.json());
  if (!catalog || catalog.version !== 3 || !Array.isArray(catalog.categories) || !Array.isArray(catalog.subcategories)) {
    throw Object.assign(new Error("O catálogo curado está inválido."), { status: 500 });
  }
  const { target, label } = validateRename(body, catalog, kind);
  const previous = target.label;
  if (previous === label) return { changed: false, item: target, catalog };
  target.label = label;

  const file = await github(env, `/contents/${CURATED_PATH}?ref=main`);
  await github(env, `/contents/${CURATED_PATH}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: `Rename Psaltikon curated ${kind}: ${previous} -> ${label}`,
      branch: "main",
      sha: file.sha,
      content: utf8ToBase64(`${JSON.stringify(catalog, null, 2)}\n`),
    }),
  });
  return { changed: true, item: target, catalog };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(env) });
    }
    try {
      if (url.pathname === "/api/curated/categories" && request.method === "PATCH") {
        return json(await rename(request, env, "category"), env);
      }
      if (url.pathname === "/api/curated/subcategories" && request.method === "PATCH") {
        return json(await rename(request, env, "subcategory"), env);
      }
      return publisher.fetch(request, env);
    } catch (error) {
      console.error(error);
      return json({ error: error instanceof Error ? error.message : "Não foi possível editar a curadoria." }, env, Number(error?.status) || 500);
    }
  },
};
