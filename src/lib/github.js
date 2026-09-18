// GitHub API helpers for the maintainer map-update flow: upload a layer
// file in the browser, auto-generate its mobile variant, and open a pull
// request so a second maintainer reviews before anything goes live.
//
// Auth: the caller supplies a personal access token (fine-grained PAT with
// Contents:read+write and Pull requests:read+write on this repo, or classic
// `repo` scope). The token lives in memory only for the session — it is
// never written to storage and is sent solely to api.github.com.

// Update these on turnover (fork moves, renames).
export const REPO_OWNER = "EmjayBot";
export const REPO_NAME = "urth-atlas";
export const BASE_BRANCH = "main";

async function api(path, token, { method = "GET", body } = {}) {
  const r = await fetch(`https://api.github.com${path}`, {
    method,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    throw new Error(data?.message ? `GitHub: ${data.message}` : `GitHub HTTP ${r.status}`);
  }
  return data;
}

export async function getMainSha(token) {
  const ref = await api(`/repos/${REPO_OWNER}/${REPO_NAME}/git/ref/heads/${BASE_BRANCH}`, token);
  return ref.object.sha;
}

export async function createBranch(token, name, sha) {
  await api(`/repos/${REPO_OWNER}/${REPO_NAME}/git/refs`, token, {
    method: "POST",
    body: { ref: `refs/heads/${name}`, sha },
  });
}

// Blob from a File/Blob (base64, chunked so large map files don't blow the
// call stack in btoa).
export async function createBlobFromFile(token, file) {
  const buf = new Uint8Array(await file.arrayBuffer());
  let bin = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < buf.length; i += CHUNK) {
    bin += String.fromCharCode(...buf.subarray(i, i + CHUNK));
  }
  const { sha } = await api(`/repos/${REPO_OWNER}/${REPO_NAME}/git/blobs`, token, {
    method: "POST",
    body: { content: btoa(bin), encoding: "base64" },
  });
  return sha;
}

export async function commitFiles(token, { branch, message, parentSha, baseTreeSha, entries }) {
  const tree = await api(`/repos/${REPO_OWNER}/${REPO_NAME}/git/trees`, token, {
    method: "POST",
    body: {
      base_tree: baseTreeSha,
      tree: entries.map((e) => ({ path: e.path, mode: "100644", type: "blob", sha: e.sha })),
    },
  });
  const commit = await api(`/repos/${REPO_OWNER}/${REPO_NAME}/git/commits`, token, {
    method: "POST",
    body: { message, tree: tree.sha, parents: [parentSha] },
  });
  await api(`/repos/${REPO_OWNER}/${REPO_NAME}/git/refs/heads/${branch}`, token, {
    method: "PATCH",
    body: { sha: commit.sha },
  });
  return commit.sha;
}

export async function getBaseTreeSha(token, commitSha) {
  const commit = await api(`/repos/${REPO_OWNER}/${REPO_NAME}/git/commits/${commitSha}`, token);
  return commit.tree.sha;
}

export async function openPullRequest(token, { branch, title, body }) {
  const pr = await api(`/repos/${REPO_OWNER}/${REPO_NAME}/pulls`, token, {
    method: "POST",
    body: { head: branch, base: BASE_BRANCH, title, body },
  });
  return pr.html_url;
}
