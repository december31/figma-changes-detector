// client/src/utils/tree.ts
import { Component, FolderTreeNode, TreeData } from '../types';

export function normalizeFolderPath(pathStr?: string | null): string {
  if (!pathStr || typeof pathStr !== 'string') return '';
  return pathStr
    .split('/')
    .map((s) => s.trim())
    .filter(Boolean)
    .join('/');
}

export function buildComponentTree(
  components: Component[],
  explicitFolderPaths: string[] = []
): TreeData {
  const allFolderPaths = new Set<string>();

  const addPathAndAncestors = (p?: string | null) => {
    const norm = normalizeFolderPath(p);
    if (!norm) return;
    const parts = norm.split('/');
    let curr = '';
    for (const part of parts) {
      curr = curr ? `${curr}/${part}` : part;
      allFolderPaths.add(curr);
    }
  };

  explicitFolderPaths.forEach(addPathAndAncestors);
  components.forEach((c) => addPathAndAncestors(c.folder_path));

  interface IntermediateFolder {
    path: string;
    name: string;
    depth: number;
    subfolderPaths: Set<string>;
    components: Component[];
  }

  const folderMap = new Map<string, IntermediateFolder>();

  for (const path of allFolderPaths) {
    const parts = path.split('/');
    const name = parts[parts.length - 1];
    const depth = parts.length - 1;
    folderMap.set(path, {
      path,
      name,
      depth,
      subfolderPaths: new Set(),
      components: []
    });
  }

  for (const path of allFolderPaths) {
    const lastSlash = path.lastIndexOf('/');
    if (lastSlash !== -1) {
      const parentPath = path.substring(0, lastSlash);
      const parent = folderMap.get(parentPath);
      if (parent) {
        parent.subfolderPaths.add(path);
      }
    }
  }

  const rootComponents: Component[] = [];
  for (const comp of components) {
    const norm = normalizeFolderPath(comp.folder_path);
    if (norm && folderMap.has(norm)) {
      folderMap.get(norm)!.components.push(comp);
    } else {
      rootComponents.push(comp);
    }
  }

  function toTreeNode(path: string): FolderTreeNode {
    const item = folderMap.get(path)!;
    const subfolderNodes = Array.from(item.subfolderPaths)
      .sort((a, b) => a.localeCompare(b))
      .map(toTreeNode);

    const totalSubCount = subfolderNodes.reduce(
      (sum, sf) => sum + sf.totalComponentCount,
      0
    );
    const totalComponentCount = item.components.length + totalSubCount;

    return {
      type: 'folder',
      path: item.path,
      name: item.name,
      depth: item.depth,
      subfolders: subfolderNodes,
      components: item.components,
      totalComponentCount
    };
  }

  const topLevelFolders = Array.from(allFolderPaths)
    .filter((p) => !p.includes('/'))
    .sort((a, b) => a.localeCompare(b))
    .map(toTreeNode);

  return {
    folders: topLevelFolders,
    rootComponents
  };
}

/**
 * Collect all component IDs inside a folder tree node (including all subfolders)
 */
export function getFolderComponentIds(node: FolderTreeNode): number[] {
  const ids: number[] = node.components.map((c) => c.id);
  for (const sub of node.subfolders) {
    ids.push(...getFolderComponentIds(sub));
  }
  return ids;
}

/**
 * Filter tree by query (matches component name, node ID, or folder name/path)
 */
export function filterTree(
  tree: TreeData,
  query: string
): { tree: TreeData; matchingFolderPaths: Set<string> } {
  const q = query.trim().toLowerCase();
  if (!q) {
    return { tree, matchingFolderPaths: new Set() };
  }

  const matchingFolderPaths = new Set<string>();

  function filterNode(node: FolderTreeNode): FolderTreeNode | null {
    const folderMatches = node.name.toLowerCase().includes(q) || node.path.toLowerCase().includes(q);
    const filteredComponents = node.components.filter(
      (c) =>
        folderMatches ||
        c.name.toLowerCase().includes(q) ||
        c.node_id.toLowerCase().includes(q)
    );

    const filteredSubfolders: FolderTreeNode[] = [];
    for (const sub of node.subfolders) {
      const res = filterNode(sub);
      if (res) filteredSubfolders.push(res);
    }

    if (folderMatches || filteredComponents.length > 0 || filteredSubfolders.length > 0) {
      matchingFolderPaths.add(node.path);
      // also add ancestors
      const parts = node.path.split('/');
      let curr = '';
      for (const part of parts) {
        curr = curr ? `${curr}/${part}` : part;
        matchingFolderPaths.add(curr);
      }

      const totalSubCount = filteredSubfolders.reduce(
        (sum, sf) => sum + sf.totalComponentCount,
        0
      );
      return {
        ...node,
        subfolders: filteredSubfolders,
        components: filteredComponents,
        totalComponentCount: filteredComponents.length + totalSubCount
      };
    }
    return null;
  }

  const filteredFolders: FolderTreeNode[] = [];
  for (const f of tree.folders) {
    const res = filterNode(f);
    if (res) filteredFolders.push(res);
  }

  const filteredRoot = tree.rootComponents.filter(
    (c) => c.name.toLowerCase().includes(q) || c.node_id.toLowerCase().includes(q)
  );

  return {
    tree: {
      folders: filteredFolders,
      rootComponents: filteredRoot
    },
    matchingFolderPaths
  };
}
