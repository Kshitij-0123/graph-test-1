export type GraphFilePayload = {
  filePath: string;
  baseDir: string;
  data: string;
};

declare global {
  interface Window {
    graphAPI: {
      openGraph: () => Promise<GraphFilePayload | null>;
      saveGraph: (payload: { filePath: string; content: string }) => Promise<{ filePath: string; baseDir: string }>;
      saveGraphAs: (payload: { suggestedName: string }) => Promise<{ filePath: string; baseDir: string } | null>;
      readNodeFile: (payload: { baseDir: string; nodeId: string }) => Promise<string>;
      writeNodeFile: (payload: { baseDir: string; nodeId: string; content: string }) => Promise<boolean>;
    };
  }
}

export {};
