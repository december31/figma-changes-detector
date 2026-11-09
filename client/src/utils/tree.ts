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
  _explicitFolderPaths: string[] = []
): TreeData {
  const fileGroups = new Map<string, Component[]>();

  for (const comp of components) {
    const rootName =
      (comp.file_name && comp.file_name.trim()) ||
      (comp.folder_path && comp.folder_path.trim().split('/')[0]) ||
      'Figma Document';
    if (!fileGroups.has(rootName)) {
      fileGroups.set(rootName, []);
    }
    fileGroups.get(rootName)!.push(comp);
  }

  const sortedFolderNames = Array.from(fileGroups.keys()).sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: 'base' })
  );

  const folders: FolderTreeNode[] = sortedFolderNames.map((name) => {
    const folderComponents = fileGroups.get(name)!;
    return {
      type: 'folder',
      path: name,
      name,
      depth: 0,
      subfolders: [],
      components: folderComponents,
      totalComponentCount: folderComponents.length
    };
  });

  return {
    folders,
    rootComponents: []
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
