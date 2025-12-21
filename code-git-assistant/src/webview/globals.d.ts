/**
 * Webview全局类型声明
 */

// VS Code Webview API
declare const vscode: {
    postMessage: (message: any) => void;
    getState: () => any;
    setState: (state: any) => void;
};

// Browser APIs
declare const window: any;
declare const document: any;
declare const confirm: (message?: string) => boolean;

// Canvas API
declare type CanvasRenderingContext2D = any;
declare type HTMLCanvasElement = any;

