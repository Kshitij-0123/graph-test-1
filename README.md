# Graph Studio (graph-test-1)

A minimal Electron + React (TypeScript) graph editor for creating disconnected graphs with
rounded node cards, colored tags, and per-node markdown notes stored locally (no backend).

## Features

- Create, delete, and connect nodes with drag-and-drop.
- Multiple disconnected subgraphs supported in the same canvas.
- Auto-layout using Dagre.
- Autosave for opened files and files saved at least once.
- Node metadata: label + tag with configurable color.
- Per-node markdown notes with live preview.
- File-backed storage:
  - Graph JSON: `<graph>_data/<graph>.json`
  - Node notes: `<graph>_data/nodes/<nodeId>.md`

## Project Structure

```
.
├── electron/
│   ├── main.js        # Electron main process (file IO + window)
│   └── preload.js     # Secure IPC bridge (graphAPI)
├── src/renderer/
│   ├── App.tsx        # Graph canvas + editor UI
│   ├── main.tsx       # React entry
│   ├── global.d.ts    # graphAPI typings
│   └── styles.css     # Minimal UI theme
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## Usage

### Install

```
npm install
```

### Run (development)

```
npm run start
```

This runs Vite for the renderer and launches Electron. The app opens a single window.

### Build (renderer)

```
npm run build
```

## Graph Data Format

Example JSON structure:

```json
{
  "nodes": [
    { "id": "node-1", "label": "Idea", "tag": "core", "tagColor": "#6366F1" }
  ],
  "edges": [
    { "source": "node-1", "target": "node-2" }
  ]
}
```

Only graph topology and node metadata are stored in JSON. Node positions are
recomputed via auto-layout on open.

## Notes

- Node content is stored as Markdown files in `<graph>_data/nodes/`.
- Autosave triggers on changes after a file has been opened or saved at least once.
- The UI is inspired by minimal tools like Figma/Excalidraw.
