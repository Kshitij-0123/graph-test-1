import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  applyEdgeChanges,
  applyNodeChanges,
  addEdge,
  type Connection,
  type Edge,
  type Node,
  type NodeTypes
} from 'reactflow';
import dagre from '@dagrejs/dagre';
import { marked } from 'marked';

type GraphNodeData = {
  label: string;
  tag: string;
  tagColor: string;
};

type GraphFile = {
  filePath: string;
  baseDir: string;
};

type GraphJson = {
  nodes: Array<{ id: string; label: string; tag: string; tagColor: string }>;
  edges: Array<{ source: string; target: string }>;
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
      <div className="node-tag" style={{ backgroundColor: data.tagColor }}>
        {data.tag || 'tag'}
      </div>
      <div className="node-label">{data.label || 'Untitled'}</div>
    </div>
  );
};

const initialNodes: Node<GraphNodeData>[] = [
  {
    id: 'node-1',
    data: { label: 'Idea', tag: 'core', tagColor: '#6366F1' },
    position: { x: 0, y: 0 },
    type: 'graphNode'
  },
  {
    id: 'node-2',
    data: { label: 'Next', tag: 'todo', tagColor: '#22C55E' },
    position: { x: 300, y: 0 },
    type: 'graphNode'
  }
];

const initialEdges: Edge[] = [{ id: 'e1-2', source: 'node-1', target: 'node-2' }];

const createGraphJson = (nodes: Node<GraphNodeData>[], edges: Edge[]): GraphJson => ({
  nodes: nodes.map((node) => ({
    id: node.id,
    label: node.data.label,
    tag: node.data.tag,
    tagColor: node.data.tagColor
  })),
  edges: edges.map((edge) => ({
    source: edge.source,
    target: edge.target
  }))
});

const parseGraphJson = (raw: string): GraphJson => {
  const parsed = JSON.parse(raw) as GraphJson;
  return {
    nodes: parsed.nodes || [],
    edges: parsed.edges || []
  };
};

const createNode = (label = 'New node'): Node<GraphNodeData> => ({
  id: `node-${crypto.randomUUID()}`,
  type: 'graphNode',
  position: { x: 100, y: 100 },
  data: {
    label,
    tag: 'tag',
    tagColor: '#38BDF8'
  }
});

const App = () => {
  const [nodes, setNodes] = useState<Node<GraphNodeData>[]>(() => layoutGraph(initialNodes, initialEdges));
  const [edges, setEdges] = useState<Edge[]>(initialEdges);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [graphFile, setGraphFile] = useState<GraphFile | null>(null);
  const [nodeNotes, setNodeNotes] = useState<Record<string, string>>({});
  const [status, setStatus] = useState('Ready');
  const saveTimeout = useRef<number | null>(null);

  const nodeTypes = useMemo<NodeTypes>(() => ({ graphNode: GraphNode }), []);

  const selectedNode = nodes.find((node) => node.id === selectedNodeId) || null;
  const selectedNote = selectedNodeId ? nodeNotes[selectedNodeId] ?? '' : '';

  const onConnect = useCallback(
    (connection: Connection) => setEdges((eds) => addEdge(connection, eds)),
    []
  );

  const onAddNode = () => {
    setNodes((current) => [...current, createNode()]);
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

  const onAutoLayout = () => {
    setNodes((current) => layoutGraph(current, edges));
  };

  const handleOpen = async () => {
    const result = await window.graphAPI.openGraph();
    if (!result) return;
    const data = parseGraphJson(result.data);
    const loadedNodes = data.nodes.map((node) => ({
      id: node.id,
      type: 'graphNode',
      position: { x: 0, y: 0 },
      data: { label: node.label, tag: node.tag, tagColor: node.tagColor }
    }));
    const loadedEdges = data.edges.map((edge, index) => ({
      id: `e-${edge.source}-${edge.target}-${index}`,
      source: edge.source,
      target: edge.target
    }));
    setNodes(layoutGraph(loadedNodes, loadedEdges));
    setEdges(loadedEdges);
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
          <button type="button" onClick={onAutoLayout}>
            Auto Layout
          </button>
        </div>
        <div className="status">{status}</div>
      </header>
      <div className="content">
        <div className="canvas">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={(changes) => setNodes((current) => applyNodeChanges(changes, current))}
            onEdgesChange={(changes) => setEdges((current) => applyEdgeChanges(changes, current))}
            onNodeClick={(_, node) => setSelectedNodeId(node.id)}
            onConnect={onConnect}
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
                <input
                  type="text"
                  value={selectedNode.data.tag}
                  onChange={(event) => updateSelectedNode({ tag: event.target.value })}
                />
              </label>
              <label>
                Tag Color
                <input
                  type="color"
                  value={selectedNode.data.tagColor}
                  onChange={(event) => updateSelectedNode({ tagColor: event.target.value })}
                />
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
          ) : (
            <p className="empty-state">Select a node to edit its label, tag, and notes.</p>
          )}
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
