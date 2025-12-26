import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  applyEdgeChanges,
  applyNodeChanges,
  addEdge,
  MarkerType,
  type Connection,
  type Edge,
  type Node,
  type NodeTypes
} from 'reactflow';
import dagre from '@dagrejs/dagre';
import { marked } from 'marked';

type GraphNodeData = {
  label: string;
  tagColor: string;
};

type GraphFile = {
  filePath: string;
  baseDir: string;
};

type TagMeta = {
  id: string;
  name: string;
  color: string;
};

type GraphJson = {
  nodes: Array<{ id: string; label: string; tagColor: string }>;
  edges: Array<{ source: string; target: string; directed?: boolean }>;
};

const nodeWidth = 220;
const nodeHeight = 80;

const layoutGraph = (nodes: Node<GraphNodeData>[], edges: Edge[]): Node<GraphNodeData>[] => {
  const graph = new dagre.graphlib.Graph();
  graph.setGraph({ rankdir: 'LR', nodesep: 60, ranksep: 80 });
  graph.setDefaultEdgeLabel(() => ({}));

  nodes.forEach((node) => {
    graph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });

  edges.forEach((edge) => {
    graph.setEdge(edge.source, edge.target);
  });

  dagre.layout(graph);

  return nodes.map((node) => {
    const { x, y } = graph.node(node.id);
    return {
      ...node,
      position: { x: x - nodeWidth / 2, y: y - nodeHeight / 2 }
    };
  });
};

const GraphNode = ({ data }: { data: GraphNodeData }) => {
  return (
    <div className="node-card">
      <div className="node-tag" style={{ backgroundColor: data.tagColor }} />
      <div className="node-label">{data.label || 'Untitled'}</div>
    </div>
  );
};

const initialNodes: Node<GraphNodeData>[] = [
  {
    id: 'node-1',
    data: { label: 'Idea', tagColor: '#6366F1' },
    position: { x: 0, y: 0 },
    type: 'graphNode'
  },
  {
    id: 'node-2',
    data: { label: 'Next', tagColor: '#22C55E' },
    position: { x: 300, y: 0 },
    type: 'graphNode'
  }
];

const defaultEdgeStyle = { stroke: '#94a3b8', strokeWidth: 2 };

const initialEdges: Edge[] = [
  {
    id: 'e1-2',
    source: 'node-1',
    target: 'node-2',
    type: 'smoothstep',
    style: defaultEdgeStyle,
    data: { directed: true },
    markerEnd: { type: MarkerType.ArrowClosed, color: defaultEdgeStyle.stroke }
  }
];

const createGraphJson = (nodes: Node<GraphNodeData>[], edges: Edge[]): GraphJson => ({
  nodes: nodes.map((node) => ({
    id: node.id,
    label: node.data.label,
    tagColor: node.data.tagColor
  })),
  edges: edges.map((edge) => ({
    source: edge.source,
    target: edge.target,
    directed: edge.data?.directed ?? true
  }))
});

const parseGraphJson = (raw: string): GraphJson => {
  const parsed = JSON.parse(raw) as GraphJson;
  return {
    nodes: parsed.nodes || [],
    edges: parsed.edges || []
  };
};

const createNode = (label = 'New node', tagColor = '#38BDF8'): Node<GraphNodeData> => ({
  id: `node-${crypto.randomUUID()}`,
  type: 'graphNode',
  position: { x: 100, y: 100 },
  data: {
    label,
    tagColor
  }
});

const createEdge = (connection: Connection, directed = true): Edge => ({
  id: `e-${connection.source}-${connection.target}-${crypto.randomUUID()}`,
  source: connection.source!,
  target: connection.target!,
  type: 'smoothstep',
  style: defaultEdgeStyle,
  data: { directed },
  markerEnd: directed ? { type: MarkerType.ArrowClosed, color: defaultEdgeStyle.stroke } : undefined
});

const App = () => {
  const [nodes, setNodes] = useState<Node<GraphNodeData>[]>(() => layoutGraph(initialNodes, initialEdges));
  const [edges, setEdges] = useState<Edge[]>(initialEdges);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [graphFile, setGraphFile] = useState<GraphFile | null>(null);
  const [nodeNotes, setNodeNotes] = useState<Record<string, string>>({});
  const [tags, setTags] = useState<TagMeta[]>([
    { id: 'tag-core', name: 'Core', color: '#6366F1' },
    { id: 'tag-todo', name: 'Todo', color: '#22C55E' }
  ]);
  const [selectedTagColor, setSelectedTagColor] = useState<string | null>(null);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#38BDF8');
  const [status, setStatus] = useState('Ready');
  const saveTimeout = useRef<number | null>(null);

  const nodeTypes = useMemo<NodeTypes>(() => ({ graphNode: GraphNode }), []);

  const selectedNode = nodes.find((node) => node.id === selectedNodeId) || null;
  const selectedNote = selectedNodeId ? nodeNotes[selectedNodeId] ?? '' : '';
  const selectedEdge = edges.find((edge) => edge.id === selectedEdgeId) || null;

  const visibleNodes = useMemo(() => {
    if (!selectedTagColor) return nodes;
    return nodes.map((node) => ({
      ...node,
      className: node.data.tagColor === selectedTagColor ? 'node--focused' : 'node--dim'
    }));
  }, [nodes, selectedTagColor]);

  const onConnect = useCallback(
    (connection: Connection) => setEdges((eds) => addEdge(createEdge(connection), eds)),
    []
  );

  const onAddNode = () => {
    const fallbackColor = tags[0]?.color ?? '#38BDF8';
    setNodes((current) => [...current, createNode('New node', fallbackColor)]);
  };

  const onDeleteNode = () => {
    if (!selectedNodeId) return;
    setNodes((current) => current.filter((node) => node.id !== selectedNodeId));
    setEdges((current) => current.filter((edge) => edge.source !== selectedNodeId && edge.target !== selectedNodeId));
    setSelectedNodeId(null);
    setNodeNotes((current) => {
      const { [selectedNodeId]: _removed, ...rest } = current;
      return rest;
    });
  };

  const onDeleteEdge = () => {
    if (!selectedEdgeId) return;
    setEdges((current) => current.filter((edge) => edge.id !== selectedEdgeId));
    setSelectedEdgeId(null);
  };

  const onToggleEdgeDirection = () => {
    if (!selectedEdgeId) return;
    setEdges((current) =>
      current.map((edge) => {
        if (edge.id !== selectedEdgeId) return edge;
        const directed = !(edge.data?.directed ?? true);
        return {
          ...edge,
          data: { ...edge.data, directed },
          markerEnd: directed ? { type: MarkerType.ArrowClosed, color: defaultEdgeStyle.stroke } : undefined
        };
      })
    );
  };

  const onAutoLayout = () => {
    setNodes((current) => layoutGraph(current, edges));
  };

  const onAddTag = () => {
    const trimmed = newTagName.trim();
    if (!trimmed) {
      setStatus('Tag name is required.');
      return;
    }
    if (tags.some((tag) => tag.color === newTagColor)) {
      setStatus('Each tag color must be unique.');
      return;
    }
    setTags((current) => [
      ...current,
      { id: `tag-${crypto.randomUUID()}`, name: trimmed, color: newTagColor }
    ]);
    setNewTagName('');
    setStatus(`Added tag "${trimmed}".`);
  };

  const ensureTagsForColors = (colors: string[]) => {
    setTags((current) => {
      const existingColors = new Set(current.map((tag) => tag.color));
      const additions = colors
        .filter((color) => color && !existingColors.has(color))
        .map((color, index) => ({
          id: `tag-${crypto.randomUUID()}`,
          name: `Tag ${current.length + index + 1}`,
          color
        }));
      return additions.length ? [...current, ...additions] : current;
    });
  };

  const handleOpen = async () => {
    const result = await window.graphAPI.openGraph();
    if (!result) return;
    const data = parseGraphJson(result.data);
    const loadedNodes = data.nodes.map((node) => ({
      id: node.id,
      type: 'graphNode',
      position: { x: 0, y: 0 },
      data: { label: node.label, tagColor: node.tagColor }
    }));
    const loadedEdges = data.edges.map((edge, index) => ({
      id: `e-${edge.source}-${edge.target}-${index}`,
      source: edge.source,
      target: edge.target,
      type: 'smoothstep',
      style: defaultEdgeStyle,
      data: { directed: edge.directed ?? true },
      markerEnd: edge.directed ?? true ? { type: MarkerType.ArrowClosed, color: defaultEdgeStyle.stroke } : undefined
    }));
    setNodes(layoutGraph(loadedNodes, loadedEdges));
    setEdges(loadedEdges);
    ensureTagsForColors(loadedNodes.map((node) => node.data.tagColor));
    setGraphFile({ filePath: result.filePath, baseDir: result.baseDir });
    setSelectedNodeId(null);
    setNodeNotes({});
    setStatus(`Opened ${result.filePath}`);
  };

  const handleSaveAs = async () => {
    const result = await window.graphAPI.saveGraphAs({ suggestedName: 'graph' });
    if (!result) return;
    setGraphFile({ filePath: result.filePath, baseDir: result.baseDir });
    await handleSave(result.filePath, result.baseDir);
  };

  const handleSave = async (filePathOverride?: string, baseDirOverride?: string) => {
    const filePath = filePathOverride ?? graphFile?.filePath;
    if (!filePath) {
      await handleSaveAs();
      return;
    }
    const payload = createGraphJson(nodes, edges);
    await window.graphAPI.saveGraph({ filePath, content: JSON.stringify(payload, null, 2) });
    const baseDir = baseDirOverride ?? graphFile?.baseDir;
    if (baseDir) {
      await Promise.all(
        nodes.map((node) =>
          window.graphAPI.writeNodeFile({
            baseDir,
            nodeId: node.id,
            content: nodeNotes[node.id] ?? ''
          })
        )
      );
    }
    setStatus(`Saved ${filePath}`);
  };

  const handleNew = () => {
    setNodes(layoutGraph(initialNodes, initialEdges));
    setEdges(initialEdges);
    setGraphFile(null);
    setSelectedNodeId(null);
    setNodeNotes({});
    setSelectedTagColor(null);
    setStatus('New graph');
  };

  useEffect(() => {
    if (!graphFile?.filePath) return;
    if (saveTimeout.current) {
      window.clearTimeout(saveTimeout.current);
    }
    saveTimeout.current = window.setTimeout(() => {
      void handleSave();
    }, 800);
  }, [nodes, edges, graphFile?.filePath]);

  useEffect(() => {
    if (!graphFile?.baseDir || !selectedNodeId) return;
    if (nodeNotes[selectedNodeId] !== undefined) return;
    void window.graphAPI
      .readNodeFile({ baseDir: graphFile.baseDir, nodeId: selectedNodeId })
      .then((content) =>
        setNodeNotes((current) => ({
          ...current,
          [selectedNodeId]: content
        }))
      );
  }, [graphFile?.baseDir, nodeNotes, selectedNodeId]);

  const updateSelectedNode = (patch: Partial<GraphNodeData>) => {
    if (!selectedNodeId) return;
    setNodes((current) =>
      current.map((node) =>
        node.id === selectedNodeId ? { ...node, data: { ...node.data, ...patch } } : node
      )
    );
  };

  return (
    <div className="app-shell">
      <header className="top-bar">
        <div className="brand">Graph Studio</div>
        <div className="actions">
          <button type="button" onClick={handleNew}>
            New
          </button>
          <button type="button" onClick={handleOpen}>
            Open
          </button>
          <button type="button" onClick={() => void handleSave()}>
            Save
          </button>
          <button type="button" onClick={handleSaveAs}>
            Save As
          </button>
          <button type="button" onClick={onAddNode}>
            Add Node
          </button>
          <button type="button" onClick={onDeleteNode} disabled={!selectedNodeId}>
            Delete
          </button>
          <button type="button" onClick={onToggleEdgeDirection} disabled={!selectedEdgeId}>
            Toggle Direction
          </button>
          <button type="button" onClick={onDeleteEdge} disabled={!selectedEdgeId}>
            Delete Edge
          </button>
          <button type="button" onClick={onAutoLayout}>
            Auto Layout
          </button>
        </div>
        <div className="status">{status}</div>
      </header>
      <div className="content">
        <div className="canvas">
          <ReactFlow
            nodes={visibleNodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={(changes) => setNodes((current) => applyNodeChanges(changes, current))}
            onEdgesChange={(changes) => {
              setEdges((current) => applyEdgeChanges(changes, current));
              if (changes.some((change) => change.type === 'remove' && change.id === selectedEdgeId)) {
                setSelectedEdgeId(null);
              }
            }}
            onNodeClick={(_, node) => {
              setSelectedNodeId(node.id);
              setSelectedEdgeId(null);
            }}
            onEdgeClick={(_, edge) => {
              setSelectedEdgeId(edge.id);
              setSelectedNodeId(null);
            }}
            onConnect={onConnect}
            defaultEdgeOptions={{ type: 'smoothstep', style: defaultEdgeStyle }}
            fitView
          >
            <Background color="#1F2937" />
            <MiniMap
              pannable
              zoomable
              className="mini-map"
              nodeColor={(node) => node.data.tagColor}
            />
            <Controls />
          </ReactFlow>
        </div>
        <aside className="sidebar">
          <h2>Node Editor</h2>
          {selectedNode ? (
            <div className="editor">
              <label>
                Label
                <input
                  type="text"
                  value={selectedNode.data.label}
                  onChange={(event) => updateSelectedNode({ label: event.target.value })}
                />
              </label>
              <label>
                Tag
                <select
                  value={selectedNode.data.tagColor}
                  onChange={(event) => updateSelectedNode({ tagColor: event.target.value })}
                >
                  {tags.map((tag) => (
                    <option key={tag.id} value={tag.color}>
                      {tag.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="markdown">
                <div className="markdown-header">Node File</div>
                <textarea
                  value={selectedNote}
                  onChange={(event) =>
                    setNodeNotes((current) => ({
                      ...current,
                      [selectedNodeId]: event.target.value
                    }))
                  }
                  placeholder="Write node notes here..."
                />
                <div
                  className="markdown-preview"
                  dangerouslySetInnerHTML={{ __html: marked.parse(selectedNote || '') }}
                />
              </div>
            </div>
          ) : selectedEdge ? (
            <div className="editor edge-editor">
              <div className="edge-title">Edge</div>
              <p className="edge-meta">
                {selectedEdge.source} → {selectedEdge.target}
              </p>
              <div className="edge-toggle">
                <span>Directional</span>
                <button type="button" onClick={onToggleEdgeDirection}>
                  {selectedEdge.data?.directed ?? true ? 'On' : 'Off'}
                </button>
              </div>
              <button type="button" className="danger" onClick={onDeleteEdge}>
                Delete Edge
              </button>
            </div>
          ) : (
            <p className="empty-state">Select a node or edge to edit its details.</p>
          )}
          <div className="tags-panel">
            <div className="tags-header">
              <h3>Tags</h3>
              <button type="button" onClick={() => setSelectedTagColor(null)}>
                Clear Focus
              </button>
            </div>
            <div className="tags-list">
              {tags.map((tag) => {
                const count = nodes.filter((node) => node.data.tagColor === tag.color).length;
                const isFocused = selectedTagColor === tag.color;
                return (
                  <div key={tag.id} className={`tag-row ${isFocused ? 'is-focused' : ''}`}>
                    <div className="tag-swatch" style={{ backgroundColor: tag.color }} />
                    <div className="tag-info">
                      <div className="tag-name">{tag.name}</div>
                      <div className="tag-meta">{count} nodes</div>
                    </div>
                    <button type="button" onClick={() => setSelectedTagColor(tag.color)}>
                      Focus
                    </button>
                  </div>
                );
              })}
            </div>
            <div className="tag-create">
              <label>
                Tag Name
                <input
                  type="text"
                  value={newTagName}
                  onChange={(event) => setNewTagName(event.target.value)}
                  placeholder="e.g. Research"
                />
              </label>
              <label>
                Tag Color
                <input
                  type="color"
                  value={newTagColor}
                  onChange={(event) => setNewTagColor(event.target.value)}
                />
              </label>
              <button type="button" onClick={onAddTag}>
                Add Tag
              </button>
            </div>
          </div>
          {graphFile ? (
            <div className="file-info">
              <div>Graph file:</div>
              <span>{graphFile.filePath}</span>
            </div>
          ) : (
            <div className="file-info warning">Save the graph to create the data folder.</div>
          )}
        </aside>
      </div>
    </div>
  );
};

export default App;
